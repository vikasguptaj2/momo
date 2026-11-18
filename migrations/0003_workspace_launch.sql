ALTER TABLE focus_sessions ADD COLUMN workspace_run_id TEXT;

CREATE TABLE IF NOT EXISTS workspace_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_runs (
  id TEXT PRIMARY KEY,
  preset_id TEXT,
  preset_name TEXT NOT NULL,
  task_title TEXT NOT NULL,
  focus_minutes INTEGER NOT NULL,
  status TEXT NOT NULL,
  launch_results_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  focus_session_id TEXT
);
