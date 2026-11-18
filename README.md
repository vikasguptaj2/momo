# CaughtYouSlacking

**A personal productivity companion and digital friend.**

CaughtYouSlacking is a Windows-first desktop application for developers, students, freelancers and remote workers. Scout helps users plan meaningful work, prepare repeatable workspaces, stay accountable during focus sessions, recover from interruptions and recognize progress.

The current P0 release is deterministic and AI-free. Scout's interactions use user preferences, explicit check-ins, application events and authored conversation flows. No LLM is required or bundled.

## Product loop

**Plan a mission → Prepare a workspace → Work with Scout → Recover when distracted → Complete meaningful work → Reflect → Review progress.**

## P0 capabilities

| System | Included functionality |
|---|---|
| Foundation | Electron desktop shell, Windows .NET activity helper, SQLite persistence, migrations, typed IPC and local-first operation |
| Profile & onboarding | Preferred name, user type, goals, working days/hours, break and quiet hours, timezone, communication style, activity-tracking consent |
| Projects & tasks | Projects, archive/restore, tasks, descriptions, priorities, due dates, estimates, subtasks, edit/delete/status management |
| Daily missions | One primary mission, additional missions, planning limits, carry-forward and completion state |
| Workspaces | Multiple Coding, Study, Writing, Design, Deep Work, Freelance and Custom presets; application/project selection; launch preview and explicit confirmation; app-rule overrides; workspace run history |
| Routines | Starter and custom routines with focus, break, workspace, mission-review and reflection steps; persisted routine history |
| Focus & breaks | Start, pause, resume, complete/cancel, timer checkpoint/restart recovery, duration extension, timed break sessions and session reflections |
| Activity awareness | Foreground process tracking, optional window-title capture, long-idle intervals after a configurable threshold, activity segmentation and application classification |
| Recovery | Restart, timed break, replan, intentional-app suppression, snooze, dismissal and recovery outcome history |
| Scout companion | Floating companion, expression states, quick actions, deterministic branching conversations, communication preferences and quiet-hour awareness |
| Mood check-ins | Explicit user-reported mood, energy, motivation and support style; no mood inference from app usage |
| Reports | Foreground-app duration, long idle, focus/break time, mission outcomes, session reflections, recovery prompts and top applications |
| Privacy & portability | Tracking off by default, window-title capture off by default, local JSON export, history deletion and opt-in controls |

## Privacy principles

- Activity tracking is off until the user enables it.
- Window-title capture is a separate opt-in and is off by default.
- The monitor does not capture keystrokes, screenshots, clipboard contents or browser history.
- Application classification is user-controlled. Unlisted applications remain unclassified.
- Long-idle time is reported separately after the configured idle threshold; foreground-application duration is not presented as proof of attention or output.
- Scout's mood context comes from the user's own check-ins, not inferred psychological states.
- Workspace launching opens only user-selected applications, folders and validated HTTPS documentation links. It does not execute arbitrary shell commands or close applications.
- Personal data remains in the local SQLite database in P0. No cloud account or AI provider is required.

## Technology

- **Desktop:** Electron, React, TypeScript, Vite
- **Windows integration:** .NET / C# helper using Win32 foreground-window and idle-time APIs
- **Persistence:** SQLite through better-sqlite3 and Drizzle
- **Validation:** Zod for IPC and shared inputs
- **Tests:** Vitest unit tests and SQLite integration tests
- **Packaging:** electron-builder NSIS installer configuration for Windows x64

## Requirements

- Windows 10/11 x64 for full Windows monitoring and application launching.
- Node.js 22.12 or newer (Node 24 is also suitable).
- npm 10 or newer.
- .NET 10 SDK for building the native monitor helper.

## Development

```powershell
npm install
npm run dev
```

Run available checks:

```powershell
npm run typecheck
npm test
npm run build
```

Build the native monitor and Windows installer on a Windows machine:

```powershell
npm run native:publish
npm run dist:win
```

See `BUILD_VALIDATION.md` for the checks performed on this source bundle and the checks that still require a Windows development environment.

## Product roadmap and module tracking

- `docs/PRODUCT_VISION.md` — product identity and principles.
- `docs/MASTER_ROADMAP.md` — P0 through P3 product plan.
- `docs/MODULE_REGISTRY.md` — module-by-module implementation status and release gates.
- `docs/P0_IMPLEMENTATION.md` — P0 requirements, behaviour rules and acceptance criteria.
- `docs/WORKSPACE_LAUNCH.md` — Windows workspace launch design and security boundaries.

P1 relationship progression, P2 advanced productivity integrations and P3 social/cloud/monetization features remain planned; they are not represented as completed P0 functionality.

## License

MIT. See [LICENSE](LICENSE).
