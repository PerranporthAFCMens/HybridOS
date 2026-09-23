# HybridOne

**HybridOne is the operating system for hybrid gyms.**

HybridOne is a multi-tenant gym-management platform covering memberships, members, classes, programming, staff, community, reporting, communications and the member/staff experience.

> **Read [HANDOVER.md](./HANDOVER.md) before starting development.** It is the authoritative continuation brief.

## Current state

Hybrid Hub is the main pilot/demo tenant and is not yet a live operating customer gym.

Production:

- `https://www.hybridone.co.uk`
- `https://www.hybridone.co.uk/hybrid-hub`
- `https://www.hybridone.co.uk/puffin-performance`

Repository:

- `PerranporthAFCMens/HybridOS`

Stack:

- frontend: static HTML/CSS/JavaScript
- production: Vercel
- dev preview: GitHub Pages
- backend/Auth/database: Supabase
- email transport: Resend + Supabase Auth SMTP
- Supabase project: `mzgnhmeydhhpzgxlgudh`

HybridOne is completely separate from Football PA.

## Branch status

Functional heads immediately before the 23 September 2026 documentation refresh:

- `main`: `d6acf67eee9099227fe059a73939f5fee02e5da1` - production iPhone mobile-nav fix
- `dev`: `e20d5985a39c37403a82e89bdfab98f787de443b` - tenant/Auth hardening

The branches currently diverge. Dev contains Auth-email groundwork that is not yet live; main contains a production mobile-nav fix that must be preserved.

Do not blindly replace one branch with the other.

## Deployment architecture

Both environments must use the built site:

```
scripts/build_site.py
-> _site
```

Vercel production must keep:

```json
"buildCommand": "python3 scripts/build_site.py",
"outputDirectory": "_site"
```

This fixed the previous production/dev visual mismatch.

## Tenant rule

> **The login route decides the gym. The email address does not.**

The same Auth account may belong to multiple gyms.

Gym context is stored in:

```
sessionStorage['hybrid-gym-id']
```

Dedicated gym login routes set the tenant context.

Never reintroduce first-active-gym selection or `.limit(1)` tenant selection.

## Branding

Public spelling is always **HybridOne**.

Brand hierarchy:

- member/customer: gym first, HybridOne discreet
- staff/admin: gym first, **Powered by HybridOne** visible
- platform marketing: HybridOne first

## Staff Access Levels

Staff/Coach permissions use Owner-controlled Access Levels.

Owners can create, name, configure and save reusable levels, then assign staff to them.

Rules:

- every active Staff/Coach must have one level
- only Owners redefine level definitions
- eligible admins/staff may assign existing levels
- changing a level propagates its permissions to assigned users

Current Hybrid Hub example levels:

- Coach / PT
- Reception
- Manager
- Manager 2

A granular permission-enforcement sweep across every admin action is still required.

## Communications

`communications.html` is the standalone Communications area.

Transactional settings include:

- email brand name
- From email preference
- optional Reply-to
- logo
- colour
- footer
- subject/preheader/heading/body/button copy

Default managed sender:

```
noreply@hybridone.co.uk
```

Custom From domains require verification.

The Marketing tab is currently a foundation/roadmap only.

## Auth email status

The product rule is that Auth journeys are gym-driven when they start from a gym login.

Dev contains:

- gym-bound password reset
- gym-bound magic links
- `auth-return.html`
- tenant-aware `send-auth-email` Edge Function source
- Auth email hook smoke tests

But **`send-auth-email` is not deployed/active in Supabase yet**.

Live Auth email still uses the existing project-wide SMTP path.

Do not enable the Send Email Hook until the required Resend API key and webhook signing secret are provisioned and the full Auth test matrix is ready.

## Owner/Admin invites

Current live invite function:

- `send-access-invite`
- ACTIVE
- version 8

Use production Hybrid Hub when inviting trusted reviewers who should see the real app rather than the dev preview.

## Egress protection

A historic request storm caused excessive Supabase egress. Protection now includes:

- `supabase-request-guard.js`
- browser-side request circuit breaker
- reduced social polling
- exact gym-context lookup
- smoke protection

Longer-term scaling still needs shared data/context, request deduplication and observability.

## Development flow

Normal work happens on `dev`.

Dev preview:

```
dev push
-> smoke
-> build_site.py
-> smoke_test.py _site
-> GitHub Pages
```

Production follows `main`; the hourly production release workflow is active.

Before promoting dev:

1. reconcile main's mobile fix
2. run smoke tests
3. test Auth flows in real browsers/incognito
4. verify Vercel
5. verify the actual production UI

## Immediate priorities

1. reconcile current `main` and `dev` without losing either side's fixes
2. finish and safely activate gym-owned Auth email delivery
3. run the multi-gym Auth test matrix
4. finish granular Access Level enforcement
5. add shared data/request deduplication and observability
6. harden for first external trials

For full details, read **[HANDOVER.md](./HANDOVER.md)**.
