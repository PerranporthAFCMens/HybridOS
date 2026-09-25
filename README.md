# HybridOne

**HybridOne is the operating system for hybrid gyms.**

HybridOne is a multi-tenant gym-management SaaS covering memberships, members, classes, programming, staff, community, reporting, communications and member/staff experiences.

## Read before changing the product

1. [PROJECT_STATE.json](./PROJECT_STATE.json)
2. [PROJECT_CONTROL.md](./PROJECT_CONTROL.md)
3. [ENVIRONMENT.md](./ENVIRONMENT.md)
4. [STATUS.md](./STATUS.md)
5. [AUTH_CONTEXT.md](./AUTH_CONTEXT.md) for identity/gym context
6. [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md) for Auth/access
7. [UI_CONSISTENCY.md](./UI_CONSISTENCY.md) for user-facing UI
8. [HANDOVER.md](./HANDOVER.md) for architecture/background
9. [VERCEL.md](./VERCEL.md) for deployment

## Current release state

Production is intentionally held on:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Verified dev application checkpoint:

`6a14cfed829f01eace2ad094dd14e1dd08b27120`

The branches diverge. Never blindly fast-forward or overwrite one with the other.

## Login and gym context

The current dev model is person-first:

> **Authenticate the person first. Then select an active gym context.**

Flow:

`email/password -> active gym memberships -> one gym direct / multiple gyms chooser -> role-specific experience`

A multi-gym user can return to **Switch gym** at any time.

The same Auth account may be Owner in one gym, Staff in another and Member elsewhere.

See [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

## Verified dev evidence

- smoke/UI contract: `36199919218` PASS
- exact public runtime: `36199919264` PASS
- protected routing: `36199700825` PASS
- authenticated multi-gym + whole-app audit: `36199919230` PASS

The authenticated audit covered 21 product surfaces at desktop and mobile widths and found no horizontal overflow.

## Stack

- static HTML/CSS/JavaScript
- `scripts/build_site.py -> _site`
- GitHub Pages dev
- Vercel production
- Supabase database/Auth/functions
- Resend email
- Supabase project: `mzgnhmeydhhpzgxlgudh`

## Branding

Always write **HybridOne**.

- member/customer: gym first, HybridOne discreet
- staff/admin: gym first, Powered by HybridOne visible
- platform marketing: HybridOne first

## Staff access

Staff/Coach permissions use Owner-created Access Levels. Every active Staff/Coach must have one.

A granular permission-enforcement sweep remains an important product-security task.

## Email

Gym/customer relationship remains gym-first.

Live:

- `send-auth-email` v5
- `send-access-invite` v11
- managed default sender `noreply@hybridone.co.uk`

Password reset and magic-link journeys for Hybrid Hub and Puffin have passed full browser tests.

## Egress protection

Keep `supabase-request-guard.js` and existing low-egress polling protections. The historical request storm was a regression, not normal product scale.

## Development rule

Work on `dev`, build `_site`, run smoke, verify public Pages, then browser-test the actual journey.

Do not say something is fixed from source alone.
