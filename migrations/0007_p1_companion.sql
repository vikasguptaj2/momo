-- P1: local companion relationship, journal, rituals and progression.
CREATE TABLE IF NOT EXISTS scout_journal (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]', pinned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scout_journal_created ON scout_journal(created_at DESC);
CREATE TABLE IF NOT EXISTS scout_rituals (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, ritual_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  time_of_day TEXT NOT NULL DEFAULT '', steps_json TEXT NOT NULL DEFAULT '[]', last_completed_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scout_ritual_completions (
  id TEXT PRIMARY KEY, ritual_id TEXT NOT NULL, completed_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS scout_unlocks (
  code TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, unlocked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scout_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
