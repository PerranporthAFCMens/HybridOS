# HybridOne

**HybridOne is the operating system for hybrid gyms.**

It brings memberships, classes, programming, staff, community, reporting and member experience into one multi-tenant platform.

> **Start every new development session with [HANDOVER.md](./HANDOVER.md).** It is the authoritative continuation brief.

## Current product status

The public brand is now **HybridOne**.

Latest verified source checkpoint when this README was refreshed:

- Commit: `ce098e87ea6c90fefe5e795c2e16639ef59682dc`
- Change: **Launch HybridOne branding and marketing homepage (#18)**
- Date: 22 September 2026

That change includes the HybridOne marketing landing page, product-wide user-facing rebrand, clean Vercel routes and branded auth email template source.

Always check the latest `main` before assuming this is still the newest state.

## Production direction

Primary domain:

- `hybridone.co.uk`

Current intended routes:

- `/` — HybridOne marketing/sales landing page
- `/hybrid-hub` — Hybrid Hub login
- `/puffin-performance` — Puffin Performance login
- `/app` — HybridOne app entry

Vercel is now the intended commercial frontend host.

GitHub Pages is the immediate development preview from `dev`. Vercel production follows `main` on the hourly release cadence.

## Stack

- Repository: `PerranporthAFCMens/HybridOS`
- Production branch: `main`
- Development branch: `dev`
- Frontend: static HTML/CSS/JavaScript
- Hosting: Vercel for branded production
- Legacy/dev hosting: GitHub Pages
- Backend/Auth/Database: Supabase
- Supabase project ref: `mzgnhmeydhhpzgxlgudh`
- Region: London / `eu-west-2`

HybridOne is separate from Football PA. Do not edit Football PA from this repository unless explicitly asked.

## Multi-tenant login rule

This is important:

> **The login route decides the gym. The email address does not.**

A single HybridOne account can legitimately belong to more than one gym.

Current gym context is stored in:

- `sessionStorage['hybrid-gym-id']`

Dedicated login pages set the correct gym context before entering the app.

Do not reintroduce “first active gym membership” logic as tenant selection.

## Current role experiences

### Owner/Admin

Includes:

- Dashboard
- memberships
- members
- classes
- class setup
- workouts/WOD
- staff management
- resources
- community
- member view configuration
- Staff View
- reporting
- door/access settings
- Owner/Admin access governance

### Staff

Includes:

- assigned classes
- attendance
- working hours / rota
- member lookup
- assigned resources
- gym access
- PT appointments
- permission-aware access

### Member

Includes:

- training-first Home
- classes/bookings
- workouts
- PBs
- PT
- membership
- profile/account
- integrations
- Social/community
- access

## Owner/Admin access

HybridOne supports individual Owner/Admin accounts rather than shared passwords.

Implemented concepts include:

- pending / active / revoked access
- Admin invites
- equal Owner governance
- Owner approval workflows
- secure shareable invite links
- email-first invites
- invite revocation/deletion
- wrong-account invite detection
- read-only pending access

Important RPCs include:

- `create_email_access_invite`
- `approve_email_owner_invite`
- `create_shareable_access_invite`
- `approve_shareable_owner_invite`
- `get_access_invite`
- `claim_access_invite`

## Email/auth status

Branded HybridOne email template source exists in:

- `supabase-email-invite-template.html`
- `supabase-email-magic-link-template.html`

Reliable production transactional email is the next major auth task.

Current direction:

- Supabase Auth for authentication/session logic
- Resend for production email delivery
- HybridOne/Vercel URLs for confirmation, reset and invite redirects

Do not assume repository email templates are already active in Supabase production.

## Marketing site

Primary file:

- `landing.html`

The page is designed to sell/explain HybridOne and currently contains an **H1 logo placeholder**.

Replace the logo placeholder only when the final HybridOne logo is supplied.

## Vercel routes

Defined in:

- `vercel.json`

Current rewrites:

- `/` -> `/landing.html`
- `/hybrid-hub` -> `/hybrid-hub-login.html`
- `/puffin-performance` -> `/puffin-performance-login.html`
- `/app` -> `/index.html`

## Development and release flow

Normal development goes to `dev`, not directly to `main`.

- Every `dev` push runs the build/smoke checks and publishes GitHub Pages for immediate review.
- Vercel Git deployment is disabled for the `dev` branch.
- `.github/workflows/hourly-production.yml` fast-forwards `main` to the latest `dev` once per hour at minute 37, when there is anything new.
- Vercel production therefore receives at most one normal HybridOne release per hour.
- `workflow_dispatch` remains available for an intentional manual production release.

GitHub Pages preview pipeline:



**source -> `scripts/build_site.py` -> `_site` -> `scripts/smoke_test.py` -> GitHub Pages**

Workflow:

- `.github/workflows/pages.yml`

The smoke suite protects:

- JavaScript syntax
- critical workflow markers
- shared-rendering baselines
- login gym context
- invite flows
- HybridOne user-facing branding

Do not weaken CI to force a deployment through.

## Product principles

- mobile-first
- one multi-tenant platform
- explicit gym context
- individual accounts, not shared logins
- strong tenant/RLS boundaries
- training-first member experience
- one workout = multi-activity session
- use existing scheduling/conflict logic
- focused changes over broad rewrites

## Security baseline

- never commit Supabase secret/service-role keys
- frontend uses publishable credentials only
- RLS on exposed tables
- gym-scoped tenant data
- pending users remain restricted
- Owner/Admin configuration protected in UI and database
- members must not see sensitive staff/admin data
- social ownership enforced
- prefer narrow RPCs/views over weakening table permissions

## Immediate next work

1. Verify the latest HybridOne build is live on Vercel.
2. Test `/hybrid-hub`, `/puffin-performance` and `/app`.
3. Run the full multi-gym login/auth test matrix.
4. Configure Resend / Supabase production email.
5. Update Supabase Auth production redirect URLs for `hybridone.co.uk`.
6. Replace the landing-page logo placeholder when the final logo is ready.
7. Prepare for a controlled first external gym trial.

See [HANDOVER.md](./HANDOVER.md) for the full architecture, current database/access state, known cleanup items and continuation instructions.
