import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { schema, appRules } from './schema.js';
import { eq } from 'drizzle-orm';

const DDL = `
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', color TEXT NOT NULL DEFAULT '#D6A84B', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', project_id TEXT, status TEXT NOT NULL DEFAULT 'todo', priority TEXT NOT NULL DEFAULT 'medium', estimated_minutes INTEGER, due_at TEXT, parent_task_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE IF NOT EXISTS focus_sessions (id TEXT PRIMARY KEY, task_id TEXT, task_title TEXT NOT NULL, started_at TEXT NOT NULL, resumed_at TEXT, ended_at TEXT, planned_minutes INTEGER NOT NULL, accumulated_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, workspace_run_id TEXT);
CREATE TABLE IF NOT EXISTS break_sessions (id TEXT PRIMARY KEY, focus_session_id TEXT, kind TEXT NOT NULL DEFAULT 'short', planned_minutes INTEGER NOT NULL, started_at TEXT NOT NULL, resumed_at TEXT, ended_at TEXT, accumulated_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity_segments (id TEXT PRIMARY KEY, app_name TEXT NOT NULL, window_title TEXT, category TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, duration_seconds INTEGER NOT NULL, focus_session_id TEXT);
CREATE TABLE IF NOT EXISTS idle_segments (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, duration_seconds INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS app_rules (app_name TEXT PRIMARY KEY, category TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS distraction_events (id TEXT PRIMARY KEY, app_name TEXT NOT NULL, created_at TEXT NOT NULL, focus_session_id TEXT, message TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS companion_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS milestones (code TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, achieved_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_presets (id TEXT PRIMARY KEY, name TEXT NOT NULL, config_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_runs (id TEXT PRIMARY KEY, preset_id TEXT, preset_name TEXT NOT NULL, task_title TEXT NOT NULL, focus_minutes INTEGER NOT NULL, status TEXT NOT NULL, launch_results_json TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, focus_session_id TEXT, config_snapshot_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS workspace_app_rules (preset_id TEXT NOT NULL, app_name TEXT NOT NULL, category TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(preset_id, app_name));
CREATE TABLE IF NOT EXISTS user_profile (id TEXT PRIMARY KEY, preferred_name TEXT NOT NULL, user_type TEXT NOT NULL, current_goal TEXT NOT NULL, working_days_json TEXT NOT NULL, work_start_time TEXT NOT NULL, work_end_time TEXT NOT NULL, break_start_time TEXT NOT NULL, break_end_time TEXT NOT NULL, quiet_start_time TEXT NOT NULL, quiet_end_time TEXT NOT NULL, timezone TEXT NOT NULL, communication_style TEXT NOT NULL, interaction_frequency TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mood_checkins (id TEXT PRIMARY KEY, mood TEXT NOT NULL, energy INTEGER NOT NULL, motivation INTEGER NOT NULL, support_style TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_plan_items (date TEXT NOT NULL, task_id TEXT NOT NULL, kind TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, PRIMARY KEY(date, task_id));
CREATE TABLE IF NOT EXISTS session_reflections (id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, outcome TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_events (id TEXT PRIMARY KEY, focus_session_id TEXT, app_name TEXT NOT NULL, action TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', steps_json TEXT NOT NULL, is_built_in INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routine_runs (id TEXT PRIMARY KEY, routine_id TEXT NOT NULL, routine_name TEXT NOT NULL, steps_json TEXT NOT NULL, current_step_index INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT);
CREATE INDEX IF NOT EXISTS idx_routine_runs_status ON routine_runs(status, started_at);
CREATE INDEX IF NOT EXISTS idx_activity_started ON activity_segments(started_at);
CREATE INDEX IF NOT EXISTS idx_idle_started ON idle_segments(started_at);
CREATE INDEX IF NOT EXISTS idx_focus_started ON focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_break_started ON break_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_distraction_created ON distraction_events(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_mood_created ON mood_checkins(created_at);
CREATE INDEX IF NOT EXISTS idx_recovery_created ON recovery_events(created_at);
CREATE INDEX IF NOT EXISTS idx_plan_date ON daily_plan_items(date, sort_order);
`;

const DEFAULT_PROFILE = {
  id: 'local', preferred_name: 'Friend', user_type: 'custom', current_goal: '', working_days_json: '[1,2,3,4,5]',
  work_start_time: '09:00', work_end_time: '18:00', break_start_time: '13:00', break_end_time: '14:00',
  quiet_start_time: '22:00', quiet_end_time: '08:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  communication_style: 'gentle', interaction_frequency: 'normal'
};

export class Storage {
  readonly raw: Database.Database;
  readonly db: BetterSQLite3Database<typeof schema>;

  constructor() {
    const path = join(app.getPath('userData'), 'caught-you-slacking.sqlite');
    this.raw = new Database(path);
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.exec(DDL);
    // Upgrade existing installs in place. New columns are nullable or have safe defaults.
    this.ensureColumn('focus_sessions', 'workspace_run_id', 'TEXT');
    this.ensureColumn('workspace_runs', 'config_snapshot_json', "TEXT NOT NULL DEFAULT '{}'");
    this.ensureColumn('tasks', 'description', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('tasks', 'project_id', 'TEXT');
    this.ensureColumn('tasks', 'status', "TEXT NOT NULL DEFAULT 'todo'");
    this.ensureColumn('tasks', 'priority', "TEXT NOT NULL DEFAULT 'medium'");
    this.ensureColumn('tasks', 'estimated_minutes', 'INTEGER');
    this.ensureColumn('tasks', 'due_at', 'TEXT');
    this.ensureColumn('tasks', 'parent_task_id', 'TEXT');
    this.ensureColumn('tasks', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
    this.raw.exec("UPDATE tasks SET status = 'completed' WHERE completed_at IS NOT NULL AND status = 'todo'");
    this.db = drizzle(this.raw, { schema });
    this.seedRules();
    this.seedSettings();
    this.seedProfile();
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const columns = this.raw.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!columns.some(item => item.name === column)) this.raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private seedRules() {
    const defaults = [
      ['Code.exe', 'productive'], ['devenv.exe', 'productive'], ['notepad.exe', 'productive'], ['WindowsTerminal.exe', 'productive'], ['powershell.exe', 'productive'], ['pwsh.exe', 'productive'],
      ['Instagram.exe', 'distracting'], ['TikTok.exe', 'distracting']
    ] as const;
    for (const [appName, category] of defaults) {
      const existing = this.db.select().from(appRules).where(eq(appRules.appName, appName)).get();
      if (!existing) this.db.insert(appRules).values({ appName, category, updatedAt: new Date().toISOString() }).run();
    }
  }

  private seedSettings() {
    const defaults: Record<string, unknown> = { onboardingCompleted: false, trackingEnabled: false, captureWindowTitles: false, showCompanion: true, distractionThresholdSeconds: 10, reminderCooldownSeconds: 60, idleThresholdSeconds: 60 };
    const insert = this.raw.prepare('INSERT OR IGNORE INTO user_settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaults)) insert.run(key, JSON.stringify(value));
  }

  private seedProfile() {
    const columns = Object.keys(DEFAULT_PROFILE);
    const placeholders = columns.map(() => '?').join(', ');
    this.raw.prepare(`INSERT OR IGNORE INTO user_profile (${columns.join(', ')}, created_at, updated_at) VALUES (${placeholders}, ?, ?)`)
      .run(...Object.values(DEFAULT_PROFILE), new Date().toISOString(), new Date().toISOString());
  }

  close() { this.raw.close(); }
}
