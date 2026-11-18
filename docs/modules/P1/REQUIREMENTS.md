# P1 requirements and acceptance criteria

1. All companion preferences and user-created journal content persist after restart in the local SQLite database.
2. Journal entries accept only supported kinds, require a title, enforce bounded title/body lengths, and support deletion and pinning.
3. Ritual completion is explicit, timestamped, and creates a journal achievement; disabled rituals cannot be completed from the UI.
4. Personality is a deterministic response-style modifier, not generative AI. Existing quiet-hour and working-hour policies remain authoritative.
5. Weekly review is derived only from locally recorded events in the trailing seven days.
6. Basecamp selection persists and does not imply an unearned achievement. Unlock eligibility is a future progression pass.
7. Accessibility preferences persist. UI labels disclose which preferences are not yet applied globally.
8. IPC is isolated through Electron contextBridge; renderer code cannot access SQLite or Node APIs.
9. P0 data and existing database files are not dropped or recreated.
