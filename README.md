# Hybrid OS

Hybrid OS is a reusable, multi-tenant operating system for independent gyms and hybrid training facilities. The product is being built around one shared data model with three role-specific experiences:

- **Admin Console** — commercial and operational control.
- **Staff Portal** — day-to-day delivery, rota, class and member operations.
- **Member Portal** — bookings, training, membership, access and community.

> **Continuation brief:** read [`HANDOVER.md`](./HANDOVER.md) before making further changes. It is the authoritative pickup point for current architecture, implemented features, caveats and next priorities.

## Product principles

Hybrid OS should remain:

- multi-gym and tenant-neutral
- mobile-first
- one product, not duplicated Admin/Staff/Member apps
- Supabase-backed with real persistence
- permission-aware at both UI and database level
- reusable for gyms beyond the Hybrid Hub demo

The same memberships, classes, bookings, staff, resources, attendance, reports and community data should flow through each role experience.

## Current stack

- Frontend: static HTML/CSS/JavaScript prototype
- Hosting: GitHub Pages
- Backend/auth/database: Supabase
- Payments: GoCardless-ready schema; live provider connection not wired yet
- Fitness integration: Strava scaffolded; production credentials not connected yet
- Repository: `PerranporthAFCMens/HybridOS`
- Branch: `main`
- Live Core: `https://perranporthafcmens.github.io/HybridOS/`
- Hybrid Hub demo login: `https://perranporthafcmens.github.io/HybridOS/demo-login.html`

## Core vs demo

There are only two supported entry points:

1. **Hybrid OS Core** — the actual product UI/codebase.
2. **Hybrid Hub demo** — signs into a dedicated demo tenant and then uses the same Core product.

The demo must not become a separately maintained application.

Current demo credentials are intentionally public:

- Email: `demo@hybridhub.test`
- Password: `HybridHubDemo!26`

Never reuse these credentials for any real account.

`member-preview.html` remains a development helper for testing the member experience. It is not a second product.

## Supabase

Project ref: `mzgnhmeydhhpzgxlgudh`

Project URL: `https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region: London / `eu-west-2`

Current tenants include:

- **Puffin Performance** — original development tenant
- **Hybrid Hub** — current demo/prospect tenant

All new features must remain gym-scoped.

## Current product areas

### Admin Console

The Admin Console currently covers:

- dashboard
- memberships and plans
- members
- class timetable
- class setup
- staff and resources
- resource availability
- staff access/permissions
- door access
- reporting
- member preview
- account settings from the top-right user chip

Admin mobile navigation uses the shared hamburger/drawer treatment rather than a bottom navigation rail.

### Classes and timetable

The class system includes:

- reusable `class_types`
- `class_sessions`
- member bookings
- reserved membership-plan capacity
- staff assignment
- resource assignment
- attendance/no-show states
- member booking/cancellation RPCs

The mobile timetable now uses a selected-day layout with a horizontally scrollable date strip and clean class cards.

Operational calendar views now include:

- **Gym** — all sessions
- **Staff** — sessions filtered by a selected staff member
- **Resource** — sessions filtered by room/area/equipment

Class cards can surface staff and resource assignments.

### Scheduling engine

The scheduling foundation is implemented.

When a class is created, Hybrid OS can validate:

- required staff capability/qualification
- staff working hours
- staff clashes
- resource availability
- resource clashes
- room/resource capacity

Required class resources can be assigned automatically from the class setup definition.

Class creation uses an atomic database flow so a failed related write does not leave a half-created class/session behind.

### Class Setup

`class-setup.html` is the reusable class/service definition workspace.

A class type can store:

- name
- description
- difficulty/level
- default duration
- default capacity
- required staff capabilities
- required resources

`service_requirements.quantity` exists in the data model. The current UI still treats selected dependencies as quantity `1`, so explicit quantity editing for cases such as “10 bikes” remains an improvement area.

### Staff and resources

`admin-operations.html` manages the operational building blocks of the gym.

Current concepts include:

- staff profiles
- staff login/role
- job title
- normal working hours
- staff capabilities/qualifications
- rooms/areas/equipment
- optional resource capacity
- overlap/double-booking rules

`resource-availability.html` provides recurring availability windows for rooms, areas and equipment.

### Staff Portal and permissions

The Staff Portal is a separate experience from Admin.

Current staff functionality includes:

- assigned/today/upcoming sessions
- class rosters
- attendance actions
- permission-aware tools

Staff access is configurable rather than hard-coded to one generic role.

Permission presets include:

- Coach / PT
- Reception
- Manager
- Custom

Granular permissions can cover timetable access, class creation/editing/cancellation, attendance, member contact details, memberships, reporting, resources, staff management, own pay, notes and community moderation.

### Attendance

`class_bookings.status` supports:

- `booked`
- `cancelled`
- `attended`
- `no_show`

This powers attendance reporting and future retention/engagement automation.

### Reporting

`reporting.html` is the Admin reporting workspace.

Current/target reporting areas include:

- Overview
- Memberships
- Classes
- Members
- future Payments

Useful metrics include:

- active memberships
- estimated MRR
- new joins / ended memberships
- plan mix
- session capacity and utilisation
- demand/fill rate
- attendance and no-shows
- class-type performance
- day-of-week patterns
- morning/daytime/evening patterns
- day × time demand heatmap
- most active members
- inactivity / engagement indicators

The payment reporting section is intentionally future-facing until GoCardless is connected.

### Memberships and payments

Membership plans support concepts such as:

- price
- billing interval
- joining fee
- public/private availability
- open gym access
- classes
- PT
- weekly class allowances
- trial periods

The membership/payment schema already includes provider IDs, mandate/subscription fields, payment status and `payment_records` for future GoCardless integration.

### Door access

Gym access settings are now stored in Supabase.

Admin can configure:

- whether access is enabled
- a door PIN/code
- member-facing label
- member note/instructions

The member experience can reveal the active gym code for authorised users. This is still a simple PIN model rather than a full physical access-control integration.

### Member Portal

The member experience includes or is being built around:

- home/dashboard
- class browsing and booking
- workouts
- PBs
- membership
- integrations
- profile/account details
- door access
- Social/community

The member mobile experience uses the shared hamburger/drawer pattern.

### Workouts and PBs

Workout tracking supports more than strength-only logging.

Supported concepts include:

- reps + weight
- time
- distance
- calories
- custom value/unit

Core tables include:

- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

### Social/community

A proper gym social feed now exists at `social.html`.

Current capabilities include:

- gym-scoped posts
- profile/avatar display
- relative timestamps
- clickable links
- likes/reactions
- comments
- threaded replies
- post composer
- comment composer
- moderation-ready database rules

Current social tables include:

- `social_posts`
- `social_comments`
- `social_reactions`

Social is exposed from the member navigation and is intended to become a first-class part of the member home experience.

Future improvements include post photos/media, richer reaction choices, notifications, editing/deleting and latest community activity on Home.

### Account settings

The Admin top-right user chip now opens an account menu.

Users can update their own:

- display name
- first name
- last name
- email address
- password

Profile changes use the user-owned `profiles` update policy and auth changes use Supabase Auth.

### Strava

Strava remains scaffolded.

Direction to preserve:

- **Strava → Hybrid OS** can become automatic/webhook-driven.
- **Hybrid OS → Strava** must remain a manual member action.

### Branding and CSS consistency

**Hybrid OS** is the platform brand.

**Hybrid Hub** is the current demo tenant.

Current demo assets live under `assets/`, including:

- `hybrid-hub-mark.svg`
- `hybrid-hub-logo-horizontal.svg`

A shared presentation layer is now being used to reduce page-to-page drift:

- shared admin shell/navigation
- shared member mobile treatment
- shared safe-area/background handling
- consistent hamburger/drawer behaviour
- cache-busted injected CSS/JS assets

Long-term tenant branding should be data-driven rather than hardcoded in `tenant-branding.js`.

## Important frontend files

- `index.html` — Admin login/dashboard
- `classes.html` — timetable/calendar
- `class-setup.html` — class/service setup
- `admin-operations.html` — staff/resources/services
- `resource-availability.html` — recurring resource availability
- `staff-permissions.html` — staff access controls
- `access-settings.html` — gym access/PIN setup
- `reporting.html` — Admin reporting
- `staff.html` — Staff Portal
- `member.html` — canonical Member Portal
- `member-preview.html` — member development preview
- `social.html` — member social feed
- `integrations.html` — integrations/Strava scaffold
- `demo-login.html` — Hybrid Hub demo entry

Shared helpers/styles include:

- `shared-admin-nav.js`
- `admin-shell.css`
- `tenant-branding.js`
- `tenant-branding.css`
- `member-mobile-rail.css`
- `calendar-mobile.js`
- `calendar-mobile.css`
- `calendar-views.js`
- `calendar-views.css`
- `scheduling-engine.js`
- `account-menu.js`
- `social-nav.js`

## Security baseline

- Never commit Supabase secret/service-role keys.
- Browser code may use only the publishable key.
- All exposed tables require appropriate grants and RLS.
- Authorization must come from protected gym membership/role data, not user-editable metadata.
- Staff pay and other sensitive staff data must not be exposed to ordinary members.
- Payment/bank credentials remain server/provider-side.
- Security-definer functions must be reviewed before production.
- New social/member-facing tables must remain gym-scoped through RLS.

## Deployment behaviour

GitHub Pages deploys from `main`.

Important deployment rules:

- Pages concurrency uses `cancel-in-progress: false` so rapid commits are not marked cancelled simply because another commit arrives.
- Shared CSS/JS assets are cache-busted with the current commit SHA during deployment.
- Always verify the latest GitHub Actions run before saying a change is live.

## Technical debt

The Pages workflow still mutates files during deployment to inject shared styles/scripts and member-preview helpers. This has been useful during fast iteration but should eventually be replaced by source-level imports and a simpler deployment workflow.

Do not add parallel demo apps or one-off page forks to solve UI issues.

## Current build direction

The agreed sequence is:

1. continue refining the calendar/session-management experience
2. expand the Staff Portal and operational workflows
3. refine the Member Portal and Social experience
4. connect GoCardless and payment recovery/reporting
5. add deeper retention/engagement automation
6. continue consolidating common CSS/navigation into shared source architecture

## Development rules

- Prefer visible working progress over speculative redesign.
- Preserve working Supabase persistence unless deliberately replacing it.
- Core and demo must remain the same product UI.
- Use shared components/styles where possible to stop visual drift.
- Mobile-first.
- Verify deployment before calling a change live.
- Fetch the current file SHA immediately before GitHub writes.

For the detailed current state and exact pickup priorities, read [`HANDOVER.md`](./HANDOVER.md).
