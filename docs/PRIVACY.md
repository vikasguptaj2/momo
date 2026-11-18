# Privacy model

CaughtYouSlacking is local-first. Activity monitoring is disabled by default and starts only after an explicit user action. The app records the foreground process name and timing. Window titles are an opt-in setting because they may contain private filenames, meeting names or URLs.

The monitor does not collect keystroke contents, screenshots, browser history, clipboard data, camera or microphone input. Idle time is excluded from active app totals according to the user's configured threshold. Data is stored in a SQLite file in Electron's local `userData` directory; no remote telemetry or cloud sync is implemented.

Users can stop tracking, disable the floating companion, adjust distraction thresholds and cooldowns, and delete activity/focus/reminder history. Deleting history does not delete application rules and preferences.
