CREATE TABLE IF NOT EXISTS idle_segments (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idle_started ON idle_segments(started_at);
