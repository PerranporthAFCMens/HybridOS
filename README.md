# Hybrid OS

Hybrid OS is a reusable, multi-tenant operating system for independent gyms and hybrid training facilities.

It is one product with three role-specific experiences:

- **Admin Console** — setup, commercial control, scheduling, staff, members, reporting and configuration
- **Staff Portal** — operational delivery, classes, attendance, member lookup, rota/resources and PT appointments
- **Member Portal** — training, classes, bookings, PBs, membership, PT, access and community

> Start any new development session with [HANDOVER.md](./HANDOVER.md). It is the authoritative pickup point.

## Product principles

Hybrid OS should remain:

- multi-gym and tenant-neutral
- mobile-first
- one shared product rather than duplicated demo/live applications
- Supabase-backed with real persistence
- permission-aware in both UI and database
- reusable beyond the Hybrid Hub demo tenant
- training/member-experience focused rather than payment-provider focused

GoCardless remains intentionally parked. Email/SMS is planned later as a shared communications layer.

## Stack and locations

- Repository: `PerranporthAFCMens/HybridOS`
- Branch: `main`
- Frontend: static HTML/CSS/JavaScript
- Hosting: GitHub Pages
- Backend/Auth/Database: Supabase
- Supabase project ref: `mzgnhmeydhhpzgxlgudh`
- Region: London / `eu-west-2`
- Core: https://perranporthafcmens.github.io/HybridOS/
- Demo login: https://perranporthafcmens.github.io/HybridOS/demo-login.html

Public Hybrid Hub demo credentials:

- `demo@hybridhub.test`
- `HybridHubDemo!26`

## Supported entry points

There are only two supported product entry points:

1. **Hybrid OS Core**
2. **Hybrid Hub demo**

`member-preview.html` is a development/helper preview, not a separate product.

## Current product state

### Admin Console

Current Admin areas include:

- Dashboard
- Classes / timetable
- Class setup
- Staff & resources
- Resource availability
- Staff access / permissions
- Door access
- Memberships
- Members
- Reporting
- Community/admin links
- **Member view editor**
- Member preview
- account/profile controls

The Admin UI now uses a shared visual system through `app-consistency.css`, `admin-pages.css` and `admin-shell.css`.

### Member view editor

`member-view-settings.html` is an owner/admin-only visual editor for the Member Home screen.

It provides:

- a phone preview
- drag-and-drop tile ordering
- tactile lift/follow/snap animation
- show/hide toggles
- saved gym-level layout
- direct jump to Member Preview

Configurable Home tiles currently include:

- Training goal
- Training snapshot
- Recent activity
- Training hub
- Upcoming bookings
- Next classes
- Membership
- My booked classes
- PT appointments

The default order is training-first, with **Training goal prominent at the top**.

Persistence:

- table: `gym_member_view_settings`
- direct table access is owner/admin only
- members obtain the safe layout via `get_member_home_layout(uuid)`
- members do **not** get direct table read/write access

### Classes and session management

The timetable/scheduling foundation supports:

- Gym / Staff / Resource calendar views
- recurring resource availability
- staff capability and working-hours checks
- staff clash validation
- resource clash/availability/capacity validation
- atomic session creation
- roster and attendance
- attended / no-show / reset
- cancel / reopen
- session editing
- staff reassignment
- resource reassignment
- capacity and reserved-capacity editing

Important files:

- `classes.html`
- `scheduling-engine.js`
- `calendar-views.js`
- `calendar-mobile.js`
- `session-manager.js`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

### Staff Portal

The Staff Portal now includes or has foundations for:

- assigned classes
- today / upcoming view
- rosters
- attendance/no-show
- working hours / rota snapshot
- permission-aware member lookup
- contact details only where permitted
- today’s assigned resources
- gym access card
- PT appointments
- PT appointment status: completed / no-show / cancelled

PT appointments are persisted in Supabase with gym-scoped policies.

### Member Portal

The Member Portal includes:

- Home
- Classes / bookings
- Workouts
- PBs
- Membership
- PT visibility
- Integrations
- Profile/account
- Door access
- Community/Social

Recent Member work added:

- 30-day live class availability
- capacity remaining
- Upcoming / My bookings / Spaces available filters
- atomic member booking/cancellation RPCs
- immediate save feedback
- booked-classes summary
- PT summary
- training snapshot
- weekly training goal
- recent activity
- training-first Home ordering
- configurable Admin-controlled Home tile order
- deep-link handling such as `member.html#classes`

Important member files:

- `member.html`
- `member-preview.html`
- `member-experience.js`
- `member-experience.css`
- `member-coach.js`
- `member-coach.css`
- `member-preview-controls.js`
- `member-preview-classes.js`
- `pb-workout-enhancements.js`

### Social/community

`social.html` is gym-scoped and backed by:

- `social_posts`
- `social_comments`
- `social_reactions`

Current enhancement layer supports:

- posting/comments
- reactions
- edit/delete own posts
- edit/delete own comments
- ownership checks
- social persistence bridge

Main files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`

### Reporting

Current reporting direction covers:

- memberships
- members
- classes
- attendance/no-shows
- fill/utilisation
- time/day demand
- inactivity/engagement
- exports

This becomes a major roadmap focus after Member/Social is rounded out.

## Design system

The shared component layer is `app-consistency.css`.

It owns the canonical:

- colours/tokens
- typography
- cards/panels
- buttons
- forms
- pills/status tags
- modals
- page spacing
- desktop sidebar language
- mobile drawer/hamburger system
- safe-area handling

Experience layers then add only role/feature-specific styling:

- `admin-pages.css`
- Staff-specific operations styling
- `member-experience.css`

Avoid adding another page-local version of common cards/buttons/navigation unless it is truly feature-specific.

## Stability and deployment

Deployment is:

**source → isolated `_site` build → smoke tests → GitHub Pages**

Files:

- `scripts/build_site.py`
- `scripts/smoke_test.py`
- `.github/workflows/pages.yml`

The stability layer also includes `app-stability.js`, which replaces a silent stuck loading screen with a retry/recovery screen.

Smoke tests cover:

- required assets
- external JavaScript syntax
- **inline JavaScript syntax**
- runtime isolation
- member startup regression guards
- Member Preview runtime isolation
- Classes-only runtime isolation
- Staff-only runtime isolation
- Social ownership/persistence bridges
- Member Home layout runtime

A recent Member startup issue was caused by an invalid optional-chain assignment being injected during the build. This has been fixed at the source/build level and inline script syntax is now checked to prevent a repeat.

Always verify the latest GitHub Actions run before saying a frontend change is live.

## Security baseline

- Never commit a Supabase service-role/secret key
- browser code uses only the publishable key
- RLS is mandatory for exposed tables
- authorisation must come from gym membership/role data
- Admin configuration pages must remain owner/admin-only
- sensitive Staff/pay data must never leak to members
- Member Home configuration is directly writable/readable only by Admin; member consumption uses a restricted RPC
- social/member data remains gym-scoped
- security-definer functions require review before production

## Current roadmap

The major cleanup, Calendar/Session work and first Staff Portal depth passes are substantially complete.

Resume the roadmap in this order:

1. **Finish Member Portal + Social**
   - verify Member Home/config editor on iPhone
   - continue booking/workout/PB polish
   - finish community photos/richer reactions/notifications
   - useful Home community activity

2. **Reporting + engagement**
   - class/attendance trends
   - utilisation
   - inactivity windows
   - new-member engagement
   - exports

3. **Email + SMS communications**
   - one-to-one messaging
   - reminders/changes
   - announcements
   - templates
   - consent/preferences
   - delivery history
   - segmentation

4. **Retention/automation**
   - inactivity/declining engagement signals
   - 30/60/90-day checks
   - staff follow-up lists and alerts

Payment-provider work remains parked unless explicitly restarted.

## Development rules

- Prefer completed, working slices over speculative redesign
- Preserve existing Supabase persistence unless deliberately replacing it
- Keep Core and Hybrid Hub on the same product code
- Keep shared code shared and page-specific code isolated
- Mobile-first
- Fetch current GitHub file SHA immediately before writes
- Use existing scheduling/RPC logic instead of duplicating business rules
- Run/verify GitHub Actions before calling changes live
- Do not touch Football PA/Core from this project
