# Hybrid OS — Handover / Pickup Point

Last updated: 2026-09-17

This file is the authoritative continuation brief for Hybrid OS. If a chat, coding session or handoff is interrupted, start here before making changes.

## 1. Product goal

Hybrid OS is a reusable multi-gym SaaS / operating system aimed at independent gyms, especially hybrid-style facilities. It should adapt to each gym rather than forcing one rigid template.

Current product order:

1. Memberships + recurring revenue
2. Timetable/classes
3. Bookings
4. Member profiles/workouts/PBs/progress
5. Staff operations
6. Community/chat
7. Later: challenges, referrals, check-in/access, richer analytics and automations

The reference gym for the current build is **Puffin Performance**, but the product must remain multi-tenant and reusable by other gyms.

## 2. Repositories, hosting and backend

### GitHub

Repository: `PerranporthAFCMens/HybridOS`

Branch: `main`

Live GitHub Pages site:

`https://perranporthafcmens.github.io/HybridOS/`

### Supabase

Project: `Hybrid OS`

Project ref: `mzgnhmeydhhpzgxlgudh`

Project URL:

`https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region: London / `eu-west-2`

Do **not** confuse this with older Football PA/Core Supabase projects.

## 3. Current prototype gym

Gym: **Puffin Performance**

Gym ID:

`aec16956-3793-4543-873b-4412646ca1eb`

Slug:

`puffin-performance`

The current owner account is the real admin login. There are also synthetic test users/members for development.

## 4. Current membership plans

Puffin Performance currently has these plans:

- Gym Only — £30/month
- Hybrid Lite — £40/month
- Unlimited — £65/month
- Hybrid Gold — £80/month

Premium/reserved class-space testing currently uses Unlimited and Hybrid Gold as the higher-access examples.

## 5. Frontend pages

### `index.html`

Main auth + owner/admin dashboard.

Current areas include:

- authentication
- dashboard
- memberships
- members
- community
- link to classes
- link to member preview

Owners/admins remain on this page after login.

### `onboarding.html`

Gym setup/onboarding prototype.

Intended onboarding flow:

- gym details
- services
- logo / colours
- membership plans
- class settings
- GoCardless
- reveal: “Your gym is ready.”

### `classes.html`

Class calendar and booking area.

Current direction:

- week view rather than seven stacked day cards
- Monday–Sunday layout
- time-based positioning
- mobile horizontal scrolling
- class capacity
- reserved premium spaces
- release reserved spaces before class if configured
- add class
- staff assignment
- member book/cancel

The backend booking logic exists and should be preserved.

### `member.html`

Real member portal.

It is role-gated to actual `member` gym users.

Current sections:

- Home
- Classes
- Workouts
- PBs
- My membership
- Profile

Workouts are now wired to Supabase for save/load/history/delete. PBs have their own icon-led page and persistent records.

The previous attempt to let owners preview this page using `?preview=member` was unreliable in practice. Do not depend on this route for owner preview until it is properly fixed.

### `member-preview.html`

Standalone owner-safe member preview.

Use this for design/product iteration without changing roles:

`https://perranporthafcmens.github.io/HybridOS/member-preview.html`

This page currently contains sample member data and now includes:

- Home
- Classes
- Workouts
- Membership
- Community
- Profile

It has a clear Back to admin route.

This is currently the best place to prototype the member experience quickly.

### `staff.html`

Staff operational portal.

Direction/current behaviour:

- staff/coach-focused view
- today/upcoming assigned classes
- roster access
- less admin/revenue clutter than owner view

### `member-memberships.html`

Older standalone membership page. Treat as transitional / legacy. The aim is to consolidate member functionality into the main member portal.

## 6. Branding state

The previous sled logo is not the desired long-term direction.

Current Hybrid OS UI branding has been simplified to:

- an abstract triangular mark
- six line strokes
- simple `HYBRID OS` wordmark

This should remain the product identity for now.

Gym-specific branding should be separate.

The current Puffin Performance source image included “Hybrid Hub”. The desired future gym logo is a reconstructed clean version that removes “Hybrid Hub” and retains the Puffin Performance identity. That reconstruction has **not yet been finalised or uploaded**.

## 7. Core database model

Important public tables currently include:

- `gyms`
- `profiles`
- `gym_members`
- `members`
- `membership_plans`
- `memberships`
- `channels`
- `channel_members`
- `messages`
- `class_sessions`
- `class_bookings`
- `class_session_reserved_plans`
- `class_session_staff`
- `payment_records`
- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

GoCardless/private webhook groundwork also exists outside the normal public UI flow.

## 8. Domain members vs auth users

This is an important architectural transition.

`public.members` exists as the gym-domain member record.

Key fields include:

- `id`
- `gym_id`
- nullable `user_id`
- name/display fields
- email
- phone
- status
- joined/timestamps

`memberships.member_id` was added so memberships can increasingly link to domain members rather than depending solely on auth users.

There are currently synthetic auth users corresponding to seeded test members. This was done to make existing auth-user-based UI easier to test.

Long-term direction:

- `members` should be the gym/member source of truth
- auth should be linked only when login is required
- dashboards should distinguish **Members** from **Gym users/logins/staff**
- remove temporary duplication once frontend migration is complete

## 9. Class booking architecture

### Tables

`class_sessions`

Important fields:

- gym/session identity
- name/description
- starts_at / ends_at
- capacity
- reserved_capacity
- reserved_release_minutes_before
- coach_user_id
- is_cancelled
- created_by

`class_bookings`

Important fields:

- gym_id
- session_id
- user_id
- status
- booked_at
- cancelled_at

`class_session_reserved_plans`

Used to identify which membership plans can use protected/premium class capacity.

`class_session_staff`

Supports multiple staff assignments per session and lead assignment.

### RPCs

Current class RPCs include:

- `get_class_calendar`
- `book_class_session`
- `cancel_class_booking`

Booking logic was designed to lock/check capacity to reduce overbooking risk.

### Reserved-space model

Example:

- total class capacity = 20
- reserved capacity = 5
- standard members can fill normal/general spaces
- premium-eligible members can access protected places
- reserved capacity can release X minutes before class

### Seeded timetable test pattern

The prototype has used several daily class times for visual testing:

- 06:00–07:00 — Early Engine
- 07:15–08:15 — Hybrid Strength
- 16:00–16:45 — Express Conditioning
- 17:30–18:30 — Hybrid Conditioning
- 19:00–20:00 — Evening Engine

## 10. Workouts — newest area

This area is now live in the real member portal and remains an active development focus.

Requirement: workout tracking must **not** assume every exercise is sets/reps/weight.

Examples:

- Bicep curls — sets + reps + kg
- Plank — sets + time
- Row — distance and/or time
- Run — distance/time
- Calories — machine output
- Swimming — lengths/custom unit

### Backend

The workout backend has now been added using:

- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

`workout_sets` supports flexible metrics including:

- `reps`
- `weight_kg`
- `duration_seconds`
- `distance_m`
- `calories`
- `custom_value`
- `custom_unit`
- `notes`

### Preview UI

`member-preview.html` now includes a Workouts section with:

- Add workout
- Workout name/date
- Exercise name
- tracking type selector
- add/remove sets
- dynamic metric labels/fields
- recent workout history preview

Tracking options currently include:

- Reps + weight
- Time
- Distance
- Calories
- Custom

The real `member.html` now saves workout sessions, exercises and sets to Supabase, loads workout history, supports delete, and automatically updates straightforward higher-is-better PBs for weight/distance/calories/custom metrics. Time PBs are not auto-inferred because some timed PBs are lower-is-better (for example a 5K) while others are higher-is-better (for example a plank).

A dedicated `personal_bests` table and PB page now support manual PB records for weight, reps, time, distance, calories and custom units, with `higher` or `lower` comparison direction.

## 11. Staff assignments

Classes can be assigned to eligible gym staff.

Supported operational role intent:

- owner
- admin
- staff
- coach

Staff should only see data appropriate to their role and assigned sessions.

A later step should improve staff management/invites because class assignment currently depends on eligible users already existing in the gym.

## 12. GoCardless state

GoCardless is **not connected live yet**.

Groundwork exists for:

- provider connection records
- payment records
- provider IDs/statuses
- sandbox/live separation
- private webhook event storage

Do not put GoCardless secrets in frontend code.

Before wiring it live:

- check current GoCardless docs
- confirm current OAuth/connection model
- use server-side/Edge Function logic
- verify webhook signatures
- make webhook processing idempotent
- keep bank/payment credentials server-side/provider-side

## 13. Security notes that must not be lost

- RLS must be enabled/maintained on exposed tables.
- Grants matter as well as RLS.
- Never use user-editable metadata for authorization.
- Service/secret keys must never be used in browser code.
- Views should generally use `security_invoker=true` where appropriate.
- Security-definer functions should be reviewed carefully before production.
- Existing class RPC/security-definer warnings need a later deliberate review rather than being ignored.
- Current profile access is too broad for production: shared-gym profile access can expose fields such as phone/DOB. This must be redesigned before real sensitive data is introduced.
- Supabase leaked-password protection was unavailable on the current free plan at the time of setup.

## 14. Current user/product preferences for implementation

When continuing this project:

- prioritise visible working progress
- avoid lengthy theoretical planning unless needed
- make practical defaults rather than asking obvious questions
- preserve working behaviour while improving it
- mobile-first
- direct changes to GitHub/Supabase are preferred when available
- never claim deployment is live until verified

## 15. Immediate next priorities

Recommended pickup order from this handover:

1. **Workouts:** polish the now-live save/load/history flow; add workout edit/detail view and stronger transactional save behaviour.
2. **PBs/progress:** build PB history/automatic record detection further, then add progress charts, volume, streaks and attendance.
4. **Member portal:** continue consolidating preview features into the real role-gated member portal.
4. **Classes:** verify/polish the week view on mobile and desktop; add recurring class creation rather than manually creating every session.
5. **Bookings:** improve direct booking UX inside the member portal so members do not need to jump between pages.
6. **Staff:** polish roster/attendance/no-show/check-in flows and staff assignment UX.
7. **Members architecture:** migrate UI fully toward `public.members` and remove temporary auth-user duplication.
8. **Branding:** add a clean Puffin Performance gym logo separately from the Hybrid OS product mark.
9. **Security:** tighten profile privacy and review security-definer RPC exposure before production.
10. **Payments:** connect GoCardless only after the core membership/member flows are stable.

## 16. Known issues / cautions

- Owner preview through `member.html?preview=member` was not dependable. Use `member-preview.html` for now.
- `member-preview.html` uses demo/sample content and should not be mistaken for the real logged-in member data layer yet.
- `member-memberships.html` is transitional.
- Test-member/auth duplication is temporary technical debt.
- Static HTML/JS has enabled rapid iteration but will become awkward as the product grows.
- A future migration to Next.js + TypeScript + Supabase remains sensible once the feature shape stabilises.

## 17. Last known recent commits / milestones

Recent work immediately before this handover included:

- simplified Hybrid OS branding
- standalone member preview creation
- owner/admin Member Preview link pointing to standalone preview
- workout backend migration
- flexible workout tracking UI added to member preview
- real member workout persistence and history
- `personal_bests` table + dedicated PB page with metric icons

The workout preview milestone commit was:

`7c8dde602ae7b02eebe300e13da314abef08d3c5`

Do not assume this is the current HEAD after this documentation update; always fetch `main` before modifying files.

## 18. Definition of a clean restart

A fresh session should be able to continue by doing only this:

1. Read `README.md`.
2. Read this `HANDOVER.md`.
3. Fetch the current `main` branch versions of the file being changed.
4. Confirm relevant Supabase schema before DDL/data changes.
5. Continue from the Immediate next priorities above.

No reconstruction from old chats should be necessary for normal development after reading these docs.


## 19. Strava integration scaffold

Strava has now been scaffolded in the same spirit as GoCardless: the product/database/server flow exists even though production API credentials have not yet been added.

Backend tables:

- `strava_connections` — non-secret connection metadata only
- `strava_activities` — imported activity summaries, private to the owning member by RLS
- `private.strava_tokens` — access/refresh tokens; never browser-readable
- `private.strava_oauth_states` — short-lived OAuth state records
- `private.strava_webhook_events` — raw webhook event store

Supabase Edge Functions:

- `strava-connect` — authenticated member OAuth start; gracefully reports not configured until secrets exist
- `strava-callback` — public OAuth callback; exchanges code and stores tokens server-side
- `strava-webhook` — public Strava webhook verification/event receiver; acknowledges quickly and records events
- `strava-sync` — authenticated member manual sync; refreshes tokens, imports recent activities and creates corresponding Hybrid OS workout sessions/entries/sets

Required future Supabase secrets:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_VERIFY_TOKEN`

Current UI:

- `integrations.html` is the member integrations page
- `integrations.html?preview=1` provides a no-credentials demo of the Strava experience
- member Profile links to integrations
- member preview links to the Strava demo

Imported activity data is intentionally private to the member by default. Do not expose Strava-derived activity detail to coaches, staff or other members unless Strava's current API terms explicitly permit the intended use.

Current Strava architecture uses `activity:read` as the intended default scope, not `activity:read_all`. Webhooks should be used for ongoing activity events rather than aggressive polling. Before activation, re-check current Strava API endpoints/terms because their API base URL changed in June 2026.
