# Testing and validation

Run on Windows with the dependencies installed:

```powershell
npm run typecheck
npm test
npm run build
```

The Vitest suite covers app classification, distraction threshold/cooldown logic, activity segmentation and milestone unlock rules. A Windows smoke test should also verify:

1. The app starts with tracking disabled.
2. Tracking starts only after explicit consent.
3. Foreground app sampling stops when tracking is disabled.
4. Window-title capture remains off unless enabled.
5. A distracting app only triggers a reminder during a running focus session and respects the cooldown.
6. Focus sessions can start, pause, resume, complete and end early.
7. Scout changes expressions on focus, productive, distraction, idle, welcome and completion events.
8. Milestones unlock once and persist across app restarts.
9. Daily reports reflect the selected local date.
10. Clearing history removes activity/focus/reminder records but leaves preferences and app rules.

The packaged monitor and NSIS installer must be built and smoke-tested on Windows x64. The source archive does not include a signed, prebuilt installer.
