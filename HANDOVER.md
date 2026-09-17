# Hybrid OS — Handover / Pickup Point

Last updated: 2026-09-17

This is the authoritative continuation brief for Hybrid OS. A fresh coding/chat session should be able to continue from this document without reconstructing the project from old conversations.

## 1. Product definition

Hybrid OS is a reusable multi-gym SaaS / operating system for independent gyms and hybrid-style training facilities. It should adapt to each gym rather than force every customer into one rigid operating model.

The product is now best understood as **one underlying gym operating system with three role-based views**:

### Central Admin Hub

Admin/owner control over:

- gym setup and branding
- memberships and revenue configuration
- members
- staff and staff logins
- working hours / rota inputs
- gross hourly pay
- staff qualifications/capabilities
- class/service setup
- timetable
- class and PT bookings
- rooms/areas/equipment
- reserved membership capacity
- announcements
- reports
- payment/integration setup

### Staff View

Each staff member should have their own login and see their operational working life, including:

- their own class timetable
- PT bookings
- working schedule
- classes assigned to them
- how full a class is
- member roster for the class
- appropriate attendance/operational actions

Staff/coach users should **not** receive full owner/admin commercial controls.

### Member View

Members should see:

- their own account/profile
- membership
- payment/financial setup
- classes and bookings
- PT bookings
- workouts
- PBs/progress
- Strava/integrations
- gym access concept
- announcements
- community/social chats

The same data should drive all three views. Avoid building separate duplicate applications for Admin, Staff and Member.

---

## 2. Repositories, hosting and backend

### GitHub

Repository: `PerranporthAFCMens/HybridOS`

Branch: `main`

Live GitHub Pages Core:

`https://perranporthafcmens.github.io/HybridOS/`

GitHub Actions:

`https://github.com/PerranporthAFCMens/HybridOS/actions`

### Supabase

Project: `Hybrid OS`

Project ref: `mzgnhmeydhhpzgxlgudh`

Project URL:

`https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region: London / `eu-west-2`

Do not confuse this with older Football PA/Core Supabase projects.

---

## 3. Supported environments / demo architecture

This is important and should not drift again.

There should be **two supported product entry points only**:

1. **Hybrid OS Core development app** — the actual product UI/codebase.
2. **Hybrid Hub demo** — signs into a dedicated demo tenant and then uses the **same Core UI**.

Do **not** create or maintain a second standalone Admin sandbox UI.

The old standalone `admin-demo.html` approach was retired specifically because it became inconsistent with Core.

### Hybrid Hub demo

Login page:

`https://perranporthafcmens.github.io/HybridOS/demo-login.html`

Intentionally public demo credentials:

- Email: `demo@hybridhub.test`
- Password: `HybridHubDemo!26`

These credentials are demo-only and must never be reused for a real account.

The login signs into Supabase and opens the normal Hybrid OS Core Admin UI.

### Current tenants

Original development tenant:

- Name: **Puffin Performance**
- ID: `aec16956-3793-4543-873b-4412646ca1eb`
- Slug: `puffin-performance`
- Active gym users last checked: 21

Hybrid Hub demo tenant:

- Name: **Hybrid Hub**
- ID: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Slug: `hybrid-hub-demo`
- Active gym users last checked: 21

The demo tenant exists in the same Supabase project but is separate gym data.

### Member preview caveat

`member-preview.html` still exists. Treat it as a **member-experience development helper**, not as another admin demo product.

Long-term, `member.html` should be the canonical member UI and a safe preview mechanism should reuse it properly.

---

## 4. Current stack

- static HTML/CSS/JavaScript prototype
- Supabase database/auth/storage/realtime foundation
- GitHub source
- GitHub Pages hosting
- GoCardless scaffolded but not connected live
- Strava scaffolded but not connected with production credentials
- mobile-first direction

Longer term, a framework such as Next.js + TypeScript + Supabase remains sensible once feature shape stabilises, but the static build is being retained for speed at this stage.

---

## 5. Main frontend files/pages

### `index.html`

Main authentication + Central Admin Hub/dashboard.

Current/related areas include:

- auth
- dashboard
- memberships
- members
- navigation to classes
- navigation to class setup
- navigation to staff/resources
- community/admin areas

Owners/admins use this as the main entry point after login.

### `onboarding.html`

Gym onboarding prototype.

Target onboarding sequence:

- gym name/address/contact/social
- services
- logo / icon / colours
- starter membership plans
- class settings
- GoCardless
- reveal: “Your gym is ready.”

Branding upload should eventually be first-class and tenant-driven rather than hardcoded.

### `classes.html`

Timetable / class scheduling / bookings page.

Current concepts:

- week-based timetable
- add class/session
- class capacity
- reserved premium spaces
- release reserved spaces before class
- assign staff
- member booking/cancel backend
- class template selection from `class_types`

There have recently been bugs around newly-created class types not refreshing into the Add Class selector. `class-admin-live-refresh.js` was added to force a fresh Supabase class-library load when Add Class opens.

### `class-setup.html`

Dedicated Class Setup workspace. This replaced the idea of keeping class setup as only a popup.

Reason: classes may have several dependencies and need a real configuration area.

Current setup supports:

- class name
- member-facing description
- level: Beginner / Intermediate / Advanced / All levels
- default duration
- default capacity
- multiple staff capability requirements
- multiple room/equipment resource requirements
- no dependencies if appropriate
- summary of selected dependencies
- class library on the left
- edit existing class types

**Current known UX item:** user requested a visible **Back to Classes** button on this page. The page already has a Classes link in the desktop sidebar, but there is no explicit back button at the top/mobile. A prior attempted write was rejected safely by GitHub due to a stale SHA; the page was not overwritten. Add this button next.

### `admin-operations.html`

Current Staff & Resources control area.

This is the beginning of the Central Admin operating layer.

Current intent/functionality includes:

- staff records
- staff login creation/access
- role: staff/coach etc.
- job title
- gross hourly pay
- standard days/hours worked
- capabilities/qualifications
- rooms/areas/equipment
- resource capacity or no fixed occupancy
- resource double-booking behaviour
- notes
- service/dependency relationships

### `staff.html`

Staff operational portal.

Current direction:

- assigned classes today/upcoming
- operational schedule
- roster access
- eventually PT bookings/work schedule
- no owner-level commercial clutter

### `member.html`

Real member portal, role-gated to member users.

Current/target areas:

- Home
- Classes
- Workouts
- PBs
- My membership
- Community
- Integrations
- Profile

### `member-preview.html`

Member-facing development preview with Hybrid Hub presentation/hotfixes. It is useful for quick iteration but is transitional and should not become a separate product architecture.

### `integrations.html`

Member integrations area including Strava scaffold.

### `demo-login.html`

Hybrid Hub demo entry point. This should only perform demo login/entry and then use Core.

### `member-memberships.html`

Legacy/transitional membership page. Long-term functionality should live in the canonical member portal.

---

## 6. Branding model

Two distinct concepts:

- **Hybrid OS** = SaaS/platform product brand
- **Hybrid Hub** = current demo/prospect gym tenant brand

Current official Hybrid Hub assets:

- `assets/hybrid-hub-mark.svg`
- `assets/hybrid-hub-logo-horizontal.svg`

The intended self-onboarding branding model is:

- main logo
- optional icon/mark
- optional light/dark variants
- primary/secondary colours
- live preview
- automatic use across Admin, Staff, Member, emails, booking pages and eventually mobile app

Current implementation still has Hybrid Hub-specific hardcoding in `tenant-branding.js` and deployment-time transforms. This is temporary technical debt.

Do not rename Hybrid OS platform/repo/backend to Hybrid Hub.

---

## 7. Core database model

Important existing public tables include:

### Tenant / identity

- `gyms`
- `profiles`
- `gym_members`
- `members`

### Membership/revenue

- `membership_plans`
- `memberships`
- `payment_records`
- GoCardless/provider groundwork

### Community

- `channels`
- `channel_members`
- `messages`

### Classes/bookings

- `class_types`
- `class_sessions`
- `class_bookings`
- `class_session_reserved_plans`
- `class_session_staff`

### Staff/operations

- `staff_profiles`
- `staff_working_hours`
- `capabilities`
- `staff_capabilities`
- `resources`
- `service_requirements`

### Workouts/PBs

- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

### Notifications/calendar

- `notification_preferences`
- `member_notifications`
- `calendar_feed_tokens`

### Strava

- `strava_connections`
- `strava_activities`
- private token/OAuth/webhook tables

---

## 8. Staff data model

The current staff concept is deliberately more than “a coach name on a class”.

Each staff member should eventually have:

- their own login
- role
- staff profile
- job title
- gross hourly pay
- normal working schedule by weekday
- capabilities / qualifications
- class/PT assignments
- eventually exceptions/leave/rota overrides

Capabilities are reusable gym-defined records.

Examples:

- Spin Instructor
- Level 3 PT
- Yoga
- Olympic Lifting
- First Aid

`staff_capabilities` links staff to what they are qualified/allowed to deliver.

When assigning a class, Hybrid OS should eventually only offer staff who:

1. are working/available at that time
2. are not already booked elsewhere
3. hold all required capabilities for that class/service

---

## 9. Rooms / areas / equipment model

Resources are first-class objects in `resources`.

They may represent:

- Spin Room
- Main Studio
- PT Bay
- Sled Track
- treatment room
- individual or grouped equipment

A resource can have:

- type
- name
- capacity, or no fixed occupancy
- active status
- double-booking rule
- notes

The long-term scheduler should treat non-shareable resources as bookable calendar entities and reject overlapping allocations.

Example:

**Spin Room** — capacity 10, no double booking.

---

## 10. Services / class dependency model

A class/service should be configured once, then scheduled repeatedly.

Example target definition:

**Spin**

- 45 minutes
- All levels
- member-facing description
- capacity 10
- requires Spin Instructor capability
- requires Spin Room
- potentially requires 10 bikes
- 2 places may be reserved for Gold members at session level

Current `service_requirements` supports linking a class type to:

- capability
- resource
- quantity

The dedicated Class Setup UI currently supports **multiple** capability and resource selections.

### Important current limitation

Although `service_requirements.quantity` exists, the Class Setup UI currently inserts each selected requirement with `quantity: 1`.

For scenarios such as “10 bikes”, add a quantity control per resource requirement rather than creating 10 resource rows manually.

---

## 11. Timetable / scheduling target architecture

The calendar should become the operational centre of Hybrid OS.

### Admin week view

Admin should be able to view a full gym week and quickly see:

- class/service
- time
- instructor
- room/resource
- capacity/booked count
- premium reserved spaces

Staff indicator should be visually clear in the top-left of each class block.

### Filtered views

Required future views:

- **Gym** — everything
- **Staff member** — that person’s week
- **Resource** — e.g. Spin Room week

### Dependency enforcement

When Admin schedules Spin at Tuesday 18:00, Hybrid OS should check:

- class requirements
- is required room/equipment available?
- is an appropriately qualified staff member working?
- is that staff member free?
- is the resource already booked?
- does resource capacity affect class capacity?

Only valid combinations should be confirmable.

This dependency enforcement is **not fully implemented yet**. Current setup stores the requirements; timetable scheduling is the next major integration point.

---

## 12. Class booking architecture

Important tables:

### `class_sessions`

Includes concepts such as:

- gym/session identity
- name/description
- starts_at / ends_at
- capacity
- reserved capacity
- reserved release timing
- coach/created-by/cancelled state

### `class_bookings`

Member booking/cancellation state.

### `class_session_reserved_plans`

Controls which plans can use protected/premium spaces.

### `class_session_staff`

Supports staff assignments per session, including lead assignment.

### RPCs

- `get_class_calendar`
- `book_class_session`
- `cancel_class_booking`

Note: `get_class_calendar` returns `session_id`, not `id`.

### Reserved-space example

Spin capacity = 10

Gold reserved = 2

General members can fill general capacity while eligible Gold members can access protected spaces until any configured release time.

---

## 13. Member booking UX direction

The member home should not nag members to inspect their membership.

Preferred experience:

- announcement first
- training/gym activity front and centre
- member can browse class details
- class popup/detail shows description + level
- if plan includes class → Book
- if not → contextual upgrade prompt

Example:

“Classes aren’t included in your current plan. Upgrade to Hybrid Lite — £40/month to book this class.”

Ideally also show price delta, e.g. “Upgrade for £10 more per month.”

Class difficulty/comfort indicators should be visible:

- Beginner
- Intermediate
- Advanced
- All levels

Descriptions should come from saved `class_types`, not hardcoded frontend dictionaries.

---

## 14. Gym access concept

Member experience includes a key/door-access concept.

Current member preview has a demo-only weekly code presentation.

Production direction:

- key icon/access area in member UI
- code stored privately/server-side
- validate signed-in user
- validate active membership/access entitlement
- optional re-auth/passkey/WebAuthn/biometric-backed OS auth
- temporary reveal only
- log reveal event without logging the code
- Admin rotates/manages code

Do not implement production access codes as static client-side generated values.

---

## 15. Workouts and PBs

Workout tracking must remain flexible.

Supported metric concepts:

- reps + weight
- time
- distance
- calories
- custom value/unit

Tables:

- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

Examples:

- curls — sets/reps/kg
- plank — time
- 5K — distance/time
- rowing — distance/time
- machine calories
- swimming lengths/custom unit

PB direction supports both higher-is-better and lower-is-better records.

Caution: race/time PBs usually need lower-is-better while endurance holds may use higher-is-better. Do not blindly use MAX for all timed PBs.

---

## 16. Strava scaffold

Current tables:

- `strava_connections`
- `strava_activities`
- private Strava token/OAuth/webhook storage

Edge Function direction includes:

- connect
- callback
- webhook
- manual sync
- manual push

Decision that must be preserved:

- **Strava → Hybrid OS:** automatic/webhook-driven is acceptable once connected.
- **Hybrid OS → Strava:** never automatic. Member must explicitly choose **Add to Strava** per workout.

Production credentials are not yet connected.

Known area to recheck: outbound `strava-push` historically referenced `strava_athlete_id` while schema uses `athlete_id`.

---

## 17. GoCardless / payments

GoCardless is not connected live yet.

Architecture exists for:

- provider connections
- payment records
- provider IDs/statuses
- sandbox/live separation
- private webhook events

Before connecting:

- use current GoCardless docs
- use server-side / Edge Function logic
- verify webhook signatures
- make processing idempotent
- keep secrets/bank information out of browser code

Do not represent “manual confirmed” payment semantics as necessarily equal to genuinely settled payment without deliberate business rules.

---

## 18. Domain members vs auth users

`public.members` is intended to become the gym-domain source of truth.

There are currently synthetic auth users because older UI paths were built around auth-user records.

Long-term direction:

- member domain record exists whether or not member logs in
- nullable auth linkage
- logins only where required
- eliminate duplicate “domain member + auth member” representations
- dashboards distinguish members from gym users/staff accounts

This remains technical debt.

---

## 19. Notifications/calendar

Confirmed tables:

### `notification_preferences`

Includes concepts such as:

- booking confirmation
- class reminders
- reminder minutes
- push enabled
- calendar sync enabled

### `member_notifications`

Notification records.

### `calendar_feed_tokens`

Calendar feed support.

A `class-calendar` Edge Function exists and should be security-reviewed before future changes.

---

## 20. Security notes

Do not lose these:

- RLS on exposed tables.
- SQL grants and RLS are separate; both must be correct.
- Never use user-editable metadata for authorization.
- Secret/service-role keys never belong in frontend code.
- Views should generally use `security_invoker=true` where appropriate.
- Review security-definer RPCs deliberately before production.
- Current profile RLS is broader than acceptable for real sensitive data; same-gym users can potentially select fields such as phone/DOB. Redesign privacy before rollout.
- Production payments/access codes/integration secrets remain server/private.
- Demo credentials are public and must be isolated from real data/privileges.

Recent permissions issue encountered during operations build:

RLS policies existed on new capabilities/resources tables but base authenticated grants were initially missing. This produced `permission denied for table ...` errors. Grants were then added. Remember to check **both grants and RLS** whenever new tables are added.

---

## 21. GitHub Pages deployment technical debt

`.github/workflows/pages.yml` currently still performs deployment-time file mutations, including:

- tenant-branding CSS/JS injection
- member mobile stylesheet injection
- Hybrid Hub member-preview transformations
- member-preview interaction hotfixes

This should be cleaned up.

Target direction:

- source files contain their real CSS/JS/branding hooks
- Pages workflow becomes plain checkout → configure → upload → deploy
- do not keep adding transformation snippets to Actions

Current direct-source work should be preferred.

---

## 22. GitHub write discipline

There was a recent harmless 409 while trying to add a Class Setup back button. Cause: the file changed after it had been fetched, so the SHA supplied to GitHub was stale.

GitHub correctly rejected the write; the live source was **not overwritten**.

Rule for future edits:

1. fetch current file
2. use the returned current blob SHA
3. make the edit immediately
4. if a 409 occurs, fetch again and reconcile rather than force-overwriting

---

## 23. Current known UI/functional issues

At handover time:

1. **Class Setup needs an explicit Back to Classes button**, especially for mobile. Sidebar link exists on desktop.
2. **Class Setup resource quantity UI is missing** even though the DB has `quantity`; selected dependencies currently save quantity 1.
3. **Timetable dependency enforcement is not yet wired**. Requirements are stored, but Add Class still needs to actively constrain staff/resources and check conflicts.
4. **Class template refresh has been fragile**. Live refresh helper exists; verify class library and Add Class always show the same active class types.
5. **Class descriptions/levels should flow all the way into Member class details** from `class_types`, replacing hardcoded preview descriptions.
6. **Staff week/resource week calendar views are not built yet**.
7. **PT bookings/scheduling are conceptually required but not yet built into the same dependency engine**.
8. **Dynamic tenant branding is not complete**; Hybrid Hub is still hardcoded in transitional frontend code.
9. **Profile privacy/RLS needs redesign before real customer data**.
10. **Pages workflow still contains deployment-time mutation hacks**.

---

## 24. Current build priority

Recommended pickup order now:

1. Add explicit **Back to Classes** button to `class-setup.html` without overwriting newer changes.
2. Finish Class Setup properly:
   - per-resource quantity
   - cleaner dependency editor
   - ensure save/load consistency
3. Integrate dependencies into **Add Class / timetable scheduling**:
   - qualified staff only
   - working-hours/availability check
   - resource availability check
   - conflict prevention
   - required resource assignment saved to the scheduled session model
4. Redesign timetable into the intended operational calendar:
   - full week
   - staff indicator top-left on cards
   - Gym / Staff / Resource views
5. Expand Staff View to consume that exact schedule.
6. Add PT booking/service scheduling on the same engine.
7. Feed real class descriptions/levels/dependencies into Member class details.
8. Continue member plan eligibility/upgrade flow.
9. Dynamic tenant branding/self-onboarding.
10. Remove GitHub Actions mutation hacks and use source-side implementation only.
11. Profile privacy/domain-member cleanup.
12. GoCardless connection after core operations are stable.

---

## 25. Current implementation philosophy

When continuing:

- action over long planning
- visible progress quickly
- practical defaults
- avoid unnecessary questions
- mobile-first
- preserve working behaviour
- patch GitHub/Supabase directly where appropriate
- Core and demo must remain consistent because demo uses Core
- no new parallel sandbox app
- verify deploy state before saying something is live
- use source files, not one-off deployment mutations

---

## 26. Clean restart instructions

A fresh session should:

1. Read `README.md`.
2. Read this `HANDOVER.md`.
3. Fetch current `main` versions of files before editing.
4. Confirm relevant Supabase schema before DDL.
5. Confirm whether the requested change is for Core, remembering the Hybrid Hub demo should inherit Core behaviour automatically.
6. Continue from the Current build priority section.

No reconstruction from previous chat history should be necessary for normal development.
