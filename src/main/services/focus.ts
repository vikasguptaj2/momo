import { randomUUID } from 'node:crypto';
import type { FocusSession, StartFocusInput } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';

export class FocusService {
  private deadlineNotifiedSessionId: string | null = null;

  constructor(private storage: Storage, private onEvent: (kind: 'focus' | 'complete' | 'timer', message: string) => void) {
    this.recoverInterruptedSession();
  }

  checkDeadline(): void {
    const current = this.current();
    if (!current || current.status !== 'running' || !current.resumedAt) {
      if (!current) this.deadlineNotifiedSessionId = null;
      return;
    }
    const elapsed = current.accumulatedSeconds + Math.max(0, Math.floor((Date.now() - new Date(current.resumedAt).getTime()) / 1000));
    if (elapsed >= current.plannedMinutes * 60 && this.deadlineNotifiedSessionId !== current.id) {
      this.deadlineNotifiedSessionId = current.id;
      this.onEvent('timer', `Your planned ${current.plannedMinutes}-minute focus block is up. Continue for a little longer or finish and reflect on what you accomplished.`);
    }
  }

  extend(minutes: number): FocusSession {
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60) throw new Error('Choose an extension between 5 and 60 minutes.');
    const current = this.current();
    if (!current || current.status !== 'running') throw new Error('Resume your focus session before extending it.');
    this.storage.raw.prepare('UPDATE focus_sessions SET planned_minutes = planned_minutes + ? WHERE id = ?').run(minutes, current.id);
    this.deadlineNotifiedSessionId = null;
    return this.current()!;
  }

  checkpoint(): void {
    const current = this.current();
    if (!current || current.status !== 'running' || !current.resumedAt) return;
    const now = new Date();
    const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(current.resumedAt).getTime()) / 1000));
    this.storage.raw.prepare('UPDATE focus_sessions SET accumulated_seconds=?, resumed_at=? WHERE id=?')
      .run(current.accumulatedSeconds + elapsed, now.toISOString(), current.id);
  }

  private recoverInterruptedSession(): void {
    const now = Date.now();
    const rows = this.storage.raw.prepare("SELECT id, resumed_at, accumulated_seconds FROM focus_sessions WHERE status='running'").all() as Array<{ id: string; resumed_at: string | null; accumulated_seconds: number }>;
    const update = this.storage.raw.prepare("UPDATE focus_sessions SET accumulated_seconds=?, resumed_at=NULL, status='paused' WHERE id=?");
    for (const row of rows) {
      const elapsed = row.resumed_at ? Math.max(0, Math.min(15, Math.floor((now - new Date(row.resumed_at).getTime()) / 1000))) : 0;
      update.run(row.accumulated_seconds + elapsed, row.id);
    }
  }

  current(): FocusSession | null {
    const row = this.storage.raw.prepare("SELECT * FROM focus_sessions WHERE status IN ('running','paused') ORDER BY started_at DESC LIMIT 1").get() as DbSession | undefined;
    return row ? mapSession(row) : null;
  }

  start(input: StartFocusInput): FocusSession {
    if (this.current()) throw new Error('End or pause the current focus session before starting another.');
    const now = new Date().toISOString();
    const id = randomUUID();
    this.deadlineNotifiedSessionId = null;
    this.storage.raw.prepare(`INSERT INTO focus_sessions (id, task_id, task_title, started_at, resumed_at, ended_at, planned_minutes, accumulated_seconds, status, workspace_run_id) VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 'running', ?)`)
      .run(id, input.taskId ?? null, input.taskTitle.trim(), now, now, input.plannedMinutes, input.workspaceRunId ?? null);
    this.onEvent('focus', `You are set. Let's make progress on ${input.taskTitle.trim()}.`);
    return this.current()!;
  }

  pause(): FocusSession {
    const current = this.requireRunning();
    const now = new Date();
    const accumulated = current.accumulatedSeconds + Math.max(0, Math.floor((now.getTime() - new Date(current.resumedAt!).getTime()) / 1000));
    this.storage.raw.prepare("UPDATE focus_sessions SET accumulated_seconds = ?, resumed_at = NULL, status = 'paused' WHERE id = ?").run(accumulated, current.id);
    return this.current()!;
  }

  resume(): FocusSession {
    const current = this.current();
    if (!current || current.status !== 'paused') throw new Error('There is no paused focus session.');
    this.storage.raw.prepare("UPDATE focus_sessions SET resumed_at = ?, status = 'running' WHERE id = ?").run(new Date().toISOString(), current.id);
    return this.current()!;
  }

  end(completed: boolean): FocusSession {
    const current = this.current();
    if (!current) throw new Error('There is no active focus session.');
    const now = new Date();
    const added = current.status === 'running' && current.resumedAt
      ? Math.max(0, Math.floor((now.getTime() - new Date(current.resumedAt).getTime()) / 1000)) : 0;
    const status = completed ? 'completed' : 'cancelled';
    this.deadlineNotifiedSessionId = null;
    this.storage.raw.prepare('UPDATE focus_sessions SET accumulated_seconds = ?, resumed_at = NULL, ended_at = ?, status = ? WHERE id = ?')
      .run(current.accumulatedSeconds + added, now.toISOString(), status, current.id);
    // A completed focus session is not proof that the linked task is complete.
    // Task status is updated only after the user records a session reflection.
    if (current.workspaceRunId) {
      this.storage.raw.prepare('UPDATE workspace_runs SET status = ?, completed_at = ? WHERE id = ?')
        .run(status, now.toISOString(), current.workspaceRunId);
    }
    if (completed) this.onEvent('complete', `Goal complete. You showed up for ${current.taskTitle}.`);
    return mapSession(this.storage.raw.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(current.id) as DbSession);
  }

  private requireRunning(): FocusSession {
    const current = this.current();
    if (!current || current.status !== 'running') throw new Error('There is no running focus session.');
    return current;
  }
}

type DbSession = { id: string; task_id: string | null; task_title: string; started_at: string; resumed_at: string | null; ended_at: string | null; planned_minutes: number; accumulated_seconds: number; status: FocusSession['status']; workspace_run_id?: string | null };
function mapSession(row: DbSession): FocusSession {
  return { id: row.id, taskId: row.task_id, taskTitle: row.task_title, startedAt: row.started_at, resumedAt: row.resumed_at, endedAt: row.ended_at, plannedMinutes: row.planned_minutes, accumulatedSeconds: row.accumulated_seconds, status: row.status, workspaceRunId: row.workspace_run_id ?? null };
}
