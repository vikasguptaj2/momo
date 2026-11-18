CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE IF NOT EXISTS focus_sessions (id TEXT PRIMARY KEY, task_id TEXT, task_title TEXT NOT NULL, started_at TEXT NOT NULL, resumed_at TEXT, ended_at TEXT, planned_minutes INTEGER NOT NULL, accumulated_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity_segments (id TEXT PRIMARY KEY, app_name TEXT NOT NULL, window_title TEXT, category TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, duration_seconds INTEGER NOT NULL, focus_session_id TEXT);
CREATE TABLE IF NOT EXISTS app_rules (app_name TEXT PRIMARY KEY, category TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS distraction_events (id TEXT PRIMARY KEY, app_name TEXT NOT NULL, created_at TEXT NOT NULL, focus_session_id TEXT, message TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS companion_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_activity_started ON activity_segments(started_at);
CREATE INDEX IF NOT EXISTS idx_focus_started ON focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_distraction_created ON distraction_events(created_at);

