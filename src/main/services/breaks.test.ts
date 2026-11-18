import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { BreakService } from './breaks.js';
import type { Storage } from '../database/storage.js';
import type { FocusService } from './focus.js';

describe('BreakService', () => {
  let db: Database.Database | undefined;
  const create = (focusStatus: 'running' | 'paused' | null = null) => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE break_sessions (
      id TEXT PRIMARY KEY, focus_session_id TEXT, kind TEXT NOT NULL,
      planned_minutes INTEGER NOT NULL, started_at TEXT NOT NULL,
      resumed_at TEXT, ended_at TEXT, accumulated_seconds INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL
    );`);
    const pause = vi.fn();
    const current = vi.fn(() => focusStatus ? ({ id: 'focus-1', status: focusStatus }) : null);
    const events = vi.fn();
    const service = new BreakService({ raw: db } as unknown as Storage, { current, pause } as unknown as FocusService, events);
    return { service, pause, events };
  };
  afterEach(() => { db?.close(); db = undefined; });

  it('pauses a running focus session and creates a linked timed break', () => {
    const { service, pause, events } = create('running');
    const result = service.start(10, 'short');
    expect(pause).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ focusSessionId: 'focus-1', kind: 'short', plannedMinutes: 10, status: 'running' });
    expect(events).toHaveBeenCalledWith('break', expect.stringContaining('10 minutes'));
  });

  it('does not allow a second active break', () => {
    const { service } = create();
    service.start(5, 'short');
    expect(() => service.start(5, 'short')).toThrow('Finish or cancel the current break');
  });

  it('supports pause, resume and completed end transitions', () => {
    const { service } = create();
    service.start(5, 'short');
    expect(service.pause().status).toBe('paused');
    expect(service.resume().status).toBe('running');
    const completed = service.end(true);
    expect(completed.status).toBe('completed');
    expect(completed.endedAt).toBeTruthy();
    expect(service.current()).toBeNull();
  });

  it('rejects durations outside the supported range', () => {
    const { service } = create();
    expect(() => service.start(0, 'short')).toThrow('between 1 and 60 minutes');
    expect(() => service.start(61, 'long')).toThrow('between 1 and 60 minutes');
  });
});
