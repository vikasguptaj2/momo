CREATE TABLE IF NOT EXISTS milestones (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  achieved_at TEXT NOT NULL
);
