# HybridOne

**HybridOne is the operating system for hybrid gyms.**

It is a multi-tenant gym-management platform covering memberships, classes, programming, staff, community, reporting, member experience and operational administration.

> **Start every new development session with [HANDOVER.md](./HANDOVER.md).** It is the authoritative technical continuation brief.

## Current checkpoint

Last functional checkpoint before this documentation update:

- Commit: `d34e96d6f9c0d5a5807a86cc0632ec091c6e9245`
- Date: 22 September 2026
- Change: production now runs the **same built-site pipeline as the dev preview**
- Production: `https://www.hybridone.co.uk`
- Hybrid Hub login: `https://www.hybridone.co.uk/hybrid-hub`
- Puffin Performance login: `https://www.hybridone.co.uk/puffin-performance`

Hybrid Hub is currently a **pilot/test tenant**, not a live working customer gym. This gives us room to promote reviewed dev work to production while the product is being hardened.

## Critical deployment architecture

This is the most important hosting lesson from 22 September 2026.

The dev preview is **not** the raw repository. GitHub Pages runs:

```
source -> scripts/build_site.py -> _site -> scripts/smoke_test.py -> GitHub Pages
```

The build injects shared admin CSS/runtime, tenant branding and other assets.

Production previously served raw source files directly from Vercel, which made production look different even when `main` and `dev` contained the same source.

That is now fixed. `vercel.json` runs:

```
python3 scripts/build_site.py
```

and serves:

```
_site
```

**Do not remove `buildCommand` or `outputDirectory` from `vercel.json` unless the replacement has been proven against the dev build.**

The build script uses `VERCEL_GIT_COMMIT_SHA` on Vercel and `GITHUB_SHA` on GitHub Actions for cache-busting.

## Repository and stack

- Repository: `PerranporthAFCMens/HybridOS`
- Production branch: `main`
- Development branch: `dev`
- Frontend: static HTML/CSS/JavaScript
- Production hosting: Vercel
- Development preview: GitHub Pages
- Backend/Auth/Database: Supabase
- Supabase project: `mzgnhmeydhhpzgxlgudh`
- Email delivery: Resend + Supabase Auth SMTP
- Monday board: **HybridOne Development**, board `5104590878`

HybridOne is completely separate from Football PA. Never modify Football PA from this project unless explicitly requested.

## Routes

Production routes are defined in `vercel.json`:

- `/` -> marketing landing page
- `/hybrid-hub` -> Hybrid Hub login
- `/puffin-performance` -> Puffin Performance login
- `/app` -> app entry

Owner/Admin gym logins now enter the polished shell at `admin.html`, not the legacy top-level dashboard.

## Multi-tenant rule

> **The login route decides the gym. The email address does not.**

The same Auth account can belong to more than one gym.

Current gym context is stored in:

```
sessionStorage['hybrid-gym-id']
```

Dedicated gym login pages set the fixed gym ID before entering the app.

Never reintroduce "first active gym" selection or `.limit(1)` tenant selection in critical paths.

Known gym IDs:

- Hybrid Hub: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `aec16956-3793-4543-873b-4412646ca1eb`

## Branding rules

Public brand spelling is always **HybridOne**.

A smoke rule prevents the literal user-facing `HYBRIDONE` variant from returning.

Brand hierarchy:

- member/customer experience: **gym brand first**, HybridOne discreetly attributed
- staff/admin experience: **gym brand first**, with **Powered by HybridOne** visible
- platform marketing: HybridOne first

Staff/Admin invitation landing pages resolve the gym from the secure invite token and show the gym brand plus Powered by HybridOne.

## Owner/Admin access

HybridOne uses individual accounts rather than shared admin passwords.

Implemented:

- Owner and Admin roles
- pending / active / revoked access
- email-first Admin invites
- secure shareable invite links
- wrong-account detection
- Owner approval workflows
- equal-Owner governance
- invite revocation/deletion
- retryable email send UI

Primary UI:

- `admin-access.html`
- `admin-invite.html`

Edge Function:

- `send-access-invite` - currently active, version 8 at this checkpoint

## Staff access levels

Staff permissions now use **Owner-controlled Access Levels** instead of fixed presets.

The Owner can:

1. create a level
2. name it anything
3. tick exactly which permissions it contains
4. save it
5. assign Staff/Coach accounts to it
6. edit it later and automatically update everyone assigned to it

Seeded examples:

- Coach / PT
- Reception
- Manager
- Manager 2

Important rules:

- only Owners can create/edit/delete level definitions
- Admins and staff with `manage_staff` can assign existing levels
- active Staff/Coach creation requires an Access Level in the supported provisioning flow
- `staff_access.access_level_id` is NOT NULL
- current active Hybrid Hub Staff/Coach accounts all have a level
- changing a level propagates its permissions to assigned users

Primary UI:

- `staff-permissions.html`
- `admin-operations.html`

Important backend:

- `staff_access_levels`
- `staff_access.access_level_id`
- `assign_staff_access_level`
- `provision_staff_membership_with_level`
- permission propagation trigger
- `admin-create-staff-with-level` Edge Function

A full permission-enforcement sweep across every admin action is still required. Do not assume every historical Owner/Admin check has already been converted to granular level permissions.

## Communications

There is now a standalone **Communications** area rather than an inline Settings section.

Primary page:

- `communications.html`

Current sections:

- **Transactional** - functional editor
- **Marketing** - planned/foundation only

Gym-level storage:

- `gym_communication_settings`
- `gym_email_templates`

The gym can control:

- email brand name
- From email preference
- Reply-to email
- brand colour
- logo
- footer
- subject
- preheader
- heading
- body
- CTA text

Protected variables include:

- `{{gym_name}}`
- `{{invited_by}}`
- `{{role}}`

The default managed sender in the UI is:

```
noreply@hybridone.co.uk
```

Reply-to is optional.

Custom gym-owned From domains must be verified before use.

### Important email limitation

The Communications data model and invite metadata are in place, but **true per-gym From headers for all Supabase Auth emails are not complete yet**.

The current SMTP transport is still project-level. The intended next architecture is:

```
gym login context
-> Supabase Auth creates the secure token
-> Supabase Send Email Hook / HybridOne email service
-> load that gym's branding/template/sender
-> Resend sends the email
-> return to that gym's branded flow
```

Password reset, confirmation, magic-link and invite flows should all be gym-driven when initiated from a gym login page.

Marketing should share gym identity/template infrastructure but use a separate marketing sending stream, consent/unsubscribe handling and analytics.

## Email / Resend status

Completed infrastructure:

- `hybridone.co.uk` verified in Resend
- Supabase custom SMTP connected to Resend
- branded HTML template source exists in:
  - `supabase-email-invite-template.html`
  - `supabase-email-magic-link-template.html`
- invitation Edge Function reads gym communication settings/templates and passes gym-specific metadata

Do not assume repository template files are automatically the currently active Supabase Auth templates. Verify the hosted Auth configuration when testing email rendering.

## Supabase egress protection

A runaway authenticated request incident generated roughly 15 GB of egress on the Free plan.

The strongest evidence was millions of authenticated PostgREST request initialisations versus only thousands of normal successful application queries. It was a request storm/regression, not ordinary product usage.

Protection now includes:

- `supabase-request-guard.js`
- >100 protected REST/Function requests in 10 seconds triggers a 60-second tab circuit breaker
- visible warning banner
- 30-second social polling reduced to 5 minutes
- social gym lookup changed from first-active-gym logic to explicit `hybrid-gym-id`
- smoke checks enforce guard loading on signed-in app pages

The historical `pg_stat_statements` incident evidence should not be reset casually.

Longer-term scale hardening still needs a shared data/context layer with request deduplication and lightweight observability.

## Main product areas

Owner/Admin:

- dashboard
- memberships and member directory
- classes and scheduling
- workout builder
- staff management
- Access Levels
- services/resources
- community/social
- Communications
- reporting
- Member View
- Staff View
- access/door settings
- Owner/Admin governance

Member:

- training-first home
- classes/bookings
- workouts
- PBs
- PT
- membership
- account/profile
- integrations
- social/community
- access

Staff:

- assigned classes
- attendance
- working hours
- member lookup
- assigned resources
- PT appointments
- permission-aware admin capabilities

## Development flow

Normal work continues on `dev`.

- every `dev` push runs smoke checks
- dev preview deploys only after smoke success
- Vercel Git deployment remains disabled for `dev`
- production normally follows `main`
- `.github/workflows/hourly-production.yml` remains the controlled release mechanism
- direct promotion to `main` can be used intentionally while Hybrid Hub remains a non-live pilot, but still verify smoke + Vercel status

Keep `main` and `dev` aligned after an intentional production promotion unless there is a specific reason not to.

## Current priorities

1. finish gym-owned auth email delivery using a Send Email Hook / equivalent Resend path
2. test password reset, confirmation, magic link and invite flows end-to-end per gym
3. enforce Access Level permissions consistently across every admin page/action
4. continue first external-trial hardening
5. add request/data-layer observability and deduplication
6. continue product roadmap work only after auth/permissions foundations remain stable

## Change discipline

Before changing code:

1. fetch latest branch/file
2. inspect the existing implementation
3. make the smallest coherent change
4. add/update smoke coverage for important regressions
5. run the built-site smoke suite
6. verify the actual deployed environment before saying it is fixed

Do not:

- broadly rewrite working areas without inspection
- weaken RLS to make the UI easier
- select a tenant from the first membership
- assume raw source and built-site output are equivalent
- say production is fixed only because a commit or deployment succeeded

For the full continuation brief, read **[HANDOVER.md](./HANDOVER.md)**.
