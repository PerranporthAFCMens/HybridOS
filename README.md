# Hybrid OS

Hybrid OS is a reusable, multi-tenant operating system for independent gyms and hybrid training facilities. It uses one shared data model with three role-specific experiences:

- **Admin Console** — commercial and operational control
- **Staff Portal** — day-to-day delivery, rota, classes and member operations
- **Member Portal** — bookings, training, membership, access and community

> Read [`HANDOVER.md`](./HANDOVER.md) before continuing development. It is the authoritative pickup point.

## Product principles

Hybrid OS should remain:

- multi-gym and tenant-neutral
- mobile-first
- one product, not duplicated Admin/Staff/Member apps
- Supabase-backed with real persistence
- permission-aware at UI and database level
- reusable beyond the Hybrid Hub demo tenant

## Current stack

- Frontend: static HTML/CSS/JavaScript prototype
- Hosting: GitHub Pages
- Backend/auth/database: Supabase
- Supabase project: `mzgnhmeydhhpzgxlgudh`
- Region: London / `eu-west-2`
- Repository: `PerranporthAFCMens/HybridOS`
- Branch: `main`
- Live Core: `https://perranporthafcmens.github.io/HybridOS/`
- Hybrid Hub demo: `https://perranporthafcmens.github.io/HybridOS/demo-login.html`

The payment schema is provider-ready, but live GoCardless work is intentionally parked for now. Email/SMS capability is planned later as a shared communications layer.

## Supported entry points

There are only two supported product entry points:

1. **Hybrid OS Core** — the real product UI/codebase
2. **Hybrid Hub demo** — a demo tenant using the same Core product

`member-preview.html` is a development helper, not another app.

Demo credentials are intentionally public:

- Email: `demo@hybridhub.test`
- Password: `HybridHubDemo!26`

Never reuse these credentials for a real account.

## Product state

### Admin Console

Current Admin areas include:

- dashboard
- classes/timetable
- class setup
- staff and resources
- resource availability
- staff access/permissions
- memberships and members
- door access
- reporting
- member preview
- self-service account settings

### Scheduling and classes

The scheduling foundation is implemented. Class creation can validate:

- required staff capability/qualification
- staff working hours
- staff clashes
- resource availability
- resource clashes
- room/resource capacity

Class creation uses an atomic database flow so related records do not get left half-created when a save fails.

Operational calendar views include:

- **Gym** — all sessions
- **Staff** — sessions for a selected staff member
- **Resource** — sessions using a selected room/area/equipment item

The next product focus is richer session management from the timetable: roster, attendance, staff/resource reassignment, capacity and quick Admin actions.

### Staff Portal

The Staff Portal is distinct from Admin and is permission-aware.

Current foundations include:

- assigned/today/upcoming sessions
- class rosters
- attended/no-show actions
- role/permission presets
- granular access controls

Presets include Coach/PT, Reception, Manager and Custom.

### Member Portal

The member experience includes:

- Home
- Classes/bookings
- Workouts
- PBs
- Membership
- Integrations
- Profile/account
- Door access
- Social/community

The member experience should remain activity/training-first rather than membership-admin-first.

### Social/community

`social.html` provides a gym-scoped feed backed by:

- `social_posts`
- `social_comments`
- `social_reactions`

Current capability includes posts, clickable links, reactions, comments and replies. Planned improvements include photos, richer reactions, edit/delete, notifications, pinned announcements and community activity on Member Home.

### Reporting

`reporting.html` covers or is being developed around:

- memberships
- classes
- members
- attendance/no-shows
- fill/utilisation
- day/time demand
- inactivity/engagement indicators
- CSV/Excel export

Payment reporting remains future-facing while payment-provider integration is parked.

### Door access

Gym access settings are persisted in Supabase. The current model is a simple member-readable PIN/code and is suitable only for the present prototype/demo level.

### Workouts/PBs and Strava

Workout tracking supports reps/weight, time, distance, calories and custom values. Strava remains scaffolded.

Direction to preserve:

- **Strava → Hybrid OS** may become automatic/webhook-driven
- **Hybrid OS → Strava** must remain a manual member action

## Stability architecture

A dedicated stability cleanup was completed on 17 September 2026.

The deployment path is now:

**source files → isolated `_site` build → smoke tests → GitHub Pages deploy**

Key stability rules now in place:

- source files are not progressively mutated in place by the Pages workflow
- `scripts/build_site.py` assembles the deployable site in `_site`
- `scripts/smoke_test.py` blocks broken builds before deployment
- page-specific runtime stays scoped to the page that owns it
- shared mobile shell CSS lives in `app-consistency.css`
- obsolete `member-mobile-rail.css`, `staff-shell.css` and `class-admin-loader.js` were removed
- Classes loads its actual admin enhancements directly
- legacy mobile bottom navigation is stripped from the built Member/Preview/Staff pages
- Admin, Staff and Member use the same visual language for mobile drawers/hamburgers
- shared assets are cache-busted with the deployment SHA
- JavaScript syntax, missing local assets and known regressions are checked automatically

The latest stability verification passed against the actual deployed GitHub Pages artifact, not only the source tree.

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

Important shared/runtime files include:

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

Build/verification files:

- `scripts/build_site.py`
- `scripts/smoke_test.py`
- `.github/workflows/pages.yml`

## Security baseline

- Never commit Supabase secret/service-role keys
- Browser code may use only the publishable key
- All exposed tables require appropriate grants and RLS
- Authorisation must come from protected gym membership/role data
- Staff pay and sensitive staff data must not be exposed to ordinary members
- Social/member data must remain gym-scoped
- Payment/bank credentials must remain server/provider-side
- Security-definer functions require review before production

## Remaining technical debt

The major cross-page stability cleanup is complete, but some structural debt remains:

- individual HTML files still contain substantial inline CSS/JS
- tenant branding is still partly hard-coded
- `member-preview.html` remains a transitional helper
- `member-memberships.html` is an older transitional screen
- class dependency quantity editing is not complete
- deeper PT workflows are not complete
- Strava production connection is not live
- communications/email/SMS has not been built yet

These are normal follow-on improvements rather than blockers to resuming feature work.

## Current roadmap

GoCardless is parked. The agreed order is now:

1. **Calendar/session management**
   - richer session detail
   - roster and attendance
   - staff/resource reassignment
   - capacity/session editing
   - quick Admin actions

2. **Staff Portal depth**
   - rota/working schedule
   - PT appointments
   - permitted member lookup
   - resource/access tools
   - own profile/pay where permitted

3. **Member Portal + Social**
   - class booking polish
   - workouts/PBs polish
   - photos/reactions/edit/delete
   - notifications and Member Home community activity

4. **Reporting + engagement**
   - attendance trends
   - utilisation
   - inactivity windows
   - new-member engagement
   - exports

5. **Email + SMS communications**
   - member messaging
   - class reminders/changes
   - announcements
   - templates
   - consent/preferences
   - delivery history
   - bulk segments

6. **Retention/automation**
   - inactivity and declining-engagement signals
   - first-30/60/90-day checks
   - staff follow-up lists and alerts

## Development rules

- Prefer working progress over speculative redesign
- Preserve working Supabase persistence unless deliberately replacing it
- Core and demo must remain the same product UI
- Keep shared code genuinely shared and page-specific code page-specific
- Mobile-first
- Fetch the current file SHA immediately before GitHub writes
- Verify the latest GitHub Actions run before saying a frontend change is live

For the detailed pickup point, read [`HANDOVER.md`](./HANDOVER.md).
