import { randomUUID } from 'node:crypto';
import type {
  CreateProjectInput, CreateTaskInput, DailyPlan, DailyPlanItem, MoodCheckin, ProjectRecord,
  RecoveryEvent, RecoveryResponseInput, ReflectionOutcome, SaveDailyPlanInput, SaveMoodCheckinInput,
  SaveReflectionInput, SessionReflection, TaskPriority, TaskRecord, TaskStatus, UpdateProjectInput,
  UpdateTaskInput, UserProfile
} from '../../shared/types.js';
import type { Storage } from '../database/storage.js';

const PROFILE_ID = 'local';

export class ProductivityService {
  constructor(private storage: Storage) {}

  getProfile(): UserProfile {
    const row = this.storage.raw.prepare('SELECT * FROM user_profile WHERE id = ?').get(PROFILE_ID) as ProfileRow | undefined;
    if (!row) throw new Error('Local profile could not be initialized.');
    let workingDays: number[] = [1, 2, 3, 4, 5];
    try { const parsed = JSON.parse(row.working_days_json); if (Array.isArray(parsed)) workingDays = parsed.filter((x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 6); } catch { /* safe default */ }
    return {
      id: row.id, preferredName: row.preferred_name, userType: row.user_type as UserProfile['userType'], currentGoal: row.current_goal,
      workingDays, workStartTime: row.work_start_time, workEndTime: row.work_end_time, breakStartTime: row.break_start_time, breakEndTime: row.break_end_time,
      quietStartTime: row.quiet_start_time, quietEndTime: row.quiet_end_time, timezone: row.timezone,
      communicationStyle: row.communication_style as UserProfile['communicationStyle'], interactionFrequency: row.interaction_frequency as UserProfile['interactionFrequency'],
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  saveProfile(input: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const merged = { ...current, ...input };
    const now = new Date().toISOString();
    this.storage.raw.prepare(`UPDATE user_profile SET preferred_name=?, user_type=?, current_goal=?, working_days_json=?, work_start_time=?, work_end_time=?, break_start_time=?, break_end_time=?, quiet_start_time=?, quiet_end_time=?, timezone=?, communication_style=?, interaction_frequency=?, updated_at=? WHERE id=?`)
      .run(merged.preferredName, merged.userType, merged.currentGoal, JSON.stringify(merged.workingDays), merged.workStartTime, merged.workEndTime, merged.breakStartTime, merged.breakEndTime, merged.quietStartTime, merged.quietEndTime, merged.timezone, merged.communicationStyle, merged.interactionFrequency, now, PROFILE_ID);
    return this.getProfile();
  }

  listProjects(includeArchived = false): ProjectRecord[] {
    const rows = this.storage.raw.prepare(`SELECT p.*, COUNT(t.id) AS task_count, SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS completed_task_count FROM projects p LEFT JOIN tasks t ON t.project_id=p.id ${includeArchived ? '' : "WHERE p.status != 'archived'"} GROUP BY p.id ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 ELSE 2 END, p.updated_at DESC`).all() as ProjectRow[];
    return rows.map(mapProject);
  }

  createProject(input: CreateProjectInput): ProjectRecord {
    const now = new Date().toISOString(); const id = randomUUID();
    this.storage.raw.prepare('INSERT INTO projects (id, name, description, status, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.name.trim(), input.description?.trim() ?? '', 'active', input.color ?? '#D6A84B', now, now);
    return this.getProject(id)!;
  }

  updateProject(input: UpdateProjectInput): ProjectRecord {
    const current = this.getProject(input.id);
    if (!current) throw new Error('Project not found.');
    const next = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.storage.raw.prepare('UPDATE projects SET name=?, description=?, status=?, color=?, updated_at=? WHERE id=?')
      .run(next.name, next.description, next.status, next.color, next.updatedAt, input.id);
    return this.getProject(input.id)!;
  }

  deleteProject(id: string): void {
    this.storage.raw.prepare('UPDATE tasks SET project_id=NULL WHERE project_id=?').run(id);
    const result = this.storage.raw.prepare('DELETE FROM projects WHERE id=?').run(id);
    if (result.changes === 0) throw new Error('Project not found.');
  }

  private getProject(id: string): ProjectRecord | null {
    const row = this.storage.raw.prepare('SELECT p.*, (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) AS task_count, (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status=\'completed\') AS completed_task_count FROM projects p WHERE p.id=?').get(id) as ProjectRow | undefined;
    return row ? mapProject(row) : null;
  }

  listTasks(options: { projectId?: string; status?: TaskStatus; limit?: number } = {}): TaskRecord[] {
    const clauses: string[] = []; const params: unknown[] = [];
    if (options.projectId) { clauses.push('project_id=?'); params.push(options.projectId); }
    if (options.status) { clauses.push('status=?'); params.push(options.status); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.max(1, Math.min(500, options.limit ?? 200));
    const rows = this.storage.raw.prepare(`SELECT * FROM tasks ${where} ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, sort_order ASC, created_at DESC LIMIT ?`).all(...params, limit) as TaskRow[];
    return rows.map(mapTask);
  }

  createTask(input: CreateTaskInput): TaskRecord {
    if (input.projectId && !this.getProject(input.projectId)) throw new Error('Selected project does not exist.');
    const parent = input.parentTaskId ? this.getTask(input.parentTaskId) : null;
    if (input.parentTaskId && !parent) throw new Error('Parent task does not exist.');
    if (parent?.parentTaskId) throw new Error('Subtasks can only be one level deep.');
    const projectId = input.projectId ?? parent?.projectId ?? null;
    const now = new Date().toISOString(); const id = randomUUID();
    this.storage.raw.prepare(`INSERT INTO tasks (id,title,description,project_id,status,priority,estimated_minutes,due_at,parent_task_id,sort_order,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)`)
      .run(id, input.title.trim(), input.description?.trim() ?? '', projectId, 'todo', input.priority ?? parent?.priority ?? 'medium', input.estimatedMinutes ?? null, input.dueAt ?? null, input.parentTaskId ?? null, 0, now);
    return this.getTask(id)!;
  }

  updateTask(input: UpdateTaskInput): TaskRecord {
    const current = this.getTask(input.id); if (!current) throw new Error('Task not found.');
    const next = { ...current, ...input };
    if (next.projectId && !this.getProject(next.projectId)) throw new Error('Selected project does not exist.');
    if (next.parentTaskId === input.id) throw new Error('A task cannot be its own parent.');
    if (next.parentTaskId) {
      const parent = this.getTask(next.parentTaskId);
      if (!parent) throw new Error('Parent task does not exist.');
      if (parent.parentTaskId) throw new Error('Subtasks can only be one level deep.');
      if (!input.projectId && !current.projectId) next.projectId = parent.projectId;
      if (parent.projectId && next.projectId && parent.projectId !== next.projectId) throw new Error('A subtask must belong to the same project as its parent.');
    }
    const child = this.storage.raw.prepare('SELECT id FROM tasks WHERE parent_task_id=? LIMIT 1').get(input.id);
    if (child && next.parentTaskId) throw new Error('A task with subtasks cannot become a subtask.');
    const now = new Date().toISOString();
    const completedAt = next.status === 'completed' ? (current.completedAt ?? now) : null;
    this.storage.raw.prepare(`UPDATE tasks SET title=?, description=?, project_id=?, status=?, priority=?, estimated_minutes=?, due_at=?, parent_task_id=?, completed_at=? WHERE id=?`)
      .run(next.title, next.description ?? '', next.projectId ?? null, next.status ?? 'todo', next.priority ?? 'medium', next.estimatedMinutes ?? null, next.dueAt ?? null, next.parentTaskId ?? null, completedAt, input.id);
    return this.getTask(input.id)!;
  }

  completeTask(id: string): TaskRecord {
    return this.updateTask({ id, status: 'completed' });
  }

  deleteTask(id: string): void {
    const linked = this.storage.raw.prepare('SELECT COUNT(*) AS count FROM focus_sessions WHERE task_id=?').get(id) as { count: number };
    if (linked.count > 0) throw new Error('This task has focus history. Mark it cancelled instead to preserve your records.');
    this.storage.raw.prepare('DELETE FROM daily_plan_items WHERE task_id=?').run(id);
    this.storage.raw.prepare('UPDATE tasks SET parent_task_id=NULL WHERE parent_task_id=?').run(id);
    const result = this.storage.raw.prepare('DELETE FROM tasks WHERE id=?').run(id);
    if (result.changes === 0) throw new Error('Task not found.');
  }

  private getTask(id: string): TaskRecord | null {
    const row = this.storage.raw.prepare('SELECT * FROM tasks WHERE id=?').get(id) as TaskRow | undefined;
    return row ? mapTask(row) : null;
  }

  getDailyPlan(date = localDate()): DailyPlan {
    assertDate(date);
    const rows = this.storage.raw.prepare(`SELECT dpi.task_id AS taskId, dpi.kind, dpi.sort_order AS sortOrder, t.title, t.status, t.priority, t.estimated_minutes AS estimatedMinutes FROM daily_plan_items dpi JOIN tasks t ON t.id=dpi.task_id WHERE dpi.date=? ORDER BY CASE dpi.kind WHEN 'primary' THEN 0 ELSE 1 END, dpi.sort_order ASC`).all(date) as Array<{ taskId: string; kind: 'primary' | 'mission'; sortOrder: number; title: string; status: TaskStatus; priority: TaskPriority; estimatedMinutes: number | null }>;
    const primary = rows.find(row => row.kind === 'primary');
    const updated = this.storage.raw.prepare('SELECT MAX(created_at) AS updatedAt FROM daily_plan_items WHERE date=?').get(date) as { updatedAt: string | null };
    return { date, primaryTaskId: primary?.taskId ?? null, items: rows.map(row => ({ taskId: row.taskId, title: row.title, status: row.status, priority: row.priority, kind: row.kind, sortOrder: row.sortOrder, estimatedMinutes: row.estimatedMinutes })), updatedAt: updated.updatedAt };
  }

  saveDailyPlan(input: SaveDailyPlanInput): DailyPlan {
    assertDate(input.date);
    const uniqueIds = [...new Set(input.taskIds)];
    if (input.primaryTaskId && !uniqueIds.includes(input.primaryTaskId)) uniqueIds.unshift(input.primaryTaskId);
    if (uniqueIds.length > 30) throw new Error('A daily plan can contain at most 30 tasks.');
    const exists = this.storage.raw.prepare(`SELECT id FROM tasks WHERE id IN (${uniqueIds.map(() => '?').join(',') || "''"}) AND status NOT IN ('completed','cancelled')`).all(...uniqueIds) as Array<{ id: string }>;
    if (exists.length !== uniqueIds.length) throw new Error('One or more selected tasks are unavailable or already completed.');
    const now = new Date().toISOString();
    const save = this.storage.raw.transaction(() => {
      this.storage.raw.prepare('DELETE FROM daily_plan_items WHERE date=?').run(input.date);
      const insert = this.storage.raw.prepare('INSERT INTO daily_plan_items (date, task_id, kind, sort_order, created_at) VALUES (?, ?, ?, ?, ?)');
      uniqueIds.forEach((taskId, index) => insert.run(input.date, taskId, taskId === input.primaryTaskId ? 'primary' : 'mission', index, now));
    });
    save(); return this.getDailyPlan(input.date);
  }

  carryForwardDailyPlan(fromDate: string, toDate = localDate()): DailyPlan {
    assertDate(fromDate); assertDate(toDate);
    if (fromDate === toDate) throw new Error('Choose a different source date.');
    const source = this.getDailyPlan(fromDate);
    const target = this.getDailyPlan(toDate);
    const existingIds = new Set(target.items.map(item => item.taskId));
    const unfinished = source.items.filter(item => !['completed', 'cancelled'].includes(item.status)).map(item => item.taskId).filter(id => !existingIds.has(id));
    const merged = [...target.items.map(item => item.taskId), ...unfinished].slice(0, 30);
    const primaryTaskId = target.primaryTaskId ?? (source.primaryTaskId && merged.includes(source.primaryTaskId) ? source.primaryTaskId : null);
    return this.saveDailyPlan({ date: toDate, primaryTaskId, taskIds: merged });
  }

  createMoodCheckin(input: SaveMoodCheckinInput): MoodCheckin {
    const id = randomUUID(); const now = new Date().toISOString();
    this.storage.raw.prepare('INSERT INTO mood_checkins (id,mood,energy,motivation,support_style,note,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, input.mood, input.energy, input.motivation, input.supportStyle, input.note?.trim() ?? '', now);
    return { id, mood: input.mood, energy: input.energy, motivation: input.motivation, supportStyle: input.supportStyle, note: input.note?.trim() ?? '', createdAt: now };
  }

  getMoodHistory(limit = 14): MoodCheckin[] {
    const rows = this.storage.raw.prepare('SELECT * FROM mood_checkins ORDER BY created_at DESC LIMIT ?').all(Math.max(1, Math.min(limit, 100))) as MoodRow[];
    return rows.map(row => ({ id: row.id, mood: row.mood as MoodCheckin['mood'], energy: row.energy, motivation: row.motivation, supportStyle: row.support_style as MoodCheckin['supportStyle'], note: row.note, createdAt: row.created_at }));
  }

  saveSessionReflection(input: SaveReflectionInput): SessionReflection {
    const session = this.storage.raw.prepare('SELECT id FROM focus_sessions WHERE id=?').get(input.sessionId);
    if (!session) throw new Error('Focus session not found.');
    const existing = this.storage.raw.prepare('SELECT id, created_at AS createdAt FROM session_reflections WHERE session_id=?').get(input.sessionId) as { id: string; createdAt: string } | undefined;
    const now = new Date().toISOString(); const id = existing?.id ?? randomUUID();
    this.storage.raw.prepare(`INSERT INTO session_reflections (id,session_id,outcome,note,created_at) VALUES (?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET outcome=excluded.outcome,note=excluded.note,created_at=excluded.created_at`)
      .run(id, input.sessionId, input.outcome, input.note?.trim() ?? '', now);
    const linked = this.storage.raw.prepare('SELECT task_id AS taskId FROM focus_sessions WHERE id=?').get(input.sessionId) as { taskId: string | null } | undefined;
    if (linked?.taskId) {
      const status = input.outcome === 'completed' ? 'completed' : input.outcome === 'blocked' ? 'blocked' : 'in_progress';
      const completedAt = status === 'completed' ? now : null;
      this.storage.raw.prepare('UPDATE tasks SET status=?, completed_at=? WHERE id=?').run(status, completedAt, linked.taskId);
    }
    return { id, sessionId: input.sessionId, outcome: input.outcome, note: input.note?.trim() ?? '', createdAt: now };
  }

  getSessionReflection(sessionId: string): SessionReflection | null {
    const row = this.storage.raw.prepare('SELECT id, session_id AS sessionId, outcome, note, created_at AS createdAt FROM session_reflections WHERE session_id=?').get(sessionId) as { id: string; sessionId: string; outcome: ReflectionOutcome; note: string; createdAt: string } | undefined;
    return row ?? null;
  }

  recordRecovery(input: RecoveryResponseInput, focusSessionId: string | null): RecoveryEvent {
    const id = randomUUID(); const now = new Date().toISOString();
    const outcome = input.action === 'restart' ? 'returned' : input.action === 'break' ? 'break' : input.action === 'intentional' ? 'intentional' : input.action === 'replan' ? 'replanned' : input.action === 'snooze' ? 'snoozed' : 'dismissed';
    this.storage.raw.prepare('INSERT INTO recovery_events (id,focus_session_id,app_name,action,outcome,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, focusSessionId, input.appName?.trim() ?? '', input.action, outcome, now);
    return { id, focusSessionId, appName: input.appName?.trim() ?? '', action: input.action, outcome, createdAt: now };
  }

  getRecoverySummary(date = localDate()) {
    assertDate(date);
    const start = new Date(`${date}T00:00:00`).toISOString(); const end = new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString();
    const prompts = this.storage.raw.prepare('SELECT COUNT(*) AS count FROM distraction_events WHERE created_at>=? AND created_at<?').get(start, end) as { count: number };
    const rows = this.storage.raw.prepare('SELECT action, COUNT(*) AS count FROM recovery_events WHERE created_at>=? AND created_at<? GROUP BY action').all(start, end) as Array<{ action: string; count: number }>;
    const count = (action: string) => rows.find(row => row.action === action)?.count ?? 0;
    return { prompts: prompts.count, returned: count('restart'), breaks: count('break'), dismissed: count('dismiss') + count('intentional') };
  }

  reportTaskOutcomes(date: string) {
    assertDate(date); const start = new Date(`${date}T00:00:00`).toISOString(); const end = new Date(new Date(`${date}T00:00:00`).getTime() + 86400000).toISOString();
    const rows = this.storage.raw.prepare(`SELECT outcome, COUNT(*) AS count FROM session_reflections WHERE created_at>=? AND created_at<? GROUP BY outcome`).all(start, end) as Array<{ outcome: ReflectionOutcome; count: number }>;
    const count = (outcome: ReflectionOutcome) => rows.find(row => row.outcome === outcome)?.count ?? 0;
    return { completed: count('completed'), partial: count('partial'), blocked: count('blocked'), noProgress: count('no_progress') };
  }
}

interface ProfileRow { id: string; preferred_name: string; user_type: string; current_goal: string; working_days_json: string; work_start_time: string; work_end_time: string; break_start_time: string; break_end_time: string; quiet_start_time: string; quiet_end_time: string; timezone: string; communication_style: string; interaction_frequency: string; created_at: string; updated_at: string; }
interface ProjectRow { id: string; name: string; description: string; status: ProjectRecord['status']; color: string; created_at: string; updated_at: string; task_count?: number; completed_task_count?: number; }
interface TaskRow { id: string; title: string; description: string; project_id: string | null; status: TaskStatus; priority: TaskPriority; estimated_minutes: number | null; due_at: string | null; parent_task_id: string | null; sort_order: number; created_at: string; completed_at: string | null; }
interface MoodRow { id: string; mood: string; energy: number; motivation: number; support_style: string; note: string; created_at: string; }
function mapProject(row: ProjectRow): ProjectRecord { return { id: row.id, name: row.name, description: row.description, status: row.status, color: row.color, createdAt: row.created_at, updatedAt: row.updated_at, taskCount: Number(row.task_count ?? 0), completedTaskCount: Number(row.completed_task_count ?? 0) }; }
function mapTask(row: TaskRow): TaskRecord { return { id: row.id, title: row.title, description: row.description, projectId: row.project_id, status: row.completed_at && row.status === 'todo' ? 'completed' : row.status, priority: row.priority, estimatedMinutes: row.estimated_minutes, dueAt: row.due_at, parentTaskId: row.parent_task_id, sortOrder: row.sort_order, createdAt: row.created_at, completedAt: row.completed_at }; }
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function assertDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) throw new Error('A valid date in YYYY-MM-DD format is required.'); }
