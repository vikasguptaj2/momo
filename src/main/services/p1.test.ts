import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { P1Service } from './p1.js';

describe('P1Service', () => {
  let db: Database.Database | undefined;

  const create = () => {
    db = new Database(':memory:');
    // Create base tables needed for weekly review
    db.exec(`
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY, task_id TEXT, task_title TEXT NOT NULL, started_at TEXT NOT NULL,
        resumed_at TEXT, ended_at TEXT, planned_minutes INTEGER NOT NULL,
        accumulated_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, workspace_run_id TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        project_id TEXT, status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'medium',
        estimated_minutes INTEGER, due_at TEXT, parent_task_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL, completedAt TEXT, created_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS distraction_events (
        id TEXT PRIMARY KEY, app_name TEXT NOT NULL, created_at TEXT NOT NULL,
        focus_session_id TEXT, message TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recovery_events (
        id TEXT PRIMARY KEY, focus_session_id TEXT, app_name TEXT NOT NULL,
        action TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
    const service = new P1Service(db);
    return { service, db };
  };

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it('initializes default preferences, unlocks and seeded rituals', () => {
    const { service } = create();
    const state = service.getState();

    expect(state.preferences.personality).toBe('supportive');
    expect(state.preferences.interactionFrequency).toBe('normal');
    expect(state.preferences.textScale).toBe(100);
    expect(state.unlocks.length).toBeGreaterThanOrEqual(4);
    expect(state.rituals.length).toBe(3);
    expect(state.journal.length).toBe(0);
  });

  it('saves valid preferences and rejects invalid values', () => {
    const { service } = create();

    service.savePreference('personality', 'cheeky');
    expect(service.getState().preferences.personality).toBe('cheeky');

    service.savePreference('textScale', 120);
    expect(service.getState().preferences.textScale).toBe(120);

    expect(() => service.savePreference('personality', 'aggressive')).toThrow('Invalid personality');
    expect(() => service.savePreference('interactionFrequency', 'extreme')).toThrow('Invalid interaction frequency');
    expect(() => service.savePreference('textScale', 50)).toThrow('Text scale must be between 80 and 140');
    expect(() => service.savePreference('unsupportedKey', 'val')).toThrow('Unsupported Scout preference');
  });

  it('adds, pins, and deletes journal entries with validation', () => {
    const { service } = create();

    const entry = service.addJournal({
      kind: 'memory',
      title: 'First deep focus session',
      body: 'Felt calm and got through the hard problem.',
      tags: ['coding', 'focus']
    });

    expect(entry).toMatchObject({
      kind: 'memory',
      title: 'First deep focus session',
      pinned: 0
    });

    let state = service.getState();
    expect(state.journal.length).toBe(1);

    // Pin entry
    state = service.pinJournal(entry.id, true);
    expect(state.journal[0]?.pinned).toBe(1);

    // Rejects invalid kind
    expect(() => service.addJournal({ kind: 'invalid' as never, title: 'Title' })).toThrow('Check the journal entry');

    // Rejects empty title
    expect(() => service.addJournal({ kind: 'note', title: '   ' })).toThrow('Check the journal entry');

    // Delete entry
    state = service.deleteJournal(entry.id);
    expect(state.journal.length).toBe(0);
  });

  it('completes enabled rituals, records completions, and blocks disabled rituals', () => {
    const { service } = create();
    const rituals = service.getState().rituals;
    const morning = rituals.find(r => r.ritual_type === 'morning');
    expect(morning).toBeDefined();
    if (!morning) return;

    // Complete ritual
    const updated = service.completeRitual(morning.id, 'Felt ready for the day');
    expect(updated.completions.length).toBe(1);
    expect(updated.completions[0]?.ritual_id).toBe(morning.id);
    expect(updated.completions[0]?.note).toBe('Felt ready for the day');

    // Achievement journal entry created
    const achievement = updated.journal.find(j => j.kind === 'achievement');
    expect(achievement).toBeDefined();
    expect(achievement?.title).toContain(morning.name);

    // Disable ritual
    service.saveRitual({
      id: morning.id,
      name: morning.name,
      ritualType: 'morning',
      steps: ['Step 1'],
      enabled: false
    });

    // Attempting to complete disabled ritual should throw
    expect(() => service.completeRitual(morning.id)).toThrow('Disabled rituals cannot be completed');
  });

  it('equips available unlock items and rejects unavailable items', () => {
    const { service } = create();

    const state = service.unlock('trail-camp');
    expect(state.preferences.currentEnvironment).toBe('trail-camp');

    expect(() => service.unlock('unearned-secret-cabin')).toThrow('That item is not available');
  });

  it('aggregates trailing 7 days accurately for weekly review', () => {
    const { service, db } = create();
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString();

    // Insert focus sessions: 1 inside trailing 7 days, 1 older
    db.prepare(`
      INSERT INTO focus_sessions (id, task_title, started_at, planned_minutes, accumulated_seconds, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('f-1', 'Active task', twoDaysAgo, 25, 1500, 'completed');

    db.prepare(`
      INSERT INTO focus_sessions (id, task_title, started_at, planned_minutes, accumulated_seconds, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('f-old', 'Old task', tenDaysAgo, 25, 1500, 'completed');

    // Insert tasks: 1 touched and completed inside 7 days, 1 old
    db.prepare(`
      INSERT INTO tasks (id, title, status, created_at, completed_at, createdAt, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('t-1', 'Feature A', 'completed', twoDaysAgo, twoDaysAgo, twoDaysAgo, twoDaysAgo);

    db.prepare(`
      INSERT INTO tasks (id, title, status, created_at, completed_at, createdAt, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('t-old', 'Old feature', 'completed', tenDaysAgo, tenDaysAgo, tenDaysAgo, tenDaysAgo);

    // Insert recovery events with outcome 'returned' and 'break'
    db.prepare(`
      INSERT INTO recovery_events (id, app_name, action, outcome, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('r-1', 'Twitter.exe', 'restart', 'returned', twoDaysAgo);

    const review = service.getWeeklyReview();
    expect(review.focusSessions).toBe(1);
    expect(review.focusSeconds).toBe(1500);
    expect(review.completedSessions).toBe(1);
    expect(review.missionsCompleted).toBe(1);
    expect(review.missionsTouched).toBe(1);
    expect(review.successfulReturns).toBe(1);
  });
});
