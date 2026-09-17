# Hybrid OS

Hybrid OS is a reusable multi-gym operating system for independent gyms and hybrid training facilities. It is being built as a multi-tenant SaaS so each gym can manage memberships, classes, bookings, staff, resources, member profiles, workouts, integrations and community features while keeping gym data separated.

> **Current continuation brief:** read [`HANDOVER.md`](./HANDOVER.md) before making further changes. It is the authoritative pickup point for the current build state, demo architecture, Supabase project, current caveats and next priorities.

## Product model

Hybrid OS is now being structured around three views of the same underlying data:

- **Central Admin Hub** — configures the gym, memberships, staff, rotas, classes, resources, member records, payments, reporting and integrations.
- **Staff View** — shows each staff member their own working schedule, classes, PT bookings, rosters and operational tasks.
- **Member View** — shows memberships, class/PT bookings, workouts/PBs, Strava, financial setup, gym access, announcements and community/social features.

The key principle is **one data model, multiple role-based views** rather than separate applications.

## Current stack

- Frontend: static HTML/CSS/JavaScript prototype
- Hosting: GitHub Pages
- Backend/auth/database: Supabase
- Payments: GoCardless architecture prepared; live connection not wired yet
- Fitness integration: Strava scaffolded; production credentials not connected yet
- Repository: `PerranporthAFCMens/HybridOS`
- Branch: `main`
- Live Core: `https://perranporthafcmens.github.io/HybridOS/`
- Hybrid Hub demo login: `https://perranporthafcmens.github.io/HybridOS/demo-login.html`

## Core vs demo

There should only be two supported product entry points:

1. **Hybrid OS Core development app** — the actual product UI/codebase.
2. **Hybrid Hub demo** — uses the same Core app and Supabase-backed pages, but signs into a dedicated Hybrid Hub demo tenant.

The demo must **not** become a separately maintained admin UI. The old standalone admin sandbox approach was retired because it drifted away from Core.

Current demo credentials are intentionally public demo credentials:

- Email: `demo@hybridhub.test`
- Password: `HybridHubDemo!26`

Never reuse these credentials for any real account.

`member-preview.html` still exists as a development/member-experience helper, but it is **not** a second admin demo product.

## Supabase

Project: `Hybrid OS`

Project ref: `mzgnhmeydhhpzgxlgudh`

Project URL: `https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region: London / `eu-west-2`

Two important current tenants exist:

- **Puffin Performance** — original development tenant, ID `aec16956-3793-4543-873b-4412646ca1eb`
- **Hybrid Hub** — prospect/demo tenant, ID `242f57c2-6e37-4977-b3c5-1c87de7d0b98`, slug `hybrid-hub-demo`

The product must remain tenant-neutral even though current frontend branding is still temporarily biased toward Hybrid Hub in places.

## Main frontend pages

- `index.html` — authentication + Central Admin Hub/dashboard
- `onboarding.html` — gym onboarding
- `classes.html` — timetable/calendar + class scheduling/bookings
- `class-setup.html` — dedicated reusable class/service setup and dependencies
- `admin-operations.html` — staff, working hours, pay, capabilities, rooms/equipment and operational setup
- `staff.html` — staff operational view
- `member.html` — real role-gated member portal
- `member-preview.html` — member-experience development preview, not a separate admin sandbox
- `integrations.html` — member integrations including Strava scaffold
- `demo-login.html` — signs into the dedicated Hybrid Hub demo tenant and then opens Core
- `member-memberships.html` — older transitional membership page; expected to be retired later

## Staff and operations model

The current operations layer is built around:

- `staff_profiles`
- `staff_working_hours`
- `capabilities`
- `staff_capabilities`
- `resources`
- `service_requirements`
- `class_types`

Admin can define staff records, staff logins/roles, gross hourly pay, normal working days/hours and qualifications/capabilities.

Rooms, areas and equipment can be configured as resources with optional capacity and double-booking rules.

Classes/services can then depend on:

- one or more staff capabilities
- one or more rooms/areas/equipment resources
- or no dependencies

Example target model:

**Spin** → requires a Spin-qualified instructor + Spin Room + potentially multiple bikes/equipment items.

The dedicated `class-setup.html` page is intended to support increasingly complex dependencies. The underlying `service_requirements.quantity` field exists, but the current UI still saves selected dependencies at quantity `1`; quantity editing is a next-step requirement for cases such as 10 bikes.

## Classes and timetable

The class system currently includes:

- reusable `class_types`
- `class_sessions`
- member bookings
- reserved capacity for selected membership plans
- staff assignment
- descriptions and class levels
- class setup dependencies

Important class tables/RPCs include:

- `class_sessions`
- `class_bookings`
- `class_session_reserved_plans`
- `class_session_staff`
- `class_types`
- `service_requirements`
- `get_class_calendar`
- `book_class_session`
- `cancel_class_booking`

The next major timetable step is to enforce dependencies when scheduling: qualified/available staff, required rooms/equipment and conflict checking.

## Member experience

The member portal direction is training/activity-first rather than membership-admin-first.

Planned/active areas include:

- announcement at the top of home
- classes and bookings
- contextual upgrade prompts only when a class is not included in the member plan
- membership/account details
- PT bookings
- workouts and PBs
- Strava
- gym access / weekly door code concept
- community/social chat
- profile and financial setup

Workout tracking supports flexible metrics rather than weights-only:

- reps + weight
- time
- distance
- calories
- custom numeric value/unit

Core workout tables are `workout_sessions`, `workout_entries`, `workout_sets` and `personal_bests`.

## Staff experience

The staff portal should consume the same schedule created by Admin. Staff/coach users should see:

- their own work schedule
- assigned classes
- future PT bookings
- class capacity/fullness
- attendee roster
- operational actions appropriate to their role

Staff should not have owner-level revenue/configuration controls.

## Rooms and equipment

Resources are first-class objects rather than free-text locations. They may represent:

- rooms
- studios
- areas/zones
- treatment/PT spaces
- equipment

A resource can have a maximum occupancy or no fixed occupancy. The long-term scheduler should prevent conflicting bookings when the resource is configured as non-shareable.

## Memberships and payments

Current plans used in development include Gym Only, Hybrid Lite, Unlimited and Hybrid Gold.

GoCardless groundwork exists but the live provider flow is not yet connected. Payment secrets and provider credentials must remain server-side.

## Strava

Strava is scaffolded with public connection/activity tables and private token/OAuth/webhook storage plus Edge Functions.

Direction:

- Strava → Hybrid OS can become automatic/webhook-driven once configured.
- Hybrid OS → Strava must remain **manual/member-triggered** via an explicit “Add to Strava” action.

## Branding

**Hybrid OS** is the platform brand.

**Hybrid Hub** is the current prospect/demo tenant brand.

Official Hybrid Hub assets currently live under `assets/`, including:

- `hybrid-hub-mark.svg`
- `hybrid-hub-logo-horizontal.svg`

Long-term tenant branding must be data-driven from onboarding/storage so each gym uploads its own logo/mark/colours and the same assets propagate across Admin, Staff, Member, emails and booking pages.

Current `tenant-branding.js`/CSS still contains temporary Hybrid Hub-specific behaviour. Treat that as transitional, not the final multi-tenant branding architecture.

## Security baseline

- Never commit Supabase secret/service-role keys.
- Browser code may use only the publishable key.
- All exposed tables require appropriate grants and RLS.
- Authorization must come from protected gym membership/role data, not user-editable metadata.
- Payment/bank credentials remain server/provider-side.
- Security-definer functions must be reviewed before production.
- Current profile visibility is broader than desirable for sensitive fields such as phone/DOB and must be redesigned before real rollout.

## Important technical debt

The GitHub Pages workflow still mutates files at deployment time to inject tenant branding, member mobile CSS and member-preview hotfixes. This was useful during rapid iteration but is now architectural debt.

Future direction is to move all behaviour into source files and restore a plain static Pages deployment workflow. Do not add more one-off deployment-time transformations unless absolutely necessary.

## Development rules

- Prefer visible working progress over speculative redesign.
- Preserve working Supabase persistence unless deliberately replacing it.
- Core and demo must stay the same product UI.
- Make changes in source files, not by creating parallel sandbox apps.
- Mobile-first.
- Verify GitHub Pages deployment before saying a change is live.
- Fetch the current file SHA immediately before GitHub writes to avoid overwriting concurrent changes.

For the detailed current state and exact pickup priorities, read [`HANDOVER.md`](./HANDOVER.md).
