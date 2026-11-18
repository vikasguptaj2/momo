# CaughtYouSlacking — Master Product Roadmap

**Product direction:** A Windows-first personal productivity companion and digital friend. Scout helps users finish meaningful work while providing a consistent, supportive companion experience. The product serves developers, students and freelancers through configurable profiles, workspaces and routines.

**Current AI policy:** No AI or model inference in P0–P2 planning. Scout's current interactions are deterministic and rule-based. Any future AI proposal requires a separate product, privacy and cost decision.

## Priority definitions

- **P0 — Complete Core Companion:** Complete the core daily work loop and make the current prototype reliable.
- **P1 — Personal Relationship:** Develop Scout's personality, local memory, rituals, interactions and progression.
- **P2 — Advanced Productivity:** Add automation, browser/calendar integrations, focus protection and advanced reporting.
- **P3 — Social & Commercial Expansion:** Add shared accountability, cloud services, licensing, subscriptions and distribution operations.

## P0 — Complete Core Companion

1. **Foundation and reliability:** Preserve the current Electron/React/.NET/SQLite architecture; improve lifecycle recovery, migrations, tests, packaging and privacy controls.
2. **Profile and preferences:** Preferred name, audience profile, personal goal, work days, work hours, break hours, quiet hours, timezone, communication style and interaction frequency.
3. **Projects and tasks:** CRUD projects, archive/restore, task descriptions, statuses, priorities, deadlines, estimates, one-level subtasks and task history.
4. **Daily mission board:** Primary mission, additional tasks, 30-task cap, daily planning, carry-forward and completed mission visibility.
5. **Workspaces and routines:** Coding, Study, Writing, Design, Deep Work, Freelance and Custom presets; safe launch preview; per-workspace rules; custom routines.
6. **Focus and break engine:** Focus lifecycle, deadline prompts, extension, persisted elapsed time, timed breaks, reflections and task-outcome linking.
7. **Activity awareness:** Foreground process and idle tracking, opt-in title capture, global/workspace app rules, activity segmentation and distraction events.
8. **Recovery and accountability:** Restart, break, replan, intentional-app suppression, snooze, recovery event history and recovery reporting.
9. **Interactive deterministic Scout:** Floating companion, quick actions, branching conversations, expressions, quiet hours and preference-aware interaction frequency.
10. **Mood and energy check-ins:** User-reported mood, energy, motivation, support style and optional notes.
11. **Reports and privacy:** Daily activity and execution reports, session reflections, export, history deletion, tracking consent and data controls.

P0 completion means a user can plan a day, start a workspace, work in focus sessions, take timed breaks, recover from distractions, interact with Scout and review results.

## P1 — Personal Relationship & Companion Progression

12. **Personality and relationship engine:** Scout identity, authored dialogue styles, welcome-back experiences and meaningful relationship milestones.
13. **Local memory and journal:** User-approved memories, daily journal, personal notes, achievements, searchable entries and memory controls.
14. **Daily rituals:** Optional morning, work, break and evening check-ins with snooze/quiet controls.
15. **Companion interaction and animation:** Petting, gestures, mini interactions, richer expression states, optional voice lines and sound controls.
16. **Adventure and basecamp:** Scout's home, locations, expeditions, collections and progress-linked unlocks.
17. **Weekly review:** Weekly plan outcomes, unfinished commitments, recovery trends, reflections and next-week planning.
18. **Accessibility and personalization:** Keyboard support, reduced motion, scalable companion, contrast and accessibility settings.

## P2 — Advanced Productivity

19. **Routine automation:** Scheduled and multi-step routines, conditional steps, recurrence, run history and recovery.
20. **Advanced workspaces:** Launch groups, richer app profiles, import/export, workspace recovery and analytics.
21. **Browser awareness:** Optional browser extension, domain-level activity, website rules and allowlists.
22. **Calendar integrations:** Authorized calendar connection, work blocks, meeting awareness and due-date synchronization.
23. **Focus protection:** Optional application/site blocking, focus profiles, break override and exception controls.
24. **Advanced analytics and export:** Project-level trends, estimate accuracy, recovery analysis, CSV/PDF, backup and restore.
25. **Customization:** Themes, companion appearance, environments, custom presets and notification styles.

## P3 — Social & Commercial Expansion

26. **Scout Together:** Friend invitation, shared focus rooms, presence, check-ins and shared milestones.
27. **Couple and accountability partners:** Shared goals, partner encouragement, private messages and shared routines.
28. **Study groups and teams:** Private groups, group challenges, milestones and membership controls.
29. **Cloud accounts and synchronization:** Authentication, devices, cloud backup, sync, conflict resolution, export and deletion.
30. **Monetization and licensing:** Free tier, personal lifetime licence, optional recurring service plans, activation, entitlements, billing and refunds.
31. **Commercial distribution:** Code signing, installer/update channel, crash reporting opt-in, onboarding, support and feedback.

## Product rules across every priority

- Scout is a companion, never a supervisor or surveillance tool.
- The user controls activity tracking, data retention, interaction frequency and sharing.
- Application activity is not treated as proof of attention or output.
- Missed days do not punish the user or reduce Scout's affection.
- Companion rewards should recognize meaningful progress, not screen time.
- Features are implemented in dependency order and accepted through documented tests.
- No module is considered complete until requirements, UI states, validation, persistence, error handling and tests are updated.
