# HybridOne project control rules

This is the operating protocol for HybridOne work.

## Mandatory read order

Before making a HybridOne change:

1. read `PROJECT_STATE.json`
2. read `PROJECT_CONTROL.md`
3. read `ENVIRONMENT.md`
4. read `STATUS.md`
5. read `AUTH_CONTEXT.md` for login, routing, tenancy, role or multi-gym work
6. read `AUTH_TEST_MATRIX.md` for Auth, invitations, email or permissions
7. read `UI_CONSISTENCY.md` for user-facing UI work
8. use `HANDOVER.md` for architecture/background
9. inspect current code and live service state

Do not rely on chat memory when repository/live state can be checked.

## Mandatory live checks

Fetch:

- current `dev` head
- current `main` head
- main/dev relationship
- latest production Vercel deployment for production-sensitive work
- relevant live Supabase function/version for Auth/email work

For dev Pages, require **HybridOne dev runtime verification** to pass.

## Definition of "fixed"

Never call something fixed because source changed.

Where applicable, require:

1. code committed
2. build completed
3. smoke/CI passed
4. target environment deployed
5. exact deployed revision verified
6. runtime/browser behaviour verified

If runtime is not checked, say **deployed, runtime verification pending**.

## Auth context rule

Read [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

The core rule is:

> **Authenticate the person first. Then select an active gym context.**

Never restore:

- email-to-gym inference
- `.limit(1)` as tenant selection
- last-used gym as permission
- silent cross-gym fallback

A URL `gym_id` is only a hint and must be validated against active membership.

## URL rule

Never give a HybridOne login/dev URL from memory.

Use `ENVIRONMENT.md` and current runtime evidence.

If source and deployed behaviour disagree, deployed behaviour wins for diagnosis.

## Environment rule

Keep these layers distinct:

- source
- built `_site`
- GitHub Pages dev
- Vercel production
- Supabase Auth/database/functions
- Resend delivery

## Production rule

While `PROJECT_STATE.json -> release_gate.production_hold` is true:

- do not broadly promote dev to main
- do not remove the hold because CI is green
- production hotfixes must be narrow and explicitly verified

## Temporary test rule

Any temporary user, RPC, workflow or Edge Function must be:

- tightly scoped
- recorded while active
- removed or made inert after use
- verified cleaned before completion

## State-update rule

After meaningful routing, Auth, email, permission, UI-system or deployment changes update:

- `PROJECT_STATE.json`
- `STATUS.md`
- `ENVIRONMENT.md` when route/deployment contracts change
- `AUTH_CONTEXT.md` when gym-context behaviour changes
- `AUTH_TEST_MATRIX.md` when evidence changes
- `UI_CONSISTENCY.md` when shared UI rules/evidence change

## Security rule

Do not weaken RLS, tenant isolation, service-role boundaries, webhook verification or Owner governance to make a test pass.

Prefer narrow server-side checks/RPCs over broad grants.
