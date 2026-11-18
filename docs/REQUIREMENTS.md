# Product requirements — V1

## Product definition

CaughtYouSlacking is a digital accountability companion. It helps a person follow through on an intention by combining activity awareness, focus sessions, contextual reminders and progress summaries. It is not intended to surveil users or to judge all activity as productive or distracting.

## Primary workflow

1. The user creates or selects a task.
2. The user starts a timed focus session.
3. With tracking explicitly enabled, the app observes the foreground application and idle duration.
4. The user chooses how applications are classified.
5. During a running focus session, a sustained application classified as distracting can trigger one gentle reminder, subject to cooldown.
6. The companion reacts to focus, potential distraction and completion events.
7. The user reviews the daily summary.

## Functional requirements

- Desktop window, system tray, notifications and a floating companion window.
- Local task and focus-session history.
- Start, pause, resume and end session states.
- Foreground process name and idle duration from Windows APIs.
- Optional window-title recording; off by default.
- Productive, distracting and unclassified application categories.
- User-editable application rules.
- Configurable distraction threshold and cooldown.
- Activity segments, daily report, settings and history deletion.
- Tracking indicator and immediate pause control.

## Acceptance criteria

- A fresh install starts with activity tracking disabled.
- The user can create a task and start a focus session.
- Pause/resume preserves elapsed focus time.
- Switching foreground windows updates the activity view when tracking is enabled.
- Idle time is excluded from active foreground duration.
- A distracting app only creates a reminder when a focus session is running and the threshold is met.
- A continuous distraction does not create a reminder every poll; cooldown is enforced.
- The report is computed from persisted activity/session records.
- Restarting the app preserves tasks, rules and history.
- User can pause tracking and delete local history.

## Out of scope for V1

Cloud accounts/sync, social accountability, partner invites, AI coaching, browser extension, website blocking, cross-platform native monitoring, screenshot capture, keystroke logging, and subscription billing.
