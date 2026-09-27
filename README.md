# HybridOne

**HybridOne is the operating system for hybrid gyms.**

HybridOne is a multi-tenant gym-management SaaS covering memberships, members, classes, programming, staff, community, reporting, communications and member/staff/Admin experiences.

## Read before changing the product

1. [PROJECT_STATE.json](./PROJECT_STATE.json)
2. [PROJECT_CONTROL.md](./PROJECT_CONTROL.md)
3. [ENVIRONMENT.md](./ENVIRONMENT.md)
4. [STATUS.md](./STATUS.md)
5. [AUTH_CONTEXT.md](./AUTH_CONTEXT.md)
6. [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md)
7. [UI_CONSISTENCY.md](./UI_CONSISTENCY.md)
8. [HANDOVER.md](./HANDOVER.md)
9. [VERCEL.md](./VERCEL.md)

## Current checkpoint

Production `main`:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Current verified `dev`:

`fdc5cffd32e7555c79e891e22ffb6196a15c4288`

Latest green checks:

- smoke `36309330446`
- public dev runtime `36309330458`

Branches are diverged. Do not blindly merge them.

Production hold remains active.

## Login and gym context

Current dev model:

> **Authenticate the person first. Then select an active gym context.**

Flow:

`email/password -> active gym memberships -> one gym direct / multiple gyms chooser -> role-specific experience`

Multi-gym users can **Switch gym** after login.

Bare `index.html` now hands off to the universal login unless it is intentionally being used for embedded Admin, explicit gym context or an access invite.

See [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

## Development routes

Universal login:

`https://perranporthafcmens.github.io/HybridOS/login.html`

Choose a gym:

`https://perranporthafcmens.github.io/HybridOS/choose-gym.html`

Do not provide remembered URLs without checking [ENVIRONMENT.md](./ENVIRONMENT.md).

## Stack

- HTML/CSS/JavaScript
- `scripts/build_site.py -> _site`
- GitHub Pages dev
- Vercel production
- Supabase
- Resend

Supabase project:

`mzgnhmeydhhpzgxlgudh`

## UI

HybridOne has a shared visual contract enforced by `app-consistency.css` and `scripts/ui_consistency_check.py`.

The authenticated whole-app audit passed 21 product surfaces at desktop and mobile widths.

See [UI_CONSISTENCY.md](./UI_CONSISTENCY.md).

## Release gate

Before production promotion:

- finish remaining browser Auth journeys
- enable + verify member email confirmation
- reconcile dev/main intentionally
- verify exact production deployment
- browser-test production
- only then clear the hold
