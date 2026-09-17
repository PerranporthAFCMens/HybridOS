# Hybrid OS — Handover / Pickup Point

Last updated: 2026-09-17

This is the authoritative continuation brief for Hybrid OS. A fresh coding/chat session should be able to continue from here without reconstructing the project from old conversations.

## 1. Product definition

Hybrid OS is a reusable multi-gym SaaS / operating system for independent gyms and hybrid-style training facilities.

It is one underlying product with three role experiences:

### Admin Console

Owner/admin control over gym setup, memberships, members, staff, permissions, classes, timetable, resources, attendance, access, reporting and account settings.

### Staff Portal

Operational workspace for staff, including assigned classes, rosters, attendance and future rota/PT/member/resource workflows according to permission.

### Member Portal

Member-facing experience for bookings, training, PBs, membership, integrations, access and Social/community.

All three experiences use the same underlying gym-scoped data.

---

## 2. Repository, hosting and backend

Repository: `PerranporthAFCMens/HybridOS`

Branch: `main`

Live Core:

`https://perranporthafcmens.github.io/HybridOS/`

Actions:

`https://github.com/PerranporthAFCMens/HybridOS/actions`

Supabase project ref:

`mzgnhmeydhhpzgxlgudh`

Project URL:

`https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region: London / `eu-west-2`

Do not confuse this project with Football PA/Core.

---

## 3. Supported entry points

There should be exactly two supported product entry points:

1. **Hybrid OS Core** — the real product code/UI
2. **Hybrid Hub demo** — dedicated demo tenant using the same Core product

Do not create a parallel Admin or Member demo application.

### Hybrid Hub demo

Login:

`https://perranporthafcmens.github.io/HybridOS/demo-login.html`

Public demo credentials:

- Email: `demo@hybridhub.test`
- Password: `HybridHubDemo!26`

Hybrid Hub tenant ID:

`242f57c2-6e37-4977-b3c5-1c87de7d0b98`

Slug:

`hybrid-hub-demo`

Original development tenant:

- Puffin Performance
- ID `aec16956-3793-4543-873b-4412646ca1eb`

`member-preview.html` is a development helper only.

---

## 4. Current architecture

- static HTML/CSS/JavaScript prototype
- GitHub Pages
- Supabase Auth/database/RLS
- multi-tenant gym-scoped records
- mobile-first UI direction
- provider-ready payment schema
- Strava scaffold

GoCardless is deliberately parked for now. The schema remains provider-ready, but payment integration is not part of the immediate roadmap.

Email/SMS capability is planned later as a shared communications layer rather than one-off send buttons.

A framework migration such as Next.js/TypeScript can be reconsidered later, but the current static architecture is being retained while product workflows mature.

---

## 5. Stability architecture — completed cleanup

A dedicated stability/cleanup workstream was completed on 17 September 2026 after the app began feeling glitchy from overlapping page-specific and shared code.

The deployment flow is now:

**source files → isolated `_site` build → smoke tests → GitHub Pages deploy**

Important files:

- `scripts/build_site.py`
- `scripts/smoke_test.py`
- `.github/workflows/pages.yml`
- `app-consistency.css`
- `app-stability.js`

Key decisions:

- source files are no longer progressively rewritten in place during deployment
- the build script copies source into `_site` and assembles the deployable version there
- smoke tests run against the built site before Pages deploys it
- shared mobile shell styling lives centrally in `app-consistency.css`
- Admin-only loading/transition styling remains in `admin-shell.css`
- Staff mobile behaviour uses `staff-shell.js` but shared visual styling
- obsolete `member-mobile-rail.css` was removed
- obsolete `staff-shell.css` was removed
- obsolete `class-admin-loader.js` was removed
- Classes loads `class-admin-enhancements.js` and `class-admin-live-refresh.js` directly
- Member Preview-only behaviour lives in `member-preview-classes.js`
- Classes-only code is not allowed to leak onto other pages
- Staff-only code is not allowed to leak onto other pages
- legacy bottom navigation is stripped from Member, Member Preview and Staff in the deployable build
- the old Classes mobile-back link is stripped because shared Admin navigation owns mobile navigation
- shared assets are cache-busted by deployment SHA
- app startup has a stability guard so pages should not silently sit forever on loading screens

The final verification was run against the actual deployed GitHub Pages artifact and passed with zero detected problems.

Do not reintroduce separate CSS implementations for the same mobile shell or script-loader chains where scripts load more scripts at runtime.

---

## 6. Main frontend files

### Admin

- `index.html` — auth + Admin dashboard/memberships/members
- `classes.html` — class calendar/timetable
- `class-setup.html` — reusable class/service setup
- `admin-operations.html` — staff/resources/services
- `resource-availability.html` — recurring resource availability
- `staff-permissions.html` — granular staff access controls
- `access-settings.html` — gym access/PIN settings
- `reporting.html` — reporting workspace

### Staff

- `staff.html` — dedicated Staff Portal

### Member

- `member.html` — canonical Member Portal
- `member-preview.html` — preview/helper only
- `social.html` — gym social feed
- `integrations.html` — integrations/Strava
- `member-memberships.html` — older transitional membership-management screen; do not build new product direction around it

### Shared/runtime files

- `app-consistency.css`
- `app-stability.js`
- `shared-admin-nav.js`
- `admin-shell.css`
- `staff-shell.js`
- `tenant-branding.js`
- `tenant-branding.css`
- `calendar-mobile.js`
- `calendar-mobile.css`
- `calendar-views.js`
- `calendar-views.css`
- `scheduling-engine.js`
- `session-manager.js`
- `session-manager.css`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`
- `account-menu.js`
- `social-nav.js`
- `member-preview-classes.js`
- `operations-scheduling-link.js`

---

## 7. Admin Console

Current areas include:

- Dashboard
- Classes
- Class setup
- Staff & resources
- Resource availability
- Staff access
- Door access
- Memberships
- Members
- Reporting
- Community/admin areas
- Member preview

Admin mobile uses the shared hamburger/drawer rather than an old bottom rail.

The top-right user chip provides self-service account settings for display name, first/last name, email and password.

---

## 8. Classes and timetable

Core data includes:

- `class_types`
- `class_sessions`
- `class_bookings`
- `class_session_reserved_plans`
- `class_session_staff`
- `class_session_resources`
- `service_requirements`

RPCs include:

- `get_class_calendar`
- `book_class_session`
- `cancel_class_booking`

### Mobile timetable

The mobile Classes page uses:

- horizontally scrollable date strip
- selected date tile
- one-day session list
- rounded class cards
- booked/capacity state

### Calendar views

Operational modes include:

- **Gym** — all sessions
- **Staff** — sessions filtered by selected staff member
- **Resource** — sessions filtered by room/area/equipment

Session cards can surface assigned staff/resources.

### Session manager

A session-management panel exists when a timetable class is tapped.

Current capability includes:

- class title/date/time
- booked/capacity
- attended/no-show counts
- assigned staff display
- room/resource display
- roster
- mark attended
- mark no-show
- reset booking status
- cancel/reopen class
- refresh

This is the immediate feature area to deepen next.

---

## 9. Scheduling engine

The scheduling foundation is implemented.

Class/session creation can validate:

- required staff capabilities
- staff working hours
- staff clashes
- resource availability
- resource clashes
- resource/room capacity

Required resources from a class definition can be assigned automatically.

Class creation uses an atomic flow so failed related writes do not leave partial sessions.

Future scheduling UI should use the existing validation flow rather than implementing a second set of client-side scheduling rules.

---

## 10. Class setup and dependencies

`class-setup.html` is the canonical reusable class/service definition workspace.

A class type supports:

- name
- description
- difficulty/level
- default duration
- default capacity
- required staff capabilities
- required resources

Known limitation: `service_requirements.quantity` exists, but the UI still effectively treats selected dependencies as quantity `1`. Explicit quantity editing remains future work.

---

## 11. Staff and resources

Important tables/concepts include:

- `staff_profiles`
- `staff_working_hours`
- `capabilities`
- `staff_capabilities`
- `resources`
- `resource_availability`
- `service_requirements`

Resources can represent rooms, areas, equipment or other bookable assets and may have capacity, bookable state, overlap rules and recurring availability.

---

## 12. Staff Portal and permissions

The Staff Portal is deliberately separate from Admin.

Presets include:

- Coach / PT
- Reception
- Manager
- Custom

Permission areas can include timetable access, class creation/editing/cancellation, attendance, member contact details, memberships, reporting, resources, staff, own pay, notes and community moderation.

Attendance actions are enforced in Supabase as well as the UI.

Staff pay must never be exposed to ordinary members.

Next Staff depth should include rota/working schedule, PT appointments, permitted member lookup, resource/access tools and own profile/pay where allowed.

---

## 13. Attendance

`class_bookings.status` supports:

- `booked`
- `cancelled`
- `attended`
- `no_show`

This is the source for attendance reporting, engagement and future retention automation.

---

## 14. Reporting

`reporting.html` is the Admin reporting workspace.

Useful reporting areas include:

- active memberships/members
- MRR estimate
- joins/ended memberships
- plan mix
- class fill/utilisation
- attendance/no-shows
- class type performance
- weekday/time-of-day demand
- day × time heatmap
- active/inactive member indicators
- CSV/Excel export

Payment reporting can remain future-facing while provider integration is parked.

---

## 15. Memberships and payments

Important tables include:

- `membership_plans`
- `memberships`
- `payment_records`

Plans support price, billing interval, joining fee, access type, open gym/classes/PT, class allowances, trials and public/private state.

Provider fields remain in the schema, but do not prioritise GoCardless unless the user explicitly brings it back onto the roadmap.

---

## 16. Door access

Access settings are persisted in Supabase and currently support enabled state, PIN/code, member-facing label and member note.

The simple member-readable PIN model is acceptable for the current prototype/demo, not a final high-security access-control design.

---

## 17. Member Portal

`member.html` is canonical.

Main areas:

- Home
- Classes
- Workouts
- PBs
- Membership
- Integrations
- Profile
- Social
- Door access

The Member Home should feel activity/training-first rather than membership-admin-first.

Prefer upcoming sessions, recent activity, workouts/PBs and community activity before commercial/admin content.

---

## 18. Social/community

`social.html` is a gym-scoped member social feed backed by:

- `social_posts`
- `social_comments`
- `social_reactions`

Current capability:

- text posts
- profile/avatar display
- relative timestamps
- clickable links
- reactions/likes
- comments
- replies
- gym-scoped RLS
- moderation-ready owner/admin rules

Next Social improvements:

- image/photo upload
- richer reactions
- edit/delete own posts/comments
- reply/reaction notifications
- pinned/admin announcements
- latest community activity on Member Home
- moderation polish

---

## 19. Workouts and PBs

Core tables:

- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

Tracking supports reps + weight, time, distance, calories and custom value/unit.

Do not assume all timed PBs use the same comparison direction: race times are usually lower-is-better while duration holds may be higher-is-better.

---

## 20. Strava

Strava is scaffolded but not production-connected.

Preserve this direction:

- **Strava → Hybrid OS:** may be automatic/webhook-driven
- **Hybrid OS → Strava:** manual only, requiring explicit member action

Do not automatically publish workouts to Strava.

---

## 21. Branding

**Hybrid OS** = platform/SaaS brand.

**Hybrid Hub** = demo/prospect tenant.

Current Hybrid Hub assets:

- `assets/hybrid-hub-mark.svg`
- `assets/hybrid-hub-logo-horizontal.svg`

`tenant-branding.js` still contains some Hybrid Hub-specific behaviour. Long-term branding should come from gym configuration/onboarding.

---

## 22. GitHub Pages deployment rules

Workflow: `.github/workflows/pages.yml`

Current behaviour:

- pushes to `main` deploy
- `cancel-in-progress: false`
- `scripts/build_site.py` produces an isolated `_site` output
- `scripts/smoke_test.py` tests the built output
- deployment only proceeds after smoke tests pass
- asset URLs are versioned by commit SHA to reduce Safari caching problems

Always inspect the latest Actions run before telling the user a frontend change is live.

---

## 23. Remaining technical debt

The major cross-page stability work is complete. Remaining debt is more contained:

- substantial inline CSS/JS remains inside individual HTML files
- tenant branding is partly hardcoded
- `member-preview.html` remains transitional
- `member-memberships.html` is an older transitional screen
- class dependency quantity editing is incomplete
- PT booking workflows are incomplete
- Strava production connection is not live
- Social media uploads/notifications are not implemented
- email/SMS communications layer is not built yet

Do not reopen the entire architecture cleanup unless a specific regression requires it.

---

## 24. Current roadmap

GoCardless is parked.

Current sequence:

1. **Calendar/session management**
   - richer session detail
   - roster and attendance
   - edit session details/capacity
   - reassign staff
   - reassign room/resource
   - quick Admin actions

2. **Staff Portal expansion**
   - rota/working schedule
   - PT appointments
   - permitted member lookup
   - resource/access tools
   - own profile/pay where permitted

3. **Member Portal + Social refinement**
   - class booking polish
   - workout/PB polish
   - photos/reactions/edit/delete
   - notifications
   - Member Home community activity

4. **Reporting + engagement**
   - attendance trends
   - class/resource/staff utilisation
   - inactivity windows
   - new-member engagement
   - exports

5. **Email + SMS communications**
   - individual messages
   - class reminders/changes
   - announcements
   - templates
   - consent/preferences
   - delivery history
   - bulk segments

6. **Retention/automation**
   - inactivity detection
   - declining engagement
   - first-30/60/90-day checks
   - staff follow-up lists/alerts

---

## 25. Working rules for future sessions

- Prefer doing over explaining
- Preserve working Supabase persistence
- Keep Admin, Staff and Member distinct experiences over one data model
- Do not create a parallel demo product
- Shared code must do shared jobs; page-specific code stays page-specific
- Mobile-first
- Fetch fresh GitHub SHAs before writes
- Verify the built site and latest deployment before saying a change is live
- Keep sensitive data protected at database level, not only hidden in UI
- Do not automatically re-prioritise GoCardless

---

## 26. Immediate pickup point

The stability workstream is complete and verified.

The next product task is **Calendar/session management**.

Start by deepening `session-manager.js` so an Admin can manage a session from the timetable without going back through the create-class flow. Highest-value next controls are:

1. edit date/time/capacity/session details
2. reassign lead/additional staff
3. reassign room/resources
4. keep attendance/roster actions in the same panel
5. avoid full-page reloads after changes where practical

After Calendar/session management, continue into Staff Portal depth, then Member/Social.
