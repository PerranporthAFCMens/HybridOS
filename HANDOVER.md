# Hybrid OS — Full Handover / Next-Chat Pickup

**Updated: 18 September 2026**

This is the authoritative continuation brief for Hybrid OS. A new chat should read this file first and continue from the current repository/Supabase state rather than reconstructing the project from older conversation history.

---

## 1. Product definition

Hybrid OS is a reusable, multi-tenant operating system for independent gyms and hybrid training facilities.

It is **one product** with three role experiences:

### Admin Console
Owner/admin control over gym setup, scheduling, staff/resources, permissions, memberships, members, reporting, access and member-facing configuration.

### Staff Portal
Operational workspace for staff/coach/reception/manager roles, driven by granular permissions.

### Member Portal
Training-first member experience for classes, bookings, workouts, PBs, PT, membership, profile, access and community.

Do not split these into separate duplicated apps. Demo/preview experiences should reuse Core logic.

---

## 2. Repo, hosting and backend

Repository:

`PerranporthAFCMens/HybridOS`

Branch:

`main`

Live Core:

https://perranporthafcmens.github.io/HybridOS/

GitHub Actions:

https://github.com/PerranporthAFCMens/HybridOS/actions

Supabase project ref:

`mzgnhmeydhhpzgxlgudh`

Supabase URL:

`https://mzgnhmeydhhpzgxlgudh.supabase.co`

Region:

London / `eu-west-2`

Do **not** confuse Hybrid OS with Football PA/Core. This project must not modify the Perranporth Football PA app.

---

## 2A. Current verified production checkpoint

At the time this handover was refreshed, the latest verified successful deployment was:

- Workflow: `Deploy Hybrid OS prototype`
- Run number: `234`
- Run ID: `35319011330`
- Head SHA: `719046a45cc5c7a1de4777f95a8b56921e3181fb`
- Commit title: `Remove obsolete member inline repair step`
- Status: `completed / success`
- Completed: 18 September 2026

Treat this as the last known-good production checkpoint, **not** as a promise that it will still be the newest commit in the next chat. The hourly Hybrid OS development automation is active and may have pushed newer work. Always inspect the latest Actions run before editing or calling anything live.

---

## 3. Supported entry points

There are two supported product entry points:

1. **Hybrid OS Core**
2. **Hybrid Hub demo**

Hybrid Hub demo:

https://perranporthafcmens.github.io/HybridOS/demo-login.html

Public demo credentials:

- `demo@hybridhub.test`
- `HybridHubDemo!26`

`member-preview.html` is a helper/test view, not a third product.

---

## 4. Current architectural approach

Current architecture is intentionally still:

- static HTML/CSS/JavaScript
- GitHub Pages
- Supabase Auth
- PostgreSQL/RLS
- gym-scoped multi-tenancy
- build-time assembly into `_site`

Do not migrate frameworks just for cleanliness while product workflows are still moving quickly.

GoCardless/payment-provider integration is deliberately parked.

Email/SMS is planned later as one shared communications layer.

---

## 5. Deployment and stability architecture

Deployment path:

**source files → `scripts/build_site.py` → isolated `_site` → `scripts/smoke_test.py` → GitHub Pages**

Workflow:

`.github/workflows/pages.yml`

Key stability files:

- `app-stability.js`
- `app-consistency.css`
- `scripts/build_site.py`
- `scripts/smoke_test.py`

Important rules:

- source is not progressively mutated in-place by the deployment workflow
- page-specific runtime must stay scoped to its page
- build assets are cache-busted by deployment SHA
- do not reintroduce JS loaders that dynamically load page-specific scripts
- mobile shell/navigation styling is shared
- legacy Member/Staff bottom navigation is stripped from the built site
- Classes owns its direct class-admin scripts
- Member Preview helpers must not leak into Member
- Staff helpers must not leak into Admin/Member

### Recent stability issue that was fixed

The live Member Portal showed:

`Left side of assignment is not a reference.`

Root cause: `build_site.py` changed:

`$('membershipShort').textContent=...`

into invalid JavaScript:

`$('membershipShort')?.textContent=...`

Optional chaining cannot be used on the left side of assignment.

Fix now in source:

`const membershipShort=$('membershipShort'); if(membershipShort) membershipShort.textContent=...`

The build-time invalid transformation has been removed.

The smoke test was also upgraded to syntax-check **inline JavaScript blocks**, not only external `.js` files. Preserve this guard.

---

## 6. Shared design system

The app now has a genuine shared component layer.

Canonical design system:

`app-consistency.css`

It owns:

- design tokens
- typography
- page headings
- cards/panels
- buttons
- pills/tags
- form controls
- user chips/avatars
- modals
- spacing
- desktop sidebar language
- mobile drawers/hamburgers
- mobile safe-area handling

Admin experience layer:

`admin-pages.css`

Admin-only transitions/loading:

`admin-shell.css`

Member feature layer:

`member-experience.css`

Staff operational styling:

`staff-operations.css`

Do not create another generic card/button/sidebar implementation in a page-local stylesheet unless absolutely necessary.

---

## 7. Admin Console current state

Core Admin pages include:

- `index.html`
- `classes.html`
- `class-setup.html`
- `admin-operations.html`
- `resource-availability.html`
- `staff-permissions.html`
- `access-settings.html`
- `reporting.html`
- `member-view-settings.html`

Shared Admin navigation:

`shared-admin-nav.js`

Current Admin nav includes:

- Dashboard
- Classes
- Class setup
- Staff & resources
- Staff access
- Door access
- Reporting
- Memberships
- Members
- Community
- **Member view**
- Member preview

The Member view editor is owner/admin-only.

---

## 8. Calendar, scheduling and session management

This was the first major roadmap phase and is substantially implemented.

Important files:

- `classes.html`
- `calendar-mobile.js/css`
- `calendar-views.js/css`
- `scheduling-engine.js`
- `session-manager.js/css`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Calendar modes:

- Gym
- Staff
- Resource

Scheduling validation covers:

- required staff capability
- staff working hours
- staff clash
- resource availability
- resource clash
- resource/room capacity

Session manager supports:

- session detail
- title/description where supported
- date/time
- duration
- capacity
- reserved capacity
- assigned staff
- lead staff
- resources/rooms
- resource quantities
- roster
- attendance/no-show/reset
- cancel/reopen
- session editing/reassignment

Use existing scheduling validation/RPC logic for further edits. Do not create a second client-only conflict engine.

---

## 9. Staff Portal current state

Files:

- `staff.html`
- `staff-shell.js`
- `staff-operations.js`
- `staff-operations.css`
- `staff-permissions.html`

Role/permission presets:

- Coach/PT
- Reception
- Manager
- Custom

Current Staff Portal capability includes:

- assigned classes
- today/upcoming classes
- roster
- attendance/no-show/reset
- working-hours/rota view
- shift snapshot
- permission-aware member lookup
- contact details only if permitted
- assigned resources
- gym access quick card
- PT appointments
- create PT appointment
- member/date/start/duration/notes
- appointment statuses: completed / no-show / cancelled

Supabase:

`pt_appointments`

Members can see their own upcoming PT appointments; Staff/Admin access follows role/policy.

---

## 10. Member Portal current state

Canonical live page:

`member.html`

Preview helper:

`member-preview.html`

Main runtime:

- `member-experience.js`
- `member-experience.css`
- `member-coach.js`
- `member-coach.css`
- `pb-workout-enhancements.js`

Preview-only runtime:

- `member-preview-controls.js`
- `member-preview-classes.js`

### Member navigation/account

Member Preview navigation was fixed so sidebar buttons actually switch pages.

The top-right member avatar/user chip in preview now opens an account menu with:

- My account
- Back to admin

Preview account editing stores demo changes locally rather than modifying real member data.

### Class booking

Member booking is now deeper than the original class list.

Current Member class experience includes:

- live 30-day schedule
- remaining-capacity counts
- Upcoming filter
- My bookings filter
- Spaces available filter
- immediate Saving feedback
- atomic booking/cancellation
- booked-class Home summaries

Member RPCs:

- `member_class_schedule`
- `member_book_class`
- `member_cancel_class`

Do not replace these with direct unguarded booking writes.

### Member Home

Recent Home work includes:

- training-first hero
- Training goal
- Training snapshot
- Recent activity
- My booked classes
- PT appointments
- classes/bookings
- membership
- weekly plan/coach layer

The user specifically wants **Training goal to be prominent**, not a class-sales-first Home.

---

## 11. Admin-controlled Member Home layout

This is the most recent product addition and is important.

Admin page:

`member-view-settings.html`

Navigation label:

**Member view**

Purpose: allow the gym owner/admin to control what members see on Home.

### UI

The page shows:

- a list of Home tiles
- show/hide checkbox per tile
- phone preview
- Save
- Reset
- Open Member Preview

Tiles can be dragged.

The drag interaction is intentionally tactile:

- tile visually lifts out
- shadow/scale/very slight tilt
- follows pointer/finger
- surrounding tiles animate aside
- tile clips/snaps into place
- phone preview animates into the new order

### Recent Member-view interaction refinement

The reordering interaction was deliberately upgraded from simple row jumping to a visual editor:

- the dragged tile lifts out of the list
- it gets stronger shadow, scale and slight tilt
- it follows mouse/finger position
- other tiles animate out of the way
- the tile snaps/clips into its new position
- the phone preview animates to the same new order

Do not regress this back to instant non-visual reordering.

### Configurable tiles

Keys/default labels:

- `goal` — Training goal
- `progress` — Training snapshot
- `activity` — Recent activity
- `hero` — Training hub
- `upcoming_count` — Upcoming bookings
- `next_classes` — Next classes
- `membership` — Membership
- `booked_classes` — My booked classes
- `pt` — PT appointments

Default order:

1. goal
2. progress
3. activity
4. hero
5. upcoming_count
6. next_classes
7. membership
8. booked_classes
9. pt

### Persistence/security

Table:

`gym_member_view_settings`

Columns include:

- `gym_id`
- `home_layout jsonb`
- `updated_at`
- `updated_by`

Important security decision:

**The table itself is Admin configuration and should only be directly available to owner/admin logins.**

Current policies:

- owner/admin SELECT
- owner/admin INSERT
- owner/admin UPDATE
- owner/admin DELETE

Members consume the layout through:

`get_member_home_layout(p_gym_id uuid)`

That RPC is security-definer, requires authentication, verifies the caller is an active member of the requested gym, and only returns the layout JSON.

This preserves the requirement that the setting itself is Admin-only while still allowing the Member Portal to render the Admin-selected layout.

### Admin-only security rule for this feature

This was explicitly confirmed after the first layout-editor pass:

- the **editor UI is for owner/admin logins only**
- ordinary members must not gain direct read access to `gym_member_view_settings`
- ordinary members must not insert/update/delete rows in that table
- member rendering should keep using the narrow `get_member_home_layout` RPC rather than weakening table RLS
- if more Member Home settings are added later, extend the JSON/RPC pattern rather than exposing the Admin table

Member Preview can also cache the saved layout locally for realistic preview behaviour.

---

## 12. Workouts, PBs and training goal

Workout tracking supports:

- reps + weight
- time
- distance
- calories
- custom

PB tracking is live.

Member Home training snapshot pulls recent workout/PB data.

Weekly training goal:

- member chooses target sessions/week
- current prototype stores the target locally
- Home shows ring/bar/progress messaging
- current week workout count drives progress

There is also a `member-coach.js` / `member-coach.css` layer for weekly-plan coaching.

Do not let Home drift back into “sell classes first”. Training/progress should lead.

---

## 13. Social/community current state

Files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`

Tables:

- `social_posts`
- `social_comments`
- `social_reactions`

Current enhancement bridge supports:

- update own post
- delete own post
- update own comment
- delete own comment
- set/update reaction
- ownership markers in rendered data

Next Social depth can include:

- photos
- richer reaction UI
- reply/reaction notifications
- pinned announcements
- richer Member Home community activity
- moderation polish

---

## 14. Door access

Admin:

`access-settings.html`

Table:

`gym_access_settings`

Current prototype supports:

- access enabled toggle
- PIN/code
- member-facing label
- member note

Member Portal can reveal the configured code.

This is prototype-grade access, not a production physical-access security system.

---

## 15. Reporting

File:

`reporting.html`

Reporting direction includes:

- memberships
- active members
- MRR
- class fill
- attendance/no-show
- joins/cancellations
- plan mix
- class performance
- utilisation
- day/time demand
- inactivity/engagement
- export

This is the next major roadmap phase after Member/Social is rounded out.

---

## 16. Supabase/data objects worth knowing

Important existing or recent objects include:

### Core gym/auth
- `gyms`
- `gym_members`
- `profiles`

### Classes/scheduling
- `class_types`
- `class_sessions`
- `class_bookings`
- `class_session_staff`
- `class_session_resources`
- `class_session_reserved_plans`
- `resources`
- `resource_availability`
- `staff_profiles`
- `staff_working_hours`
- `staff_capabilities`
- `service_requirements`

### Staff/member operations
- `pt_appointments`
- notification preference/calendar feed objects

### Member training
- `workout_sessions`
- workout entries/sets
- `personal_bests`

### Social
- `social_posts`
- `social_comments`
- `social_reactions`

### Access/config
- `gym_access_settings`
- `gym_member_view_settings`

Recent member-facing RPCs:

- `member_class_schedule`
- `member_book_class`
- `member_cancel_class`
- `get_member_home_layout`

---

## 17. Files added/changed heavily in the latest work

High-value current files:

- `member-view-settings.html` — new visual Member Home editor
- `member-experience.js` — booking/Home/progress/layout runtime
- `member-experience.css` — member UI/layout
- `member-coach.js`
- `member-coach.css`
- `member-preview-controls.js`
- `member-preview-classes.js`
- `staff-operations.js`
- `staff-operations.css`
- `social-enhancements.js`
- `admin-pages.css`
- `shared-admin-nav.js`
- `app-consistency.css`
- `scripts/build_site.py`
- `scripts/smoke_test.py`

Obsolete files already removed and should stay removed:

- `member-mobile-rail.css`
- `staff-shell.css`
- `class-admin-loader.js`

---

## 18. Known UX direction

Approved design language:

- background `#f5f7fb`
- dark navy `#0b1020`
- white cards
- green/teal accents
- subtle `#e7ebf2` borders
- rounded controls
- restrained shadows
- mobile hamburger approx 44×44
- safe-area-aware light mobile surfaces

User is sensitive to:

- inconsistent styling between pages
- random dividers
- cramped mobile layout
- horizontal overflow
- controls that look bolted on
- desktop layouts leaking onto iPhone
- interactions with no immediate feedback

Prefer tactile, obvious feedback for save/drag/booking actions.

---

## 19. Active automation

An hourly automation named:

**Hybrid OS Hourly Dev**

is active.

Its purpose is to:

- verify the previous GitHub Pages deployment
- complete one meaningful roadmap slice
- preserve design/runtime isolation
- avoid touching Football PA

Be aware of this in a new chat: repository changes may have landed since this handover was written. Always fetch the latest files/SHAs and latest Actions run before editing.

---

## 20. Immediate pickup / recommended next work

Do **not** start another cleanup workstream unless a concrete regression appears.

First, verify current production from the last known-good deployment and any newer automation commits:

1. latest GitHub Actions run is successful
2. `member.html` loads on iPhone
3. `member.html#classes` deep-links correctly
4. Member Preview remains full-width on mobile
5. Member view editor can save without RLS errors
6. drag reordering feels tactile on iPhone
7. saved Admin tile order appears in Member Portal
8. non-admin/member account cannot open or directly manage Member view settings

Then resume the roadmap:

### Next product phase: finish Member + Social
- finish Home/booking/workout/PB polish
- Social photos
- richer reactions
- notifications
- Home community activity

### Then: Reporting + engagement
- attendance trends
- utilisation
- inactivity
- new-member engagement
- exports

### Then: communications
- email/SMS messaging/reminders/announcements
- templates
- consent
- history
- segments

### Then: retention automation
- declining engagement
- inactivity
- 30/60/90-day member checks
- staff follow-up queues

Payment-provider work stays parked unless the user explicitly reopens it.

---

## 21. GitHub working practices

Always:

- fetch the current file SHA immediately before update
- do not perform parallel writes to the same path
- reconcile if the SHA changed
- keep changes focused
- update smoke tests when a new runtime boundary or regression class is introduced
- inspect the newest GitHub Actions run
- only say “live” when the relevant deployment completed successfully

---

## 22. Security rules

- no secret/service-role keys in browser/repo
- publishable Supabase key only in frontend
- RLS on exposed tables
- gym scoping for all tenant data
- staff permissions enforced server-side where meaningful
- Admin-only configuration pages must check both UI role and database policy
- member direct access to Admin configuration tables should not be granted merely to render configuration; use a narrow RPC/view where appropriate
- own social content edits/deletes must check ownership
- ordinary members must never see staff pay/sensitive staff data

---

## 23. What not to do next

Avoid:

- another generic styling rewrite
- rebuilding Admin/Member as separate demo apps
- reintroducing GoCardless as a priority
- duplicating scheduling validation
- broad framework migration
- touching Football PA
- relying on source-only checks without built/deployed verification

The product is now in feature-deepening mode.

