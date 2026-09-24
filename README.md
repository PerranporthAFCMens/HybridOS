# HybridOne

**HybridOne is the operating system for hybrid gyms.**

HybridOne is a multi-tenant gym-management SaaS covering memberships, members, classes, programming, staff, community, reporting, communications and member/staff experiences.

> **Before changing HybridOne, read the project control layer in this order:**
>
> 1. [PROJECT_STATE.json](./PROJECT_STATE.json)
> 2. [PROJECT_CONTROL.md](./PROJECT_CONTROL.md)
> 3. [ENVIRONMENT.md](./ENVIRONMENT.md)
> 4. [STATUS.md](./STATUS.md)
> 5. [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md) for Auth/routing/invite work
>
> [HANDOVER.md](./HANDOVER.md) is architectural/background context. Live operational state comes from the control layer above.
>
> Deployment details also live in **[VERCEL.md](./VERCEL.md)**.

## Product status

**Hybrid Hub** is the primary pilot/demo tenant. It is **not yet a live operating customer gym**, so reviewed work can still be promoted more freely than it could after customer launch.

HybridOne is completely separate from Football PA.

Production:

- https://www.hybridone.co.uk
- https://www.hybridone.co.uk/hybrid-hub
- https://www.hybridone.co.uk/puffin-performance

Repository:

- `PerranporthAFCMens/HybridOS`

Stack:

- static HTML/CSS/JavaScript frontend
- Vercel production
- GitHub Pages dev preview
- Supabase database/Auth/backend
- Resend email transport
- Supabase project: `mzgnhmeydhhpzgxlgudh`

## 24 September 2026 checkpoint

Functional code heads immediately before this documentation-only refresh:

- **main:** `784bac0c253479265728381f34fab816baf4507c` — **Fix Staff and Resources mobile layout**
- **dev:** `e82bf5106093624709bed85deb40540f071340f6` — **Fix Staff and Resources mobile layout**

Verification:

- main smoke checks: **success**
- main Vercel deployment: **success**
- dev smoke checks: **success**
- latest hourly production workflow: **success but intentionally skipped promotion because main/dev diverge**

The branches are **not safe to blindly fast-forward or overwrite**.

Current merge base:

- `97c3c3390f7c1fb510315ecbc33ec379956e3654`

Current relationship before docs refresh:

- dev is ahead of main by 13 commits
- dev is behind main by 4 commits

Main contains production mobile fixes. Dev contains additional tenant/Auth-email hardening.

## Critical deployment rule

Both production and dev preview must serve the **built site**, not raw source files:

```
source
-> python3 scripts/build_site.py
-> _site
```

Vercel must keep:

```json
"buildCommand": "python3 scripts/build_site.py",
"outputDirectory": "_site"
```

This fixed the historic production/dev visual mismatch.

**Never debug production appearance by comparing raw source alone. Compare the generated `_site` output.**

## Tenant rule

> **The login route decides the gym. The email address does not.**

Gym context is stored in:

```
sessionStorage['hybrid-gym-id']
```

Known tenants:

- Hybrid Hub: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `aec16956-3793-4543-873b-4412646ca1eb`

Do not reintroduce first-active-gym selection, `.limit(1)` tenant inference, email-to-gym inference or a generic gym picker as the main flow.

## Branding

Public spelling is always **HybridOne**.

Brand hierarchy:

- member/customer: gym first, HybridOne discreet
- staff/admin: gym first, **Powered by HybridOne** visible
- platform marketing: HybridOne first

## Staff Access Levels

Staff/Coach permissions use **Owner-controlled Access Levels**.

Rules:

- Owner creates/names/configures/saves levels
- every active Staff/Coach must have exactly one level
- only Owners redefine level definitions
- eligible Admin/staff may assign existing levels
- changing a level propagates permissions to assigned users

Hybrid Hub examples:

- Coach / PT
- Reception
- Manager
- Manager 2

A granular enforcement sweep is still required across every page/action/server operation.

## Communications

`communications.html` is the standalone Communications workspace.

It supports gym-owned:

- email brand name
- From email preference
- optional Reply-to
- brand colour
- logo
- footer
- transactional template copy

Default managed sender:

```
noreply@hybridone.co.uk
```

Custom From domains require verification.

The Marketing tab is currently foundation/roadmap only.

## Auth email state

Product rule:

> **The gym owns the customer relationship. HybridOne is the engine underneath.**

Gym-specific login context should drive password reset, magic-link, confirmation, invite and onboarding branding.

Dev contains tenant-aware Auth groundwork including:

- gym-bound password reset
- gym-bound magic links
- `auth-return.html`
- `supabase/functions/send-auth-email/index.ts`
- `scripts/email_hook_smoke.py`

But **`send-auth-email` is not deployed or active in Supabase yet**.

Live Auth email still uses the existing project-wide Supabase/Resend SMTP route.

Current relevant live Edge Functions include:

- `send-access-invite` v8 ACTIVE
- `admin-create-staff-with-level` v1 ACTIVE

Do not enable the Supabase Send Email Hook until secrets are provisioned and the full Auth test matrix is ready.

## Egress protection

Historic excessive Supabase egress was caused by a request storm, not normal product usage.

Protection includes:

- `supabase-request-guard.js`
- browser circuit breaker
- reduced social polling
- exact gym-context lookup
- smoke protection

Longer-term scale hardening still needs shared client/context, request deduplication/cache and observability.

## Development flow

Normal development is on `dev`.

Dev preview:

```
dev push
-> HybridOne smoke checks
-> build_site.py
-> smoke_test.py _site
-> GitHub Pages
```

Vercel Git deployment for `dev` is disabled.

Production is sourced from `main`.

The hourly production workflow only fast-forwards main when main is an ancestor of dev. **Because the branches currently diverge, the workflow safely skips promotion.** A green hourly workflow does not necessarily mean dev was promoted.

## Before changing anything

1. Read `HANDOVER.md`.
2. Fetch current `main` and `dev`.
3. Compare them before merging or promoting.
4. Keep Vercel building `_site`.
5. Run built-site smoke tests.
6. Verify actual browser behaviour before saying something is fixed.
7. Inspect live Supabase Edge Functions before claiming an email/Auth function is active.

For the full continuation brief, see **[HANDOVER.md](./HANDOVER.md)**.
