import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { MilestoneService } from './milestones.js';
import type { Storage } from '../database/storage.js';

describe('MilestoneService', () => {
  let db: Database.Database | undefined;
  const createService = () => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE focus_sessions (id TEXT PRIMARY KEY, accumulated_seconds INTEGER NOT NULL, status TEXT NOT NULL);
      CREATE TABLE tasks (id TEXT PRIMARY KEY, completed_at TEXT);
      CREATE TABLE milestones (code TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, achieved_at TEXT NOT NULL);
    `);
    return new MilestoneService({ raw: db } as unknown as Storage);
  };
  afterEach(() => { db?.close(); db = undefined; });

  it('starts with locked milestones and zero progress', () => {
    const service = createService();
    const items = service.list();
    expect(items).toHaveLength(5);
    expect(items.every(item => item.achievedAt === null && item.progress === 0)).toBe(true);
  });

  it('unlocks the first completed focus session once', () => {
    const service = createService();
    db!.prepare('INSERT INTO focus_sessions VALUES (?, ?, ?)').run('s1', 1500, 'completed');
    expect(service.newlyUnlocked().map(item => item.code)).toContain('first-session');
    expect(service.newlyUnlocked()).toHaveLength(0);
  });

  it('unlocks the hour badge from completed focus seconds', () => {
    const service = createService();
    db!.prepare('INSERT INTO focus_sessions VALUES (?, ?, ?)').run('s1', 3600, 'completed');
    expect(service.list().find(item => item.code === 'focus-hour')?.achievedAt).toBeTruthy();
  });

  it('counts completed tasks for the task badge', () => {
    const service = createService();
    const insert = db!.prepare('INSERT INTO tasks VALUES (?, ?)');
    for (let i = 0; i < 5; i += 1) insert.run(`t${i}`, new Date().toISOString());
    expect(service.list().find(item => item.code === 'task-finisher')?.achievedAt).toBeTruthy();
  });
});
