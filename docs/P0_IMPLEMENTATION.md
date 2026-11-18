# P0 — Complete Core Companion

**Release:** 0.2.0  
**Platform:** Windows-first desktop  
**AI:** Not included. All companion interactions in P0 are deterministic, rule-based and offline-capable.

P0 turns the existing activity-monitoring prototype into a complete daily execution loop for developers, students and freelancers. The product remains local-first: activity tracking starts off, window-title capture starts off, and no keystrokes, screenshots, clipboard contents or browser history are collected.

## P0 release definition

A user can create a profile, create projects and tasks, select daily missions, choose and launch a workspace, complete focus and break sessions, receive contextual recovery choices, interact with Scout through predefined flows, record a mood check-in and session reflection, and review a daily execution report. Local history can be exported or deleted.

## Modules and implementation map

| Module | Scope | Main implementation |
|---|---|---|
| 0. Foundation | Existing app stability, SQLite, activity monitor, focus lifecycle, privacy and packaging | `src/main/index.ts`, `src/main/database/`, `src/main/services/`, `native/` |
| 1. Profile & preferences | Preferred name, user type, goal, work days/hours, break hours, quiet hours, timezone, communication style and interaction frequency | `src/main/services/productivity.ts`, `src/renderer/P0Pages.tsx` |
| 2. Projects & tasks | Projects, archive status, task description, priority, status, due date, estimate, one-level subtasks and editing | `src/main/services/productivity.ts`, `src/renderer/P0Pages.tsx` |
| 3. Daily missions | Daily primary mission, additional missions, 30-item cap, carry-forward and completion visibility | `src/main/services/productivity.ts`, `src/renderer/P0Pages.tsx` |
| 4. Workspaces & routines | Multiple workspace templates, launch preview/confirmation, app-rule overrides, custom routines, active routine run | `src/main/services/workspace.ts`, `src/main/services/routines.ts`, `src/renderer/WorkspacePage.tsx`, `src/renderer/P0Pages.tsx` |
| 5. Focus & breaks | Focus lifecycle, checkpointing, restart recovery, timer deadline/extension, timed breaks, task reflection and linked workspace run | `src/main/services/focus.ts`, `src/main/services/breaks.ts`, `src/renderer/App.tsx` |
| 6. Activity awareness | Foreground process, idle time, configurable app classification, workspace overrides, segmented activity, distraction events | `src/main/services/activity.ts`, `src/main/engines/`, `native/` |
| 7. Recovery | Restart, timed break, replan, intentional-app suppression and 10-minute snooze | `src/main/services/recovery.ts`, `src/main/services/activity.ts` |
| 8. Deterministic Scout | Floating companion, quick actions, branching interaction flows, workday/quiet-hour behaviour and companion states | `src/main/services/companion.ts`, `src/renderer/P0Pages.tsx`, `src/renderer/companion.tsx` |
| 9. Mood check-ins | Self-reported mood, energy, motivation, support style and optional note | `src/main/services/productivity.ts`, `src/renderer/P0Pages.tsx` |
| 10. Reports & privacy | Activity, focus, missions, reflections, recovery and break metrics; JSON export; local history deletion | `src/main/services/activity.ts`, `src/main/ipc.ts`, `src/renderer/App.tsx` |

## Important behaviour rules

- Completing a focus timer does **not** automatically mark its linked task complete. The user records a reflection; only a `completed` reflection marks the task complete.
- Starting a timed break pauses a running focus session and associates the break with that focus session.
- An interrupted break is restored as paused at application restart. It does not silently continue while the app is closed.
- A focus session cannot be ended while a break is active. The user must complete or cancel the break first.
- Workspace-specific app classifications override global rules only while the related workspace run is active. Unlisted apps remain unclassified.
- Activity intervals are closed when the foreground app or active focus-session context changes, so elapsed time is not attributed to the wrong app or session.
- Recovery `snooze` suppresses distraction prompts for ten minutes. `intentional` suppresses prompts for the current app until the user switches away.
- Scout's `celebrate` interaction never ends or completes a focus session.
- Mood is self-reported. Scout does not diagnose mood or infer emotional state from desktop activity.
- Tracking is opt-in. Window-title capture is separately opt-in.
- Workspace launching uses user-selected paths and does not execute arbitrary shell commands or close applications.

## Acceptance checklist

### Foundation and privacy
- [ ] Install and launch on Windows 10/11 x64.
- [ ] Activity tracking is off on first launch.
- [ ] Window-title capture is off on first launch.
- [ ] Tracking pause/disable stops new monitoring and flushes the current activity interval.
- [ ] Local history export includes current P0 tables and reports schema version 2.
- [ ] History deletion is blocked while a focus session or break is active.
- [ ] History deletion removes activity/session/run/companion history while retaining profile, task and workspace definitions.

### Profile, tasks and daily missions
- [ ] Profile preferences persist after restart.
- [ ] Working days, work hours, break hours, quiet hours and timezone can be edited.
- [ ] Projects can be created, edited, archived and restored by showing archived projects.
- [ ] Tasks can be created, edited, assigned to projects and given priorities, due dates and estimates.
- [ ] Subtasks inherit/validate project association and are limited to one level.
- [ ] Daily plan supports one primary mission and up to 30 selected tasks.
- [ ] Unfinished missions can be carried forward without duplicating existing missions.

### Workspaces and routines
- [ ] Multiple workspace presets can be created from templates and edited independently.
- [ ] Workspace app rules override global rules for the active workspace only.
- [ ] Required application/project validation blocks launch preview when missing.
- [ ] Optional terminal and HTTPS documentation failures are surfaced without hiding other results.
- [ ] User confirms a launch preview before applications open.
- [ ] Workspace runs are linked to focus sessions and historical snapshots are retained.
- [ ] Built-in and custom routines can be started, advanced and cancelled.
- [ ] Routine focus/break steps cannot be marked complete while their corresponding session is active.

### Focus, activity and recovery
- [ ] Focus can start, pause, resume, complete or cancel.
- [ ] Focus state is recovered safely after restart as paused.
- [ ] Timer expiry notifies but does not auto-complete a task or session.
- [ ] Focus can be extended within the configured 5–60 minute range.
- [ ] Timed breaks support start, pause, resume, completion and cancellation.
- [ ] Starting a break pauses a running focus session.
- [ ] Activity intervals are attributed to the correct app and focus context.
- [ ] Unknown apps remain unclassified.
- [ ] Distraction prompts respect threshold, idle state, snooze and cooldown.
- [ ] Recovery choices have real, auditable effects.

### Scout, mood and reports
- [ ] Scout quick interactions provide branching, deterministic flows.
- [ ] Scout can navigate to missions, workspaces and focus room.
- [ ] Scout celebration does not end a focus session.
- [ ] Mood check-ins persist and are editable/deletable through local data controls.
- [ ] Daily report shows activity, focus, missions, outcomes, recoveries and breaks distinctly.
- [ ] Reports do not claim application time proves attention or output quality.

## Validation status

The source package has been syntax-parsed with the globally available TypeScript compiler. SQLite DDL/migration and source-level smoke checks are performed as part of packaging. Full dependency-backed typechecking, Vitest execution, Electron build, native .NET publish, and real Windows runtime testing require installing project dependencies and running the build on a Windows machine. These are not claimed as completed when package-registry access is unavailable.
