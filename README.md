# Hybrid OS

Hybrid OS is a reusable, multi-tenant operating system for independent gyms and hybrid training facilities.

It is one product with three role-specific experiences:

- **Owner/Admin** — setup, scheduling, staff, resources, memberships, members, reporting and configuration
- **Staff** — classes, attendance, member support, PT, rota/resources and operational delivery
- **Member** — training, workouts, PBs, classes, PT, membership, access and community

> Start every new development session with [HANDOVER.md](./HANDOVER.md). It is the authoritative continuation brief.

## Current status

Latest verified deployment at this README refresh:

- GitHub Pages run: **#434**
- Commit: `8054eec3fcb439a7a677370323fb07d8918ab374`
- Title: **Expose Staff View in owner admin navigation**
- Status: **completed / success**
- Date: 18 September 2026

Always check the latest Actions run before assuming this is still the newest production state.

## Stack

- Repository: `PerranporthAFCMens/HybridOS`
- Branch: `main`
- Frontend: static HTML/CSS/JavaScript
- Hosting: GitHub Pages
- Backend/Auth/Database: Supabase
- Supabase project ref: `mzgnhmeydhhpzgxlgudh`
- Region: London / `eu-west-2`
- Live site: https://perranporthafcmens.github.io/HybridOS/
- Actions: https://github.com/PerranporthAFCMens/HybridOS/actions

Hybrid OS is separate from the Perranporth Football PA project. Do not modify Football PA from this repo.

## Deployment

Deployment is:

**source → `scripts/build_site.py` → isolated `_site` → `scripts/smoke_test.py` → GitHub Pages**

Workflow:

`.github/workflows/pages.yml`

Development rules:

- fetch current `main` and the current file SHA immediately before every write
- do not parallel-write the same path
- reconcile concurrent changes rather than overwriting them
- preserve the smoke suite
- follow CI failures to the exact failing source
- only call a change live after the Pages run completes successfully

## Product areas

### Owner/Admin

The Admin experience uses a persistent shell through:

- `admin.html`
- `admin-frame.js`
- `admin-frame.css`
- `shared-admin-nav.js`
- `admin-embed.js`

Current main navigation includes:

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

The latest Staff View surfacing change deployed successfully in run #434. It still needs user validation in the rendered UI.

### Staff

Primary files:

- `staff.html`
- `staff-shell.js`
- `staff-operations.js`
- `staff-operations.css`
- `staff-permissions.html`

Current operational areas include:

- assigned classes
- today/upcoming classes
- rosters and attendance
- no-show/reset
- working hours / rota
- permission-aware member lookup
- assigned resources
- gym access
- PT appointments and status updates

Owners/admins should be able to preview Staff View and return to Owner/Admin.

### Member

Primary files:

- `member.html`
- `member-preview.html`
- `member-experience.js`
- `member-experience.css`
- `member-workouts-v2.js`
- `member-workouts-v2.css`
- `member-coach.js`
- `member-coach.css`

Member areas include:

- training-first Home
- classes and bookings
- workouts
- PBs
- PT
- membership
- profile/account
- integrations
- Social/community
- access

Recent work also surfaces Social posts and engagement on Member Home.

## Workouts V2

A workout is a multi-exercise container, not a single exercise.

Supported product direction includes:

- Legs Day / Back & Chest / Arms / Cardio style workouts
- multiple exercises or activities in one workout
- PT/staff assignment to a member
- optional gym WOD
- member pickup/completion flow

Preserve this model in future work.

## Gym Layout

Primary file:

`gym-layout.html`

Implemented concepts include:

- optional floorplan upload
- blank grid
- outline / room / wall / door drawing
- zones
- equipment catalogue
- quantity per equipment marker
- move/resize
- snapping
- mobile interaction
- Undo / Clear
- guided 4-step wizard
- equipment picker on the same screen as the map

Current user feedback:

- the editor still feels too small/cramped
- flipping between panels was too hard, so the equipment picker was moved onto the map screen
- one marker must be able to represent multiple identical machines
- **Gym Layout is currently parked**

Do not make Gym Layout the next workstream unless the user explicitly reopens it.

## Member View editor

`member-view-settings.html` lets owner/admin users configure Member Home.

It supports:

- show/hide
- drag reorder
- phone preview
- save/reset
- Member Preview

Persistence:

- table: `gym_member_view_settings`
- direct table access: owner/admin only
- members consume layout via `get_member_home_layout(p_gym_id uuid)`

Do not weaken RLS by giving ordinary members direct access to the Admin configuration table.

## Classes and scheduling

Important files:

- `classes.html`
- `class-setup.html`
- `calendar-mobile.js`
- `calendar-views.js`
- `scheduling-engine.js`
- `session-manager.js`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Scheduling covers staff capability, working hours, staff clashes, resource availability, resource clashes and capacity.

Use existing scheduling/RPC logic rather than creating a second conflict engine.

## Social

Primary files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`
- `social-notifications.js`
- `community.html`

Core objects include:

- `social_posts`
- `social_comments`
- `social_reactions`

Current features include posts, comments, reactions, ownership-aware edit/delete and Member Home Social summaries.

## Shared design system

Canonical layers:

- `app-consistency.css`
- `admin-pages.css`
- `admin-shell.css`
- `member-experience.css`
- `staff-operations.css`
- `shared-shell.js`

Design principles:

- mobile-first
- light `#f5f7fb` background
- dark `#0b1020` navigation
- white cards
- green/teal accents
- subtle borders
- rounded controls
- restrained shadows
- immediate action feedback

Avoid duplicate navigation, random dividers, horizontal overflow and page-local reinvention of shared components.

## Security baseline

- never commit Supabase secret/service-role keys
- frontend uses publishable credentials only
- RLS on exposed tables
- gym-scoped tenant data
- server-side permission enforcement where meaningful
- owner/admin-only configuration enforced in both UI and database
- members must not see sensitive staff/pay data
- social edit/delete must enforce ownership
- prefer narrow RPCs/views rather than weakening table access

## Next pickup

Start with **Staff View validation**:

1. confirm Staff view is visible in Owner/Admin
2. confirm it opens `staff.html?view=staff`
3. confirm the owner/admin preview banner is visible
4. confirm Back to Owner/Admin works
5. confirm mobile access is obvious
6. confirm no duplicate navigation appears

If Staff View is still not visible, investigate rendered shell/cache behaviour before rebuilding the Staff Portal.

After that, continue:

1. Staff + Member workflow depth
2. PT workout assignment / WOD
3. Member workout completion/progress
4. Social/member engagement
5. Reporting + engagement
6. communications
7. retention automation

Payment-provider work remains parked unless explicitly reopened.
