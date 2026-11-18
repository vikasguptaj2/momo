CREATE TABLE IF NOT EXISTS break_sessions (
  id TEXT PRIMARY KEY,
  focus_session_id TEXT,
  kind TEXT NOT NULL DEFAULT 'short',
  planned_minutes INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  resumed_at TEXT,
  ended_at TEXT,
  accumulated_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_break_started ON break_sessions(started_at);
