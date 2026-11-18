# Core feature map

## Awareness

The .NET helper samples the foreground process every second and calculates time since the last user input. The Electron activity service groups samples into bounded app segments, excludes idle time after the configured threshold and classifies applications using local rules. Window titles are retained only when the user enables that setting.

## Accountability

The distraction engine evaluates a sample only during a running focus session. It uses the user's app category, distraction threshold, idle threshold and reminder cooldown. A triggered event is persisted locally and sent to the native desktop notification service and Scout companion.

## Focus

A user can create a task from the dashboard or Focus room and start a timed session. Sessions support pause, resume, complete and end-early actions. Completed sessions are stored with planned time and accumulated elapsed seconds.

## Companionship

Scout is presented in the main dashboard and in a separate always-on-top transparent Electron window. The companion uses the provided Scout artwork and selects an expression for welcome, focus, productive, distraction, idle, break and completion events. The window can be moved, hidden or disabled from Settings.

## Motivation

Milestones are persisted in SQLite and unlocked from completed sessions and tasks:

- First Steps — one completed focus session.
- Finding Your Rhythm — five completed focus sessions.
- One Hour Strong — one hour of accumulated completed focus time.
- Task Finisher — five completed tasks.
- Scout Pathfinder — ten completed focus sessions.

Milestones are personal progress markers; they do not punish missed days or compare users.

## Insights

The daily report is date-selectable and summarises observed active app time, productive/distracting/unclassified split, focus time, started/completed sessions, reminder count and the five applications with the most observed time. The report uses local records only.
