import { randomUUID } from 'node:crypto';
import type { BreakKind, BreakSession } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';
import type { FocusService } from './focus.js';

export class BreakService {
  constructor(
    private storage: Storage,
    private focus: FocusService,
    private onEvent: (kind: 'break' | 'welcome', message: string) => void
  ) {
    this.recoverInterruptedBreak();
  }

  current(): BreakSession | null {
    const row = this.storage.raw.prepare("SELECT * FROM break_sessions WHERE status IN ('running','paused') ORDER BY started_at DESC LIMIT 1").get() as BreakRow | undefined;
    return row ? mapBreak(row) : null;
  }

  start(plannedMinutes: number, kind: BreakKind = 'short'): BreakSession {
    if (!Number.isInteger(plannedMinutes) || plannedMinutes < 1 || plannedMinutes > 60) {
      throw new Error('Break duration must be between 1 and 60 minutes.');
    }
    if (this.current()) throw new Error('Finish or cancel the current break before starting another.');
    const activeFocus = this.focus.current();
    if (activeFocus?.status === 'running') this.focus.pause();
    const now = new Date().toISOString();
    const id = randomUUID();
    this.storage.raw.prepare(`INSERT INTO break_sessions
      (id, focus_session_id, kind, planned_minutes, started_at, resumed_at, ended_at, accumulated_seconds, status)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 'running')`)
      .run(id, activeFocus?.id ?? null, kind, plannedMinutes, now, now);
    this.onEvent('break', `Take ${plannedMinutes} minutes for a proper break. Your focus session is safely paused.`);
    return this.current()!;
  }

  checkpoint(): void {
    const current = this.current();
    if (!current || current.status !== 'running' || !current.resumedAt) return;
    const now = new Date();
    const added = Math.max(0, Math.floor((now.getTime() - new Date(current.resumedAt).getTime()) / 1000));
    this.storage.raw.prepare('UPDATE break_sessions SET accumulated_seconds=?, resumed_at=? WHERE id=?')
      .run(current.accumulatedSeconds + added, now.toISOString(), current.id);
  }

  checkDeadline(): void {
    const current = this.current();
    if (!current || current.status !== 'running' || !current.resumedAt) return;
    const elapsed = current.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(current.resumedAt).getTime()) / 1000));
    if (elapsed >= current.plannedMinutes * 60) {
      this.end(true);
    }
  }

  pause(): BreakSession {
    const current = this.current();
    if (!current || current.status !== 'running' || !current.resumedAt) throw new Error('There is no running break to pause.');
    const now = new Date();
    const accumulated = current.accumulatedSeconds + Math.max(0, Math.floor((now.getTime() - new Date(current.resumedAt).getTime()) / 1000));
    this.storage.raw.prepare("UPDATE break_sessions SET accumulated_seconds=?, resumed_at=NULL, status='paused' WHERE id=?")
      .run(accumulated, current.id);
    return this.current()!;
  }

  resume(): BreakSession {
    const current = this.current();
    if (!current || current.status !== 'paused') throw new Error('There is no paused break to resume.');
    this.storage.raw.prepare("UPDATE break_sessions SET resumed_at=?, status='running' WHERE id=?")
      .run(new Date().toISOString(), current.id);
    return this.current()!;
  }

  end(completed: boolean): BreakSession {
    const current = this.current();
    if (!current) throw new Error('There is no active break.');
    const now = new Date();
    const added = current.status === 'running' && current.resumedAt
      ? Math.max(0, Math.floor((now.getTime() - new Date(current.resumedAt).getTime()) / 1000)) : 0;
    this.storage.raw.prepare('UPDATE break_sessions SET accumulated_seconds=?, resumed_at=NULL, ended_at=?, status=? WHERE id=?')
      .run(current.accumulatedSeconds + added, now.toISOString(), completed ? 'completed' : 'cancelled', current.id);
    if (completed) this.onEvent('welcome', 'Break complete. Take your next step at your own pace.');
    return mapBreak(this.storage.raw.prepare('SELECT * FROM break_sessions WHERE id=?').get(current.id) as BreakRow);
  }

  private recoverInterruptedBreak(): void {
    const now = Date.now();
    const rows = this.storage.raw.prepare("SELECT id, resumed_at, accumulated_seconds FROM break_sessions WHERE status='running'").all() as Array<{ id: string; resumed_at: string | null; accumulated_seconds: number }>;
    const update = this.storage.raw.prepare("UPDATE break_sessions SET accumulated_seconds=?, resumed_at=NULL, status='paused' WHERE id=?");
    for (const row of rows) {
      const elapsed = row.resumed_at ? Math.max(0, Math.min(15, Math.floor((now - new Date(row.resumed_at).getTime()) / 1000))) : 0;
      update.run(row.accumulated_seconds + elapsed, row.id);
    }
  }
}

type BreakRow = {
  id: string; focus_session_id: string | null; kind: BreakKind; planned_minutes: number;
  started_at: string; resumed_at: string | null; ended_at: string | null;
  accumulated_seconds: number; status: BreakSession['status'];
};

function mapBreak(row: BreakRow): BreakSession {
  return {
    id: row.id, focusSessionId: row.focus_session_id, kind: row.kind,
    plannedMinutes: row.planned_minutes, startedAt: row.started_at,
    resumedAt: row.resumed_at, endedAt: row.ended_at,
    accumulatedSeconds: row.accumulated_seconds, status: row.status
  };
}
