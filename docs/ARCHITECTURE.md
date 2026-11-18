# Architecture

```text
Electron main process
 ├─ SQLite storage (better-sqlite3 + Drizzle schema)
 ├─ Settings + task + focus services
 ├─ Activity service + classification engine
 ├─ Distraction engine + notifications
 ├─ Milestone service
 ├─ Companion service (always-on-top BrowserWindow)
 └─ Monitor service
      └─ .NET 10 WindowsMonitor.exe / dotnet run
           └─ Win32 foreground process + idle-time APIs

Preload (contextBridge)
 └─ typed, explicit CysApi; no Node access in renderer

Renderer (React + TypeScript)
 ├─ Overview / awareness
 ├─ Focus room / session lifecycle
 ├─ Activity timeline / app rules
 ├─ Daily reports / insights
 ├─ Scout dashboard and floating companion
 └─ Settings / privacy controls
```

The monitor emits newline-delimited JSON. Main-process code validates samples before the activity service processes them. The renderer communicates through explicit IPC methods exposed by preload. SQLite is stored under Electron's `userData` directory. No remote service or API key is required.

## Workspace launch flow

The Workspaces page uses a dedicated `WorkspaceService` in the Electron main process. It persists the built-in Coding Workspace configuration and launch runs in SQLite, validates selected executable and folder paths, and launches `.exe` files through `child_process.spawn()` with `shell: false`. The React renderer can only request native pickers, a launch preview, and an explicit confirmed start through narrow preload IPC methods. Workspace runs are linked to focus sessions through `focus_sessions.workspace_run_id`.
