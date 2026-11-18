# CaughtYouSlacking Module Registry

This is the feature traceability register for the product roadmap. A planned module is not complete merely because it appears in the roadmap. Update its status only after implementation, tests and acceptance review.

Status meanings:
- **Implemented in source** — code and UI are present; runtime validation may still be pending.
- **Partially implemented** — some capability exists but the defined scope is incomplete.
- **Planned** — not implemented in the current source release.
- **Validated** — acceptance checks have passed in the target Windows environment.

## P0 — Complete Core Companion

| ID | Module | Status in this bundle | Main acceptance outcome |
|---|---|---|---|
| P0.0 | Existing foundation and reliability | Implemented in source; Windows validation pending | Existing app, monitor, storage, focus and privacy paths survive routine lifecycle events |
| P0.1 | User profile and personalization | Implemented in source; Windows validation pending | Profile, onboarding, schedule and communication preferences persist |
| P0.2 | Projects, tasks and subtasks | Implemented in source; Windows validation pending | Projects/tasks can be created, edited, archived, restored and completed |
| P0.3 | Daily Mission Board | Implemented in source; Windows validation pending | Primary and additional missions can be planned, completed and carried forward |
| P0.4 | Focus and timed breaks | Implemented in source; Windows validation pending | Focus and break sessions have safe lifecycle, checkpoints, reflections and history |
| P0.5 | Workspaces and routines | Implemented in source; Windows validation pending | Multiple presets, app overrides, launch confirmation, routines and run history work |
| P0.6 | Activity awareness and rules | Implemented in source; Windows validation pending | Foreground app intervals and long idle are reported separately and classified by rules |
| P0.7 | Recovery and accountability | Implemented in source; Windows validation pending | Restart, break, replan, intentional, snooze and dismissal have auditable effects |
| P0.8 | Deterministic Scout companion | Implemented in source; Windows validation pending | Quick actions and branching flows execute real app actions without AI |
| P0.9 | Mood and energy check-ins | Implemented in source; Windows validation pending | Explicit self-reported check-ins influence companion messaging |
| P0.10 | Reports, privacy and portability | Implemented in source; Windows validation pending | Activity, missions, recovery, breaks and reflections are reported; local export/delete work |

## P1 — Personal Relationship and Companion Progression

| ID | Module | Status | Planned acceptance outcome |
|---|---|---|---|
| P1.1 | Scout personality and relationship engine | Planned | Consistent identity, user-selected communication style and milestone recognition |
| P1.2 | Scout memory and personal journal | Planned | User-approved local memories, journal entries, review, edit and deletion |
| P1.3 | Daily rituals and routines | Planned | Configurable morning, work, break and evening rituals |
| P1.4 | Interaction and animation system | Planned | Rich character gestures, animations, optional voice and accessible controls |
| P1.5 | Adventure, basecamp and gamification | Planned | Progress-linked expeditions, environments, collections and cosmetics |
| P1.6 | Weekly review and behavioural insights | Planned | Weekly review using transparent deterministic statistics |
| P1.7 | Accessibility and personalization | Planned | Reduced motion, keyboard controls, scalable UI and accessibility preferences |

## P2 — Advanced Productivity

| ID | Module | Status | Planned acceptance outcome |
|---|---|---|---|
| P2.18 | Advanced routine automation | Planned | Scheduled, conditional and multi-step routines with permission gates |
| P2.19 | Advanced workspace automation | Planned | Robust launch groups, import/export, recovery and workspace analytics |
| P2.20 | Browser awareness and website control | Planned | Optional extension with domain-level awareness and user-defined rules |
| P2.21 | Calendar and external integrations | Planned | Authorized calendar and task integrations |
| P2.22 | Advanced focus protection | Planned | Optional application/website blocking with override and emergency exit |
| P2.23 | Advanced analytics and export | Planned | Project/time trends, CSV/PDF and backups |
| P2.24 | Product customization | Planned | Companion, environment, theme and workspace customization |

## P3 — Social and Commercial Expansion

| ID | Module | Status | Planned acceptance outcome |
|---|---|---|---|
| P3.25 | Scout Together | Planned | Private invitations and shared focus rooms |
| P3.26 | Couples and accountability partners | Planned | Shared goals, private messages and consent-based celebrations |
| P3.27 | Study groups and team accountability | Planned | Private groups, challenges and membership controls |
| P3.28 | Cloud accounts and synchronization | Planned | Secure accounts, local-first sync, backup and deletion |
| P3.29 | Monetization and licensing | Planned | Sustainable lifetime entitlement, subscription billing and licence management |
| P3.30 | Release and customer experience | Planned | Signed installer, updates, support and release process |

## Release rule

A module can move from **Implemented in source** to **Validated** only after its module checklist passes on a supported Windows environment. Do not infer successful packaging, Windows API behaviour, installer signing or real-user validation from source-level checks alone.
