import { randomUUID } from 'node:crypto';
import type { CreateRoutineInput, RoutineRecord, RoutineRun, RoutineStep, RoutineStepKind } from '../../shared/types.js';
import type { Storage } from '../database/storage.js';

const STARTERS: Array<{ id: string; name: string; description: string; steps: Array<{ kind: RoutineStepKind; title: string; durationMinutes: number | null }> }> = [
  {
    id: 'starter-routine-daily-start', name: 'Daily Work Start', description: 'Plan the day, prepare a workspace and complete a focused block.',
    steps: [
      { kind: 'review_missions', title: 'Review today’s missions', durationMinutes: null },
      { kind: 'workspace', title: 'Prepare a workspace', durationMinutes: null },
      { kind: 'focus', title: 'Complete one focused work block', durationMinutes: 50 },
      { kind: 'break', title: 'Take a short break', durationMinutes: 10 },
      { kind: 'reflection', title: 'Reflect on the progress made', durationMinutes: null }
    ]
  },
  {
    id: 'starter-routine-study-cycle', name: 'Study Cycle', description: 'A simple repeatable study sequence.',
    steps: [
      { kind: 'review_missions', title: 'Choose the subject and topic', durationMinutes: null },
      { kind: 'focus', title: 'Study with full attention', durationMinutes: 40 },
      { kind: 'break', title: 'Take a short break', durationMinutes: 10 },
      { kind: 'focus', title: 'Recall and practise', durationMinutes: 30 },
      { kind: 'reflection', title: 'Record what you learned', durationMinutes: null }
    ]
  },
  {
    id: 'starter-routine-client-delivery', name: 'Client Delivery', description: 'Plan and make progress on a client deliverable.',
    steps: [
      { kind: 'review_missions', title: 'Confirm the deliverable and next action', durationMinutes: null },
      { kind: 'workspace', title: 'Open the client workspace', durationMinutes: null },
      { kind: 'focus', title: 'Work on the deliverable', durationMinutes: 60 },
      { kind: 'reflection', title: 'Update delivery progress', durationMinutes: null }
    ]
  }
];

export class RoutineService {
  constructor(private storage: Storage) {
    this.seedStarters();
  }

  list(): RoutineRecord[] {
    const rows = this.storage.raw.prepare('SELECT * FROM routines ORDER BY is_built_in DESC, updated_at DESC').all() as RoutineRow[];
    return rows.map(mapRoutine);
  }

  create(input: CreateRoutineInput): RoutineRecord {
    const name = input.name.trim();
    if (!name) throw new Error('Routine name is required.');
    const steps = normalizeSteps(input.steps);
    const now = new Date().toISOString();
    const id = randomUUID();
    this.storage.raw.prepare('INSERT INTO routines (id,name,description,steps_json,is_built_in,created_at,updated_at) VALUES (?,?,?,?,0,?,?)')
      .run(id, name, input.description?.trim() ?? '', JSON.stringify(steps), now, now);
    return this.get(id)!;
  }

  delete(id: string): void {
    const row = this.storage.raw.prepare('SELECT is_built_in FROM routines WHERE id=?').get(id) as { is_built_in: number } | undefined;
    if (!row) throw new Error('Routine not found.');
    if (row.is_built_in) throw new Error('Built-in routines cannot be deleted. Duplicate or create a custom routine instead.');
    const active = this.storage.raw.prepare("SELECT id FROM routine_runs WHERE routine_id=? AND status='running'").get(id);
    if (active) throw new Error('Cancel the active routine before deleting it.');
    this.storage.raw.prepare('DELETE FROM routines WHERE id=?').run(id);
  }

  start(id: string): RoutineRun {
    if (this.current()) throw new Error('Finish or cancel the current routine before starting another.');
    const routine = this.get(id);
    if (!routine) throw new Error('Routine not found.');
    const now = new Date().toISOString();
    const runId = randomUUID();
    this.storage.raw.prepare('INSERT INTO routine_runs (id,routine_id,routine_name,steps_json,current_step_index,status,started_at,completed_at) VALUES (?,?,?,?,0,\'running\',?,NULL)')
      .run(runId, routine.id, routine.name, JSON.stringify(routine.steps), now);
    return this.current()!;
  }

  current(): RoutineRun | null {
    const row = this.storage.raw.prepare("SELECT * FROM routine_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1").get() as RoutineRunRow | undefined;
    return row ? mapRun(row) : null;
  }

  history(limit = 20): RoutineRun[] {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = this.storage.raw.prepare('SELECT * FROM routine_runs ORDER BY started_at DESC LIMIT ?').all(safeLimit) as RoutineRunRow[];
    return rows.map(mapRun);
  }

  completeCurrentStep(): RoutineRun | null {
    const run = this.current();
    if (!run) throw new Error('There is no active routine.');
    const nextIndex = run.currentStepIndex + 1;
    const completed = nextIndex >= run.steps.length;
    this.storage.raw.prepare('UPDATE routine_runs SET current_step_index=?, status=?, completed_at=? WHERE id=?')
      .run(nextIndex, completed ? 'completed' : 'running', completed ? new Date().toISOString() : null, run.id);
    return this.getRun(run.id);
  }

  cancelCurrent(): void {
    const run = this.current();
    if (!run) return;
    this.storage.raw.prepare("UPDATE routine_runs SET status='cancelled', completed_at=? WHERE id=?").run(new Date().toISOString(), run.id);
  }

  private get(id: string): RoutineRecord | null {
    const row = this.storage.raw.prepare('SELECT * FROM routines WHERE id=?').get(id) as RoutineRow | undefined;
    return row ? mapRoutine(row) : null;
  }

  private getRun(id: string): RoutineRun | null {
    const row = this.storage.raw.prepare('SELECT * FROM routine_runs WHERE id=?').get(id) as RoutineRunRow | undefined;
    return row ? mapRun(row) : null;
  }

  private seedStarters() {
    const now = new Date().toISOString();
    const insert = this.storage.raw.prepare('INSERT OR IGNORE INTO routines (id,name,description,steps_json,is_built_in,created_at,updated_at) VALUES (?,?,?,?,1,?,?)');
    for (const starter of STARTERS) {
      const steps = starter.steps.map((step, index) => ({ ...step, id: `${starter.id}-step-${index + 1}`, workspacePresetId: null }));
      insert.run(starter.id, starter.name, starter.description, JSON.stringify(steps), now, now);
    }
  }
}

function normalizeSteps(input: RoutineStep[]): RoutineStep[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 12) throw new Error('A routine must contain between 1 and 12 steps.');
  return input.map((step, index) => ({
    id: step.id?.trim() || randomUUID(),
    kind: step.kind,
    title: step.title.trim(),
    durationMinutes: step.durationMinutes == null ? null : Math.max(1, Math.min(240, Math.floor(step.durationMinutes))),
    workspacePresetId: step.workspacePresetId ?? null
  }));
}

type RoutineRow = { id: string; name: string; description: string; steps_json: string; is_built_in: number; created_at: string; updated_at: string };
type RoutineRunRow = { id: string; routine_id: string; routine_name: string; steps_json: string; current_step_index: number; status: RoutineRun['status']; started_at: string; completed_at: string | null };
function parseSteps(value: string): RoutineStep[] {
  try { const parsed = JSON.parse(value) as RoutineStep[]; return Array.isArray(parsed) ? normalizeSteps(parsed) : []; }
  catch { return []; }
}
function mapRoutine(row: RoutineRow): RoutineRecord { return { id: row.id, name: row.name, description: row.description, steps: parseSteps(row.steps_json), isBuiltIn: Boolean(row.is_built_in), createdAt: row.created_at, updatedAt: row.updated_at }; }
function mapRun(row: RoutineRunRow): RoutineRun { return { id: row.id, routineId: row.routine_id, routineName: row.routine_name, steps: parseSteps(row.steps_json), currentStepIndex: Math.min(row.current_step_index, parseSteps(row.steps_json).length), status: row.status, startedAt: row.started_at, completedAt: row.completed_at }; }
