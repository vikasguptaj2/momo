# Local database

SQLite tables:

- `tasks`: user intentions and completion timestamps.
- `focus_sessions`: planned duration, accumulated elapsed time and lifecycle status.
- `activity_segments`: foreground process, optional window title, category and observed duration.
- `app_rules`: user-defined productive/distracting/unclassified classification.
- `distraction_events`: local record of gentle nudges.
- `companion_events`: Scout state and message history.
- `milestones`: persistent unlocked field badges.
- `user_settings`: privacy and reminder preferences stored as JSON values.

`migrations/0001_init.sql` creates the core tables. `migrations/0002_milestones.sql` adds persistent milestone records. Runtime startup also uses idempotent `CREATE TABLE IF NOT EXISTS` statements so an existing local database receives the new table automatically.

## Coding Workspace

- `workspace_presets` stores the built-in Coding Workspace configuration as local JSON.
- `workspace_runs` records each confirmed launch and its per-item result summary.
- `focus_sessions.workspace_run_id` links a focus session to the workspace run that started it.

The application creates the workspace tables at startup and adds `workspace_run_id` to an existing `focus_sessions` table when upgrading an older local database.
