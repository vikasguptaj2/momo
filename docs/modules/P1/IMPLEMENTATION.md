# P1 — Scout relationship and companion progression

## Implemented in this source bundle

- **Personality & relationship:** local personality selection (supportive, curious, playful, cheeky), interaction-frequency preference, deterministic message adaptation in the existing companion event pipeline. Existing profile working-hours and quiet-hours gates remain in force.
- **Local memory & journal:** user-authored memory, note and reflection entries; pin/unpin and delete; local SQLite storage; 100 most recent entries shown.
- **Daily rituals:** seeded morning intention, workday check-in and evening reflection rituals; step lists, completion timestamps, optional completion note and journal achievement entry.
- **Companion interaction settings:** sound and voice preference flags. Voice is not represented as an active speech engine in this build; it is a future integration point.
- **Adventure/basecamp foundation:** local equipment selection and seeded environments/accessories. This release provides the equip loop; unlock eligibility and new art/content packs are not yet tied to achievements.
- **Weekly review:** seven-day aggregates for focus sessions/time, completed missions, recovery returns and ritual completions. Empty data is shown as zero, not inferred as user inactivity.
- **Accessibility preferences:** reduced motion, high contrast and text scale are persisted. The settings screen clearly identifies that app-wide application to every P0 surface remains follow-up work.

## Architecture

`P1Service` owns P1 SQLite tables and validation. IPC exposes narrow `p1:*` methods through the preload bridge. The renderer never receives direct database access. New tables are created idempotently at startup and are also described in `migrations/0007_p1_companion.sql`. Existing P0 tables and services are retained.

## Deliberate scope boundaries

No AI, LLM, cloud calls, account system, network dependency, keystroke capture, screenshots or hidden mood inference are introduced. Journal content is explicitly user-authored. Mood or personal facts are never inferred from app usage. Voice lines are a stored preference only; no speech runtime is included. Adventure progression currently includes starter equipment and environments, not a full game economy. These are documented boundaries rather than falsely claimed completed functionality.

## Windows validation

Run from `caught-you-slacking` on Windows with Node.js >=22.12:

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run dist:win
```

The Linux packaging environment used to prepare this source archive does not include Windows .NET runtime packaging or Electron native rebuild validation. Build and installer verification must be performed on the target Windows machine.
