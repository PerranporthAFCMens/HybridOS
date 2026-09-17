# Hybrid OS — Handover / Pickup Point

Last updated: 2026-09-17

This is the authoritative continuation brief for Hybrid OS. A fresh coding/chat session should be able to continue from here without reconstructing the project from old conversations.

## 1. Product definition

Hybrid OS is a reusable multi-gym SaaS / operating system for independent gyms and hybrid-style training facilities.

The product is one underlying operating system with three distinct role experiences:

### Admin Console

Owner/admin control over:

- gym setup and branding
- memberships and revenue configuration
- members
- staff and permissions
- staff working hours
- staff qualifications/capabilities
- class/service setup
- timetable
- class bookings and attendance
- rooms/areas/equipment
- resource availability
- door access
- reporting
- account settings
- future payment/integration setup

### Staff Portal

Staff should see operational tools appropriate to their role rather than a stripped-down Admin page.

Current/future staff concepts include:

- own timetable
- assigned classes
- today/upcoming sessions
- class rosters
- mark attended/no-show
- own working hours
- PT appointments
- permitted member lookup
- permitted resource booking
- permission-aware operational tools

### Member Portal

Members should see:

- account/profile
- membership
- classes and bookings
- workouts
- PBs/progress
- Strava/integrations
- door access
- Social/community
- future PT and payment/self-service features

The same underlying data should drive all three experiences.

---

## 2. Repository, hosting and backend

### GitHub

Repository: `PerranporthAFCMens/HybridOS`

Branch: `main`

Live Core:

`https://perranporthafcmens.github.io/HybridOS/`

Actions:

`https://github.com/PerranporthAFCMens/HybridOS/actions`

### Supabase

Project ref: `mzgnhmeydhhpzgxlgudh`

Project URL:

`https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region: London / `eu-west-2`

Do not confuse this with older Football PA/Core projects.

---

## 3. Supported entry points

There should be exactly two supported product entry points:

1. **Hybrid OS Core** — the real product code/UI.
2. **Hybrid Hub demo** — dedicated demo tenant using the same Core product.

Do not create another standalone Admin demo.

### Hybrid Hub demo

Login:

`https://perranporthafcmens.github.io/HybridOS/demo-login.html`

Public demo credentials:

- Email: `demo@hybridhub.test`
- Password: `HybridHubDemo!26`

These are demo-only.

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
- GoCardless-ready payment schema
- Strava scaffold
- mobile-first UI direction

A future move to a framework such as Next.js/TypeScript remains reasonable once workflows stabilise, but the current static structure is being retained for speed.

---

## 5. Main frontend files

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
- `member-preview.html` — member experience preview/helper
- `social.html` — gym social feed
- `integrations.html` — integrations/Strava
- `member-memberships.html` — older transitional page; should eventually be retired

### Shared helpers/styles

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
- `operations-scheduling-link.js`

---

## 6. Current Admin Console

The Admin Console now includes:

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

On mobile, Admin uses a shared hamburger/drawer rather than the old bottom navigation rail.

The top-right user chip on the Admin dashboard now acts as an account menu.

Account settings support updating:

- display name
- first name
- last name
- email
- password

Profile updates use the user’s own `profiles` row; auth email/password changes use Supabase Auth.

---

## 7. Shared styling / CSS consistency

Recent work has focused on stopping each page from drifting visually.

Current shared direction:

- consistent light Hybrid OS page background
- mobile safe-area coverage
- no dark/grey bands above/below the page on iPhone
- consistent 100dvh handling
- same rounded hamburger treatment across Admin/Member where appropriate
- consistent drawer/backdrop behaviour
- shared Admin shell styles
- shared Member mobile navigation treatment
- asset cache-busting by deployment SHA

A consistency pass has been applied across Admin, Staff, Member, Social, integrations and setup/reporting pages.

There is still technical debt because individual HTML files contain substantial inline CSS. Long-term, more of this should move into shared source-level styles rather than deployment injection.

---

## 8. Classes and timetable

The class system currently uses:

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

The mobile Classes page now uses a selected-day model inspired by the supplied reference layout but styled as Hybrid OS:

- horizontally scrollable date strip
- selected date tile
- one-day session list
- class cards
- booked/capacity badge
- Hybrid OS colours and rounded card treatment

### Calendar views

Operational view modes now include:

- **Gym** — all sessions
- **Staff** — filter by selected staff member
- **Resource** — filter by room/area/equipment

Session cards can display assigned staff/resources.

### Next calendar improvement

The next useful step is richer session management when opening a class:

- full roster
- staff assignment
- room/resource assignment
- capacity
- attendance status
- quick Admin actions

---

## 9. Scheduling engine — implemented foundation

This is no longer just a future target.

When a class/session is created, Hybrid OS can validate:

- required staff capabilities
- staff working hours
- staff clashes
- resource availability
- resource clashes
- resource/room capacity

Required resources from the class definition can be assigned automatically.

The class save flow was also changed to be atomic so a failure does not leave a partially-created session with missing related records.

Important consequence: future scheduling UI should call/use the existing validation flow rather than reimplementing scheduling rules client-side in a second place.

---

## 10. Class setup / service dependencies

`class-setup.html` is the canonical class/service definition workspace.

A class type supports:

- name
- description
- Beginner / Intermediate / Advanced / All levels
- default duration
- default capacity
- required staff capabilities
- required resources

Examples:

**Spin**

- 45 minutes
- capacity 10
- requires Spin-qualified instructor
- requires Spin Room

### Known limitation

`service_requirements.quantity` exists but the current class setup UI still treats selected requirements as quantity `1`.

A later improvement should allow quantities such as 10 bikes without creating duplicate resources manually.

---

## 11. Staff and resources

Important staff/operations tables include:

- `staff_profiles`
- `staff_working_hours`
- `capabilities`
- `staff_capabilities`
- `resources`
- `resource_availability`
- `service_requirements`

Staff profiles can include:

- role
- job title
- pay information
- employment type
- normal working hours
- capabilities/qualifications

Resources can represent:

- rooms
- areas
- equipment
- other bookable assets

Each resource may have:

- capacity
- bookable state
- overlap rule
- recurring availability windows

`resource-availability.html` is the recurring availability UI.

---

## 12. Staff Portal and permissions

A separate Staff Portal now exists and should remain distinct from Admin.

Current staff permission model is capability-based rather than one hardcoded role.

Presets include:

- Coach / PT
- Reception
- Manager
- Custom

Permission areas can include:

- view timetable
- edit timetable
- create classes
- cancel classes
- mark attendance
- view member contact details
- view/manage memberships
- view reporting
- manage resources
- manage staff
- view own pay
- member/PT notes
- community moderation

Attendance actions are enforced in Supabase as well as the UI.

### Pay privacy

Staff pay must never be exposed to ordinary members. Any future reporting or member-facing query must keep this boundary intact.

---

## 13. Attendance

`class_bookings.status` supports:

- `booked`
- `cancelled`
- `attended`
- `no_show`

The Staff Portal can mark attendance/no-show from class rosters when the user has permission.

This should be the source for class attendance reporting, engagement and future retention automation.

---

## 14. Reporting

`reporting.html` exists as the Admin reporting workspace.

Current reporting direction includes:

### Overview

- active members/memberships
- MRR estimate
- class fill/utilisation
- visits/attendance
- joins
- ended memberships
- no-show rate

### Memberships

- active memberships
- new joins
- ended/cancelled memberships
- paused
- plan mix
- MRR
- average revenue/member

### Classes

- bookings/attendance by class type
- fill/utilisation
- sell-outs and underused sessions
- cancellations/no-shows
- weekday analysis
- time-of-day analysis
- time-slot analysis
- day × time heatmap

The goal is to distinguish “popular class” from “popular slot”.

### Members

- most active
- attended/booked counts
- inactivity windows
- declining engagement
- new members with little/no engagement

### Payments

Future GoCardless area should cover:

- failed payments
- outstanding amount
- recovery state
- mandate problems
- bad debtors

### Export

Reporting should support CSV/Excel export as the reporting UI matures.

---

## 15. Memberships and payments

Important tables include:

- `membership_plans`
- `memberships`
- `payment_records`

Plans support:

- price
- billing interval
- joining fee
- access type
- open gym
- classes
- PT
- classes/week
- trial days
- public/private state

Memberships already carry provider fields for future GoCardless integration.

`payment_records` contains provider payment/customer/mandate/subscription IDs, amount, state, charge date, payout date and failure details.

GoCardless is not yet live.

---

## 16. Door access

Gym access is now persisted rather than just mocked.

Current settings include:

- `access_enabled`
- `access_code`
- member-facing label
- member note

The Hybrid Hub demo currently uses a simple PIN model.

Longer term, if this becomes security-sensitive physical access, move toward a server/RPC/physical access-control integration rather than relying on a plaintext member-readable PIN model.

---

## 17. Member Portal

`member.html` is the canonical member UI.

Main areas include:

- Home
- Classes
- Workouts
- PBs
- Membership
- Integrations
- Profile
- Social

The member mobile experience uses the hamburger/drawer model rather than the older bottom rail.

### Current member UX direction

The member home should feel activity/training-first rather than admin/membership-first.

Prefer:

- upcoming training/classes
- recent activity
- PBs/workouts
- community activity
- contextual membership upgrades only when relevant

---

## 18. Social/community — newly implemented

A proper member social feed exists at:

`social.html`

Current tables:

- `social_posts`
- `social_comments`
- `social_reactions`

The social feed is gym-scoped and supports:

- posting text updates
- profile/avatar display
- relative timestamps
- link detection
- likes/reactions
- comments
- replies
- comment composer
- gym-specific RLS
- moderation-ready owner/admin rules

Social has been wired into Member navigation, including the member-preview path used during demo testing.

### Next social improvements

Most useful next items:

- image/photo upload on posts
- multiple emoji reactions
- edit/delete own posts/comments
- notifications for replies/reactions
- latest community activity on member Home
- moderation tools/reporting

---

## 19. Workouts and PBs

Core tables:

- `workout_sessions`
- `workout_entries`
- `workout_sets`
- `personal_bests`

Tracking should remain flexible:

- reps + weight
- time
- distance
- calories
- custom value/unit

Do not assume all timed PBs use the same comparison direction; race times are usually lower-is-better while holds/duration may be higher-is-better.

---

## 20. Strava

Strava is scaffolded but not production-connected.

Direction to preserve:

- **Strava → Hybrid OS:** can be automatic/webhook-driven.
- **Hybrid OS → Strava:** manual only; explicit member action required.

Do not automatically publish member workouts to Strava.

---

## 21. Branding

**Hybrid OS** = platform/SaaS brand.

**Hybrid Hub** = demo/prospect tenant.

Current Hybrid Hub assets:

- `assets/hybrid-hub-mark.svg`
- `assets/hybrid-hub-logo-horizontal.svg`

Current `tenant-branding.js` still contains Hybrid Hub-specific behaviour. This is transitional.

Long-term tenant branding should come from gym configuration/onboarding and propagate across Admin, Staff, Member, email and booking surfaces.

---

## 22. GitHub Pages deployment behaviour

The workflow is `.github/workflows/pages.yml`.

Important current behaviour:

- deploys on pushes to `main`
- `cancel-in-progress: false`
- shared CSS/JS is injected during deployment
- asset URLs are versioned with the current commit SHA to reduce mobile Safari caching problems

This was changed because rapid commits were causing valid deploys to be marked cancelled, and iPhone Safari was sometimes serving older CSS/JS even after HTML updated.

### Rule

Always check the latest GitHub Actions run before telling the user a frontend change is live.

---

## 23. Deployment-time injection technical debt

The workflow currently injects or modifies several shared assets at deploy time, including:

- tenant branding
- Admin shell/navigation
- account menu
- scheduling/calendar helpers
- member mobile CSS
- Social navigation
- member preview helpers

This works for rapid iteration but is architectural debt.

Long-term:

1. import shared assets directly in source pages
2. remove page mutation from Pages workflow
3. keep the deployment workflow simple

Avoid adding a new one-off deploy mutation if the behaviour can live in a shared source file.

---

## 24. Security baseline

- Never commit Supabase secret/service-role keys.
- Browser code may use only the publishable key.
- All exposed tables require correct grants/RLS.
- Authorisation should use protected `gym_members` roles/permissions, not user-editable metadata.
- Staff pay must remain private.
- Social data must remain gym-scoped.
- Payment credentials remain server/provider-side.
- Security-definer functions need review before production.
- Simple door PIN storage is acceptable for the demo but should be revisited before serious access-control use.

---

## 25. Known current technical/UX debt

- substantial inline CSS remains across individual pages
- deployment workflow still injects shared assets
- tenant branding is still partly hardcoded to Hybrid Hub
- `member-preview.html` is still transitional
- class dependency quantity UI is not complete
- deeper PT booking workflows are not complete
- GoCardless is not live
- Strava production connection is not live
- richer session-detail management is the next calendar improvement
- Social media uploads/notifications are not implemented yet

---

## 26. Agreed build order from here

Current sequence:

1. **Calendar/session management refinement**
   - richer session detail
   - roster/staff/resource/capacity controls
   - quick Admin actions

2. **Staff Portal expansion**
   - rota/working schedule
   - PT appointments
   - member lookup where permitted
   - resource booking
   - more permission-aware operational tools

3. **Member Portal + Social refinement**
   - cleaner member home
   - workout/PB polish
   - Social photos/reactions/notifications
   - account/profile consistency

4. **GoCardless/payments**
   - mandates
   - subscriptions
   - failed payment handling
   - bad debtors reporting

5. **Retention/automation**
   - inactivity detection
   - declining attendance
   - 14/30/60-day engagement rules
   - first 30/60/90-day engagement

6. **Architecture cleanup**
   - consolidate shared CSS/components
   - reduce deploy-time injection
   - continue tenant-neutral branding cleanup

---

## 27. Working rules for future sessions

- Prefer doing over explaining.
- Preserve existing working Supabase persistence.
- Keep Admin, Staff and Member as different experiences over one data model.
- Do not create a parallel demo product.
- Use shared CSS/navigation to avoid visual drift.
- Mobile-first.
- Fetch fresh GitHub SHAs before writes.
- If a workflow is cancelled/incomplete, verify whether its intended changes exist in a later successful commit before dismissing it.
- Do not claim a frontend change is live until the latest Pages run succeeds.
- Keep sensitive data protected at database level, not only hidden in the UI.

---

## 28. Immediate pickup point

At the time of this handover, the most recent product work was:

- shared CSS/safe-area consistency across pages
- fixing Member Preview so Social appears in navigation
- newly implemented Social feed/database
- account settings from the Admin top-right user chip
- calendar Gym/Staff/Resource views
- mobile timetable styling refinement

The next meaningful feature task is **richer class/session management**, unless the user asks to continue Social first.
