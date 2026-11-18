# Coding Workspace launch flow

The Workspaces page provides a Windows-first launch preview for a reusable Coding Workspace setup.

## User flow

1. The user chooses a VS Code `.exe` and an existing project folder.
2. The user may optionally choose a terminal executable and an HTTPS documentation URL.
3. The user sets the session intention, focus duration, break suggestion and Scout presence mode.
4. **Preview launch** saves the local preset and asks the main process to validate every configured path and the current focus-session state.
5. The preview lists required and optional launch items. The user must explicitly confirm before any app or URL is opened.
6. On confirmation, the main process launches VS Code with the project folder as its argument and working directory. It then attempts the optional terminal and documentation URL.
7. If the required IDE launch fails, no focus session is started. Optional launch failures are reported but do not block the focus session.
8. If the IDE launch succeeds, a task and focus session are created and linked to a workspace run.

## Privacy and safety

- Activity tracking is never enabled by a workspace launch.
- Launching uses `spawn()` with an argument array and `shell: false`.
- Only user-selected `.exe` files are launched.
- Documentation links must use HTTPS.
- No scripts, shell commands, administrator elevation, or automatic application closing are supported.
- The local preset and launch history are stored in SQLite.

## Database upgrade

`Storage` creates the workspace tables and checks for `focus_sessions.workspace_run_id` at startup. Existing local activity and focus history are preserved; the additional column is added in place.

## Current scope

This implementation includes one built-in Coding Workspace preset. The database and UI flow are designed so additional presets and launch-item types can be added later. Per-workspace app-rule overrides, complete break cycling and workspace-run history screens are not included in this implementation.
