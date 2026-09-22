# HybridOne — Authoritative Handover

**Updated: 22 September 2026**

Read this file first in any new development chat. It is the authoritative continuation brief for the product now branded **HybridOne**.

This repository was originally called **HybridOS** and many internal technical identifiers still intentionally use `hybrid` / `HybridOS`. Do not perform a blind technical rename. The current rebrand is primarily user-facing and should stay low-risk.

---

## 1. Product identity

**Product name:** HybridOne  
**Positioning:** *The operating system for hybrid gyms.*

HybridOne is a reusable, multi-tenant SaaS platform for independent gyms and hybrid training facilities.

It has three role-specific experiences:

- **Owner/Admin** — setup, memberships, classes, staff, resources, workouts, reporting, community, access and configuration.
- **Staff** — operational delivery, classes, attendance, members, PT, rota/resources and assigned work.
- **Member** — training, workouts, PBs, classes, PT, membership, access and community.

Do not split these into unrelated products. The intention is one platform with role-appropriate views.

---

## 2. Repository and backend

- Repository: `PerranporthAFCMens/HybridOS`
- Production branch: `main`
- Frontend: static HTML/CSS/JavaScript
- Backend/Auth/Database: Supabase
- Supabase project ref: `mzgnhmeydhhpzgxlgudh`
- Supabase region: London / `eu-west-2`

HybridOne is **separate from Football PA**. Never edit the Football PA repositories while working on HybridOne unless the user explicitly asks.

### Important naming rule

The public brand is now **HybridOne**.

Do **not** automatically rename the following just because they still contain old/internal naming:

- repository name `HybridOS`
- Supabase project
- database objects
- session/localStorage keys
- JS globals
- historic migration names
- technical function names

These can be migrated later if there is a concrete reason. Avoid high-risk cosmetic refactors.

---

## 3. Current source checkpoint

Latest main commit verified while preparing this handover:

- SHA: `ce098e87ea6c90fefe5e795c2e16639ef59682dc`
- Title: **Launch HybridOne branding and marketing homepage (#18)**
- Date: 22 September 2026

That commit includes:

- HybridOne marketing landing page
- HybridOne rebrand across user-facing software
- clean Vercel routes
- branded email template source files
- smoke-test checks preventing legacy user-facing `Hybrid OS` branding from returning

Always fetch the latest `main` before editing because the repository may advance after this handover.

---

## 4. Hosting and domains

### Domain

The user purchased:

- `hybridone.co.uk`

Registrar:

- GoDaddy

### Vercel

A separate Vercel project was created/imported from this GitHub repository.

Observed project/domain state on 22 September 2026:

- `hybridone.co.uk` — Valid Configuration
- `www.hybridone.co.uk` — Valid Configuration / Production
- Vercel project domain visible as `hybrid-one-vert.vercel.app`
- root domain was configured as a 308 redirect to `www.hybridone.co.uk`

The initial browser certificate warning occurred immediately after DNS change. Vercel subsequently showed valid domain configuration. If HTTPS is still wrong, verify certificate provisioning before changing DNS again.

GoDaddy root A record was changed from Parked to the Vercel-provided IP.

### Current Vercel routing

`vercel.json` currently contains:

- `/` -> `/landing.html`
- `/hybrid-hub` -> `/hybrid-hub-login.html`
- `/puffin-performance` -> `/puffin-performance-login.html`
- `/app` -> `/index.html`

This is deliberate.

### Intended public structure

- `hybridone.co.uk` — marketing / sales website
- `hybridone.co.uk/hybrid-hub` — Hybrid Hub login
- `hybridone.co.uk/puffin-performance` — Puffin Performance login
- `hybridone.co.uk/app` — app entry point

A future `app.hybridone.co.uk` subdomain is still an option, but is **not required** for the current design.

### GitHub Pages

The repository still contains the GitHub Pages build/deploy workflow and historically deployed to:

- `https://perranporthafcmens.github.io/HybridOS/`

GitHub Pages should now be treated as legacy/dev fallback rather than the long-term commercial host. Do not make GitHub Pages the primary branded production URL.

---

## 5. Build and CI

GitHub Pages build path remains:

**source -> `scripts/build_site.py` -> `_site` -> `scripts/smoke_test.py` -> Pages**

Workflow:

- `.github/workflows/pages.yml`

Important lessons from recent work:

1. Smoke tests have deliberately blocked bad deployments.
2. A stale smoke-test assertion once blocked the secure invite-link deployment.
3. A stale locked SHA for `shared-admin-nav.js` later blocked Pages after the global sign-out change.
4. Do not weaken smoke tests just to make a build pass.
5. When a deliberate shared-rendering file changes, update its reviewed stability hash only after checking the UI impact.

### Current rebrand guard

The smoke suite now checks HTML pages and fails if user-facing legacy branding such as:

- `Hybrid OS`
- `HYBRID OS`
- `HybridOS`
- `HYBRIDOS`

returns.

Technical identifiers containing `hybrid` are not necessarily legacy branding and should not be renamed blindly.

---

## 6. HybridOne marketing landing page

Primary file:

- `landing.html`

Current purpose:

- sell/explain HybridOne
- position it as the operating system for hybrid gyms
- explain memberships, classes, programming, staff, community and reporting
- provide Book a demo / feature CTAs
- keep the product website separate from a gym login

### Logo

The user does **not** yet have the final HybridOne logo.

The landing page contains a clear temporary logo placeholder:

- current placeholder: `H1`
- source comment includes `LOGO PLACEHOLDER`

When the final logo is ready, replace the placeholder without redesigning the landing page unnecessarily.

### Brand line

Preferred positioning:

> **HybridOne**  
> The operating system for hybrid gyms.

The user strongly liked the original “OS” idea because it explains what the product is. The HybridOne name allows that language to remain the core proposition.

---

## 7. Multi-gym login architecture — critical

This was the major issue immediately before the rebrand.

### Required product rule

**The login route decides the gym. The email address does not.**

One auth account may legitimately own/manage more than one gym.

Do not assume:

- one email = one gym
- first membership = current gym
- `.limit(1)` on `gym_members` is safe

That assumption caused an Admin invite intended for Hybrid Hub to be created against Puffin Performance.

### Gym IDs

Hybrid Hub:

- Gym ID: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`

Puffin Performance:

- Gym ID: `aec16956-3793-4543-873b-4412646ca1eb`

### Dedicated login pages

- `hybrid-hub-login.html`
- `puffin-performance-login.html`

Clean production routes:

- `/hybrid-hub`
- `/puffin-performance`

Each login page:

1. knows its fixed gym ID
2. writes that gym ID into `sessionStorage`
3. signs into the same Supabase Auth system
4. redirects into the app with the selected gym context

Current session key:

- `hybrid-gym-id`

This technical key intentionally retains `hybrid` naming.

### Main app

`index.html` now:

- reads `gym_id` from the URL when supplied
- stores it in `sessionStorage`
- loads all active memberships for the signed-in user
- chooses the membership matching the explicit gym context
- no longer silently takes the first gym membership
- blocks ambiguous multi-gym access if no gym context is present

### Admin pages

Recent work removed the dangerous “first active gym” selection pattern from the main admin pages and moved them to the login/session gym context.

Do not reintroduce `.limit(1)` as a tenant-selection mechanism.

### Sign out

Sign out must clear:

- Supabase auth session
- `sessionStorage['hybrid-gym-id']`

A dedicated `sign-out.html` route exists and the global admin navigation contains a Sign out option.

---

## 8. Owner/Admin access model

HybridOne has a real Owner/Admin governance model rather than shared passwords.

### Roles

- Owner
- Admin

Each person should use their own Supabase Auth account.

### Core membership fields

`gym_members` includes access governance such as:

- `access_status`
  - pending
  - active
  - revoked
- `approved_by`
- `approved_at`
- `access_revoked_at`

### Security helpers

Relevant private helpers added during the access work include:

- `private.has_gym_role`
- `private.can_write_gym`
- `private.is_pending_admin`
- `private.has_active_owner`
- `private.active_owner_count`

Pending Owners/Admins must remain read-only until the relevant approval rules are satisfied.

### Owner identity

`gyms.created_by` is protected/immutable for audit purposes.

It is **not** intended to function as a secret “super owner” privilege inside the product.

---

## 9. Equal Owner governance

The design goal is equal Owners rather than a hidden primary Owner.

Relevant tables:

- `gym_ownership_actions`
- `gym_ownership_action_approvals`
- `gym_access_invite_approvals`

Relevant RPCs include:

- `propose_owner_promotion`
- `approve_ownership_action`
- `propose_owner_removal`
- `propose_gym_deletion`

Governance rule:

- with one active Owner, that Owner can approve a new Owner
- once a gym has two or more active Owners, Owner-level changes require approval from all currently active Owners

Current implementation also means removal of an active Owner requires unanimous approval, including the Owner being removed. Do not silently weaken this rule without discussing the product behaviour first.

---

## 10. Invite architecture

There are now two invite delivery paths:

### A. Email-first invite

RPC:

- `create_email_access_invite`

Owner approval RPC:

- `approve_email_owner_invite`

Edge Function:

- `send-access-invite`

The email-first design is:

**Admin invite**
1. active Owner creates invite
2. creating/sending the invite is the Owner approval
3. recipient signs in/creates account
4. recipient accepts
5. Admin access activates

**Owner invite**
1. Owner invite is proposed
2. required existing Owner approvals happen first
3. only after approvals are complete should the invitation be sent
4. recipient signs in/creates account and accepts
5. approved Owner access activates

There should not be an unnecessary second Owner approval after the invited person has already accepted.

### B. Secure shareable link

RPCs:

- `create_shareable_access_invite`
- `approve_shareable_owner_invite`

This path exists specifically so a trusted person can be sent a secure invite link by WhatsApp/iMessage/text without depending on SMTP.

UI:

- `admin-access.html`
- button: **Generate secure invite link**

The link is:

- email-specific
- expiring
- revocable
- gym-specific

### Invite acceptance

Relevant RPCs/pages:

- `get_access_invite`
- `claim_access_invite`
- `admin-invite.html`

The invite flow detects if the browser is already authenticated as the wrong account and offers a sign-out/continue path.

### Important historical bug

A secure Admin link generated during testing was tied to **Puffin Performance** when the user intended **Hybrid Hub**.

Root cause:

- the Admin Access page selected the first active gym membership rather than an explicit gym context

Do not treat that as an email problem. It was a tenant-context bug.

The login-route/gym-context architecture above is the fix.

---

## 11. Current invite/account cleanup state

At the time this handover was prepared, the database still contained test/legacy invite state.

Important facts:

- there is an open Hybrid Hub Admin secure-link invite intended for a real/test recipient
- there is an old open Puffin Performance Admin test invite created during the wrong-gym bug
- there is a claimed but still pending Hybrid Hub Owner invite from the earlier/manual flow
- the old demo Hybrid Hub Owner membership is revoked/inactive

Do **not** delete or modify these blindly.

If cleanup is needed:

1. query `gym_admin_invites`
2. query `gym_members`
3. identify which records the user still wants
4. revoke/delete only the intended test records

Do not store raw invite tokens in the repository.

---

## 12. Current Owner state

The database was checked during this handover.

Current conceptual state:

- one active Owner account has active Owner access to **both Hybrid Hub and Puffin Performance**
- a second Hybrid Hub Owner account remains **pending**
- the old Hybrid Hub demo Owner membership is **revoked/inactive**

This is why multi-gym ownership must be supported properly.

Do not “fix” this by forcing one account per gym. The user explicitly clarified that the same Owner emails/accounts may own more than one gym.

---

## 13. Email / Resend / SMTP status

This is the next major robustness workstream.

### Current state

The application invite logic exists.

Branded email HTML source exists in the repo:

- `supabase-email-invite-template.html`
- `supabase-email-magic-link-template.html`

These were rebranded to HybridOne.

However:

- production-quality custom SMTP is **not fully configured yet**
- branded templates in the repository do not automatically mean Supabase is sending them
- the user intends to work with **Resend**

### Recommended architecture

- Supabase Auth — authentication, sessions, password/magic-link/invite logic
- Resend — reliable transactional email delivery
- Vercel — HybridOne frontend
- `hybridone.co.uk` — branded public domain

Initial recommendation:

- use Resend as custom SMTP for Supabase Auth
- verify a sending domain/subdomain
- use a sender such as `no-reply@hybridone.co.uk` or similar
- then configure Supabase Auth email templates and redirect URLs

A more advanced future option is a Supabase Send Email Auth Hook calling Resend directly, but custom SMTP is simpler for the current stage.

### Critical auth-domain work still required

When moving production auth fully to HybridOne/Vercel, review Supabase Auth settings:

- Site URL
- allowed Redirect URLs
- password reset URL
- signup confirmation URL
- magic link redirect URL
- invite redirect URLs

These should point to the HybridOne production domain rather than relying on the old GitHub Pages URL.

Do not change these casually without testing signup/login/reset/invite end-to-end.

---

## 14. Login robustness work still required

The user explicitly wants login/authentication to become robust.

Next auth test matrix should cover:

1. Hybrid Hub login using an account that owns both gyms
2. Puffin Performance login using the same account
3. direct visit to `/app` with a valid gym context
4. direct visit to `/app` without gym context
5. sign out and switch gym
6. Admin invite secure link in a fresh/incognito browser
7. wrong account already signed in when opening an invite
8. new account creation from an invite
9. existing account accepting an invite
10. password reset
11. email confirmation
12. Owner invite with one active Owner
13. Owner invite with multiple active Owners
14. Admin invite acceptance activates immediately
15. expired/revoked invite behaviour
16. refresh/back navigation on mobile

Do not claim auth is production-ready until those are exercised.

---

## 15. Admin Access UI

Primary file:

- `admin-access.html`

Current behaviour includes:

- signed-in account/gym context visibility
- explicit target gym
- Admin / Owner invite role
- invite expiry
- Send invitation email
- Generate secure invite link
- pending/previous invite list
- Owner approval workflow
- Admin removal
- Owner promotion/removal governance
- Sign out

Admin Access should never silently select a gym.

---

## 16. Owner/Admin application

Important files:

- `index.html`
- `admin.html`
- `admin-frame.js`
- `admin-frame.css`
- `shared-admin-nav.js`
- `admin-embed.js`

Main areas include:

- Dashboard
- Community
- Classes
- Workouts
- Services & resources
- Staff management
- Members
- Member view
- Staff view
- Reporting

### Mobile shell history

There were repeated mobile grey-band/layout issues when embedded iframe shell navigation was used.

The successful direction was:

- top-level mobile navigation
- no mobile iframe shell

Do not reintroduce the old mobile embedded-shell architecture without a very specific reason.

---

## 17. Staff experience

Primary files:

- `staff.html`
- `staff-shell.js`
- `staff-operations.js`
- `staff-operations.css`
- `staff-permissions.html`

Current concepts/capabilities include:

- staff roles and permissions
- assigned classes
- attendance / no-show
- working hours / rota
- permission-aware member lookup
- assigned resources
- gym access
- PT appointments
- staff preview for Owner/Admin

Staff View was previously surfaced in Owner/Admin navigation.

If it appears missing, inspect routing/rendering/cache before rebuilding it.

---

## 18. Member experience

Primary files include:

- `member.html`
- `member-preview.html`
- `member-experience.js`
- `member-experience.css`
- `member-coach.js`
- `member-coach.css`
- workout-related member runtime files

Member areas include:

- training-first Home
- class schedule and booking
- workouts
- PBs
- PT
- membership
- profile/account
- integrations
- Social/community
- door/access information

Training and member progress should remain prominent. Do not turn the member home into only a class-sales screen.

---

## 19. Workouts V2

A workout is a **multi-activity session**, not one exercise.

Supported direction includes:

- Legs Day
- Back & Chest
- Arms
- Cardio
- multi-block sessions
- multiple exercises/activities
- PT assignment to a member
- optional gym WOD
- member completion/progress

Primary admin builder:

- `workout-builder.html`

Preserve this model.

---

## 20. Classes and scheduling

Important files:

- `classes.html`
- `class-setup.html`
- `calendar-mobile.js`
- `calendar-views.js`
- `scheduling-engine.js`
- `session-manager.js`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Scheduling logic covers:

- staff capability
- staff working hours
- staff clashes
- resource availability
- resource clashes
- capacity

Do not invent a separate scheduling/conflict engine if existing RPC/business logic already handles it.

Class setup supports per-class drop-in pricing.

---

## 21. Memberships / payments

Membership functionality is present.

Current product work has included:

- membership plans
- membership assignment
- gym-only vs class-inclusive access
- per-class drop-in pricing
- member upgrade/drop-in prompts
- manual payment mode
- GoCardless groundwork

The first real-world trial should not depend on HybridOne collecting live membership payments until the payment/provider flow has been fully tested.

GoCardless/payment-provider work has previously been parked unless explicitly reopened.

---

## 22. Social/community

Primary files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`
- `social-notifications.js`
- `community.html`

Current capabilities include:

- posts
- comments
- replies
- reactions
- ownership-aware edit/delete
- admin participation
- member-home Social summaries
- unread/social notification work

Keep ownership enforcement in the database/UI.

---

## 23. Member View editor

Primary page:

- `member-view-settings.html`

Supports:

- show/hide
- reorder
- phone preview
- save/reset
- Member Preview

Persistence:

- `gym_member_view_settings`
- owner/admin direct access only
- members consume safe layout data through RPC

Do not weaken RLS to make member rendering easier.

---

## 24. Gym Layout

Primary file:

- `gym-layout.html`

The editor has concepts for:

- outline/rooms/walls/doors
- zones
- equipment
- quantities
- floorplan upload
- snapping
- mobile interaction
- guided wizard
- same-screen equipment picker

User feedback was that the editor remained too cramped/small.

**Gym Layout is parked.**

Do not make it the next priority unless the user explicitly reopens it.

---

## 25. Security baseline

Always preserve:

- no service-role/secret keys in frontend/repo
- publishable Supabase credentials only in browser code
- RLS on exposed data
- gym/tenant scoping
- server-side permission enforcement where meaningful
- Owner/Admin configuration protected in both UI and database
- pending access remains read-only
- ordinary members cannot see sensitive staff/admin data
- social edit/delete respects ownership
- security-definer RPCs reviewed carefully
- prefer narrow RPCs/views to weakening table permissions

---

## 26. Current branding migration status

User-facing rebrand to **HybridOne** has been merged.

Commit:

- `ce098e87ea6c90fefe5e795c2e16639ef59682dc`

The rebrand included:

- HTML page titles/content
- admin/member/staff views
- login pages
- sign-out
- invite page
- integrations/group join
- email template source files
- shared shell/account copy
- landing page
- build/smoke checks

### Intentional exceptions

Do not treat these as errors purely because they still contain `HybridOS` / `hybrid`:

- repo name
- internal JS globals
- storage keys
- session keys
- database/migration identifiers
- historic comments/technical names where not user-facing

---

## 27. Immediate next priorities

### Priority 1 — verify branded Vercel production

Check:

- `https://hybridone.co.uk`
- `https://www.hybridone.co.uk`
- `/hybrid-hub`
- `/puffin-performance`
- `/app`

Confirm:

- HTTPS certificate is valid
- root/www redirect is intentional
- landing page is visible
- clean login routes work
- latest `main` is deployed

### Priority 2 — end-to-end login robustness

Test the matrix in section 14.

Fix only evidence-backed failures.

### Priority 3 — Resend/Supabase email

Set up reliable branded transactional auth emails.

### Priority 4 — logo

Replace the landing-page `H1` placeholder when the user provides the new HybridOne logo.

### Priority 5 — first external trial readiness

Before giving a gym real access, verify:

- login
- tenant isolation
- Owner/Admin invites
- memberships
- class booking/drop-in logic
- staff permissions
- workouts
- member portal
- reporting basics
- email/reset flows

---

## 28. Current known cleanup items

Do not confuse cleanup with urgent product work.

Known items:

- old wrong-gym Puffin Performance test invite still existed when handover was prepared
- one older Hybrid Hub Owner invite remained claimed/pending
- old demo Hybrid Hub Owner membership remains revoked/inactive
- custom SMTP/Resend not fully configured
- Supabase Auth production redirect settings need review for the new domain
- final HybridOne logo not yet supplied
- root vs www canonical choice can be revisited later
- `app.hybridone.co.uk` is optional and not yet necessary

---

## 29. Working style / change discipline

The user strongly prefers small, direct, evidence-backed changes.

Avoid:

- broad speculative rewrites
- repeatedly “fixing” something without checking the actual current code
- changing multiple architectural layers when one bug is isolated
- reintroducing abandoned mobile iframe-shell behaviour
- assuming first gym membership = current tenant
- saying something is deployed/live without verifying when verification is possible

Always:

1. fetch latest `main`
2. fetch current file SHA before writes
3. make focused changes
4. update smoke coverage for important regressions
5. merge via PR
6. verify production when possible
7. tell the user exactly what changed

---

## 30. Safe starting point for the next chat

The next development chat should begin by:

1. reading this file
2. checking latest `main`
3. checking current Vercel deployment/domain status
4. opening the HybridOne landing page
5. testing `/hybrid-hub` and `/puffin-performance`
6. continuing with login robustness / Resend rather than redesigning completed product areas

The immediate focus is **making HybridOne authentication, invites and branded production hosting robust enough for a real trial**.
