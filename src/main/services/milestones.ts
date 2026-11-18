import type { Storage } from '../database/storage.js';
import type { MilestoneItem } from '../../shared/types.js';

type MilestoneDefinition = Pick<MilestoneItem, 'code' | 'title' | 'description' | 'target'> & {
  metric: 'completedSessions' | 'focusSeconds' | 'completedTasks';
};

const DEFINITIONS: MilestoneDefinition[] = [
  { code: 'first-session', title: 'First Steps', description: 'Complete your first focus session.', target: 1, metric: 'completedSessions' },
  { code: 'five-sessions', title: 'Finding Your Rhythm', description: 'Complete five focus sessions.', target: 5, metric: 'completedSessions' },
  { code: 'focus-hour', title: 'One Hour Strong', description: 'Accumulate one hour of completed focus time.', target: 3600, metric: 'focusSeconds' },
  { code: 'task-finisher', title: 'Task Finisher', description: 'Complete five intentions from your task list.', target: 5, metric: 'completedTasks' },
  { code: 'ten-sessions', title: 'Scout Pathfinder', description: 'Complete ten focus sessions. Consistency is an adventure.', target: 10, metric: 'completedSessions' }
];

export class MilestoneService {
  constructor(private storage: Storage) {}

  list(): MilestoneItem[] {
    const totals = this.storage.raw.prepare(`
      SELECT
        (SELECT COUNT(*) FROM focus_sessions WHERE status = 'completed') AS completedSessions,
        (SELECT COALESCE(SUM(accumulated_seconds), 0) FROM focus_sessions WHERE status = 'completed') AS focusSeconds,
        (SELECT COUNT(*) FROM tasks WHERE completed_at IS NOT NULL) AS completedTasks
    `).get() as { completedSessions: number; focusSeconds: number; completedTasks: number };

    const achieved = new Map(
      (this.storage.raw.prepare('SELECT code, achieved_at AS achievedAt FROM milestones').all() as Array<{ code: string; achievedAt: string }>)
        .map(row => [row.code, row.achievedAt] as const)
    );
    const insert = this.storage.raw.prepare('INSERT OR IGNORE INTO milestones (code, title, description, achieved_at) VALUES (?, ?, ?, ?)');
    const now = new Date().toISOString();

    for (const definition of DEFINITIONS) {
      const current = totals[definition.metric];
      if (current >= definition.target && !achieved.has(definition.code)) {
        insert.run(definition.code, definition.title, definition.description, now);
        achieved.set(definition.code, now);
      }
    }

    return DEFINITIONS.map(definition => ({
      code: definition.code,
      title: definition.title,
      description: definition.description,
      target: definition.target,
      progress: Math.min(totals[definition.metric], definition.target),
      achievedAt: achieved.get(definition.code) ?? null
    }));
  }

  newlyUnlocked(): MilestoneItem[] {
    const before = new Set(
      (this.storage.raw.prepare('SELECT code FROM milestones').all() as Array<{ code: string }>).map(row => row.code)
    );
    return this.list().filter(item => item.achievedAt && !before.has(item.code));
  }
}
