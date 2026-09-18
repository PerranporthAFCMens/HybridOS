# Hybrid OS — Authoritative Handover

**Updated: 18 September 2026**

Read this file first in any new development chat. It is the current continuation brief for Hybrid OS and replaces older chat summaries.

## 1. Product

Hybrid OS is a reusable, multi-tenant operating system for independent gyms and hybrid training facilities.

It is one product with three role experiences:

- **Owner/Admin** — gym setup, classes, resources, staff, permissions, members, memberships, reporting, member-facing configuration and operational controls.
- **Staff** — daily operational workspace for coaches, reception and managers.
- **Member** — training-first portal for classes, workouts, PBs, PT, membership, social/community and access.

Do not split these into duplicated apps. Preview modes should reuse Core logic where possible.

## 2. Repository, hosting and backend

- Repository: `PerranporthAFCMens/HybridOS`
- Branch: `main`
- Hosting: GitHub Pages
- Live site: https://perranporthafcmens.github.io/HybridOS/
- Actions: https://github.com/PerranporthAFCMens/HybridOS/actions
- Supabase project ref: `mzgnhmeydhhpzgxlgudh`
- Supabase URL: `https://mzgnhmeydhhpzgxlgudh.supabase.co`
- Region: London / `eu-west-2`

Hybrid OS is separate from the Perranporth Football PA project. Do not modify Football PA when working here.

## 3. Current verified deployment checkpoint

Latest verified successful deployment at this handover:

- Workflow run: **#434**
- Run ID: `35388963127`
- Head SHA: `8054eec3fcb439a7a677370323fb07d8918ab374`
- Commit: **Expose Staff View in owner admin navigation**
- Status: **completed / success**
- Date: 18 September 2026

Always re-check `main` and GitHub Actions before editing or saying anything is live. Other chats/automations may advance the repository.

## 4. Deployment architecture

Deployment path:

**source → `scripts/build_site.py` → isolated `_site` → `scripts/smoke_test.py` → GitHub Pages**

Workflow:

`.github/workflows/pages.yml`

Important rules:

- fetch the latest `main` and current file SHA immediately before every GitHub write
- never parallel-write the same path
- if the SHA changed, re-read and reconcile before updating
- do not call a change live until the corresponding GitHub Pages run is `completed / success`
- keep page-specific JavaScript isolated
- preserve inline and external JavaScript syntax checks in the smoke suite
- do not weaken CI to force deployment through

Recent CI recovery:
- Staff View work initially failed because a literal `\n` was inserted into `shared-admin-nav.js`
- smoke tests correctly blocked the deploy
- source was fixed in commit `3fd5193f`
- later Staff View surfacing work successfully deployed in run #434

## 5. Shared UI architecture

Canonical shared layers:

- `app-consistency.css`
- `admin-pages.css`
- `admin-shell.css`
- `member-experience.css`
- `staff-operations.css`
- `shared-shell.js`

Approved design language:

- background `#f5f7fb`
- dark/navy `#0b1020`
- white cards
- green/teal accents
- border `#e7ebf2`
- rounded controls
- restrained shadows
- mobile-first layouts
- immediate visual feedback for actions

Avoid duplicate nav, random dividers, horizontal overflow, cramped mobile controls and desktop layouts squeezed onto iPhone.

## 6. Owner/Admin shell

`admin.html` is the persistent parent shell.

Important files:
- `admin-frame.js`
- `admin-frame.css`
- `shared-admin-nav.js`
- `admin-embed.js`

The shell uses embedded child pages with `?embedded=1`.

Current main Admin navigation includes:

- Dashboard
- Community
- Classes
- Workouts
- Services & resources
- Staff management
- Members
- Member view
- **Staff view**
- Reporting

### Staff View

The user reported that Staff View was not visible.

Current status:
- `shared-admin-nav.js` contains **Staff view**
- `admin-frame.js` contains a **Staff view** route pointing to `./staff.html?view=staff`
- `staff.html` contains owner/admin preview handling and a “Back to Owner/Admin” banner
- commit `8054eec3fc` explicitly surfaced Staff View in owner admin navigation
- deployment #434 passed successfully

This is **deployed but still needs user validation in the UI**. If the user still cannot see it, inspect the actual rendered Owner/Admin shell and caching before changing the underlying Staff Portal.

## 7. Staff Portal

Primary files:

- `staff.html`
- `staff-shell.js`
- `staff-operations.js`
- `staff-operations.css`
- `staff-permissions.html`

Role/permission concepts include:

- Coach/PT
- Reception
- Manager
- Custom
- full-access staff can enter Owner/Admin where permitted

Staff capability currently includes:

- assigned classes
- today/upcoming classes
- roster and attendance
- no-show/reset
- working hours / rota
- shift snapshot
- permission-aware member lookup
- contact details where permitted
- assigned resources
- access quick card
- PT appointments
- create PT appointment
- PT appointment status updates

Owners should be able to switch between Owner/Admin, Staff and Member experiences. Staff should have Staff/Member, with Owner/Admin available only when their access permits it.

## 8. Member Portal

Primary files:

- `member.html`
- `member-preview.html`
- `member-experience.js`
- `member-experience.css`
- `member-coach.js`
- `member-coach.css`
- `member-workouts-v2.js`
- `member-workouts-v2.css`

Core member areas include:

- Home
- Classes/bookings
- Workouts
- PBs
- PT
- Membership
- Profile/account
- Integrations
- Social/community
- access

Member Home is deliberately training-first. Training goal/progress should remain prominent rather than allowing the product to become class-sales-first.

Recent Social work:
- latest Social posts are surfaced on Member Home
- Social engagement was added to Member Home
- run #433 deployed **Show Social engagement on member home**

## 9. Workouts V2

The workout model is no longer “one workout = one exercise”.

Current direction:
- workout is a container/session
- examples: Legs Day, Back & Chest, Arms, Cardio
- multiple exercises/activities belong to a workout
- staff/PT can assign a workout to a member
- gym can soft-push a WOD (Workout of the Day)
- members can choose to pick up an optional WOD

Recent commits before this handover included Staff Workout V2 builder, Admin navigation and PT/member assignment flow.

Preserve this multi-exercise model.

## 10. Gym Layout — current state and parked decision

Primary file:

`gym-layout.html`

The concept is self-onboarding: gyms should be able to build their own floor map without Hybrid OS manually drawing it.

Current implemented direction:
- optional floorplan/sketch upload
- blank grid
- draw gym outline
- rooms
- walls
- doors
- zones
- equipment placement
- expanded brand-neutral equipment catalogue
- equipment/exercise linkage
- independent equipment width/height
- snapping
- mobile support
- Undo
- Clear
- guided 4-step wizard
- inline equipment picker alongside the map
- quantity per equipment marker

Current wizard:
1. Draw gym
2. Mark zones
3. Place equipment
4. Preview

Recent deployment chain:
- #429 rebuilt the mobile interaction layer
- #430 made the stages a real wizard
- #431 kept the equipment picker on the same screen as the map
- #432 restored quantity per equipment marker

Important UX feedback from the user:
- flipping between Setup and Map was too cumbersome
- equipment list needs to stay on the same view as the map
- a single marker must be able to represent multiple identical machines, e.g. Treadmill ×6
- current map/editor still feels **too small / too cramped**
- user explicitly said to **park Gym Layout for now and keep moving**

Do not spend the next session polishing Gym Layout unless the user reopens it.

Current persistence is browser `localStorage` under:

`hybrid_gym_layout_draft_v1`

A future production version should likely move layout data to Supabase/Storage once the UX is validated.

## 11. Classes and scheduling

Key files:

- `classes.html`
- `class-setup.html`
- `calendar-mobile.js/css`
- `calendar-views.js/css`
- `scheduling-engine.js`
- `session-manager.js/css`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Scheduling validation includes:

- staff capability
- staff working hours
- staff clash
- resource availability
- resource clash
- room/resource capacity

Do not create a second client-only scheduling/conflict engine when existing RPC/business logic already covers it.

## 12. Member View editor

Admin page:

`member-view-settings.html`

Purpose:
- owner/admin controls Member Home layout
- show/hide tiles
- reorder tiles
- phone preview
- save/reset
- open Member Preview

Persistence:
- table `gym_member_view_settings`
- direct table access owner/admin only
- members consume via `get_member_home_layout(p_gym_id uuid)`

Do not weaken RLS by giving ordinary members direct access to the Admin configuration table.

## 13. Social/community

Primary files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`
- `social-notifications.js`
- `community.html`

Core tables include:

- `social_posts`
- `social_comments`
- `social_reactions`

Current capabilities include:
- posts
- comments
- reactions
- edit/delete own content
- ownership checks
- Member Home Social summaries/engagement

Future depth can include photos, richer reactions, pinned announcements and stronger notifications.

## 14. Supabase/data model highlights

Core:
- `gyms`
- `gym_members`
- `profiles`

Scheduling:
- `class_types`
- `class_sessions`
- `class_bookings`
- `class_session_staff`
- `class_session_resources`
- `resources`
- `resource_availability`
- `staff_profiles`
- `staff_working_hours`
- `staff_capabilities`

Staff/member:
- `pt_appointments`

Training:
- workout session / entry / set objects
- `personal_bests`

Social:
- `social_posts`
- `social_comments`
- `social_reactions`

Config/access:
- `gym_access_settings`
- `gym_member_view_settings`

Known member-facing RPCs:
- `member_class_schedule`
- `member_book_class`
- `member_cancel_class`
- `get_member_home_layout`

For Supabase changes, read the current Supabase skill/docs first, keep explicit grants/RLS, and review security-definer functions carefully.

## 15. Security baseline

- never commit secret/service-role keys
- frontend uses publishable key only
- RLS on exposed tables
- gym-scoped tenant data
- staff permissions enforced server-side where meaningful
- owner/admin-only configuration must be enforced both in UI and database
- ordinary members must not see staff pay or sensitive staff data
- social edits/deletes must enforce ownership
- use narrow RPCs/views instead of weakening table access to support member rendering

## 16. Immediate next pickup

### First task
**Validate Staff View from the Owner/Admin experience.**

Because run #434 successfully deployed the nav entry, start by opening Owner/Admin and confirming:
- Staff view is visible
- it opens `staff.html?view=staff`
- owner/admin preview banner displays
- Back to Owner/Admin works
- mobile access to Staff View is obvious
- no duplicate navigation appears

If it is still missing, investigate shell/render/cache behaviour rather than rebuilding the Staff Portal.

### Then
Continue Staff/Member product depth rather than returning to Gym Layout.

Useful next directions:
- strengthen Staff View navigation and role switching
- continue PT-to-member workout assignment
- improve WOD flow
- deepen Member workout completion experience
- continue Social/member engagement
- reporting/engagement after Member/Staff workflows are rounded out

## 17. Roadmap order

1. **Staff + Member workflow depth**
   - Staff View validation
   - PT workout assignment
   - WOD
   - member workout completion/progress
2. **Member + Social polish**
3. **Reporting + engagement**
4. **Email/SMS communications**
5. **Retention automation**

Payment-provider work remains parked unless the user explicitly reopens it.

## 18. Working practices

Always:
- fetch latest `main`
- fetch current file SHA immediately before writing
- make focused commits
- preserve concurrent work
- inspect the newest Actions run
- follow failed CI to the exact failing check
- never bypass smoke tests
- only say “live” after deployment success

The repository can change while a chat is active. Another chat or automation may be committing at the same time.

## 19. User/product preferences

- British English
- avoid em dashes
- implementation is preferred over long abstract discussion
- mobile usability matters heavily
- obvious tactile feedback matters
- user wants working product visible quickly
- when the user says “do it”, implement rather than only describing

