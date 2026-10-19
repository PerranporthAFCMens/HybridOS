# HybridOne project control rules

This is the operating protocol for HybridOne work.

## Mandatory read order

Before making a HybridOne change, read only what the task needs (keeps sessions cheap; `CLAUDE.md` has the same list):

1. always: `STATUS.md` (short current state; older history is in `docs/status-archive/`, search it, do not read it whole)
2. login, routing, tenancy, role or multi-gym work: `AUTH_CONTEXT.md`
3. Auth, invitations, email or permissions tests: `AUTH_TEST_MATRIX.md`
4. user-facing UI work: `UI_CONSISTENCY.md` (old pages) or `web/UI_RULES.md` and `web/ARCHITECTURE.md` (new app)
5. environment, route or deployment work: `PROJECT_STATE.json` and `ENVIRONMENT.md`
6. architecture or background: `HANDOVER.md`
7. always: inspect the current code and live service state

Do not rely on chat memory when repository/live state can be checked.

## Mandatory live checks

Fetch:

- current `dev` head
- current `main` head
- main/dev relationship
- latest production Vercel deployment for production-sensitive work
- relevant live Supabase function/version for Auth/email work

For dev Pages, require **HybridOne dev runtime verification** to pass.

For universal-login release work, also require the exact-SHA Auth journey browser gate to pass. Do not treat a same-role multi-gym fixture as proof that different roles route correctly; keep role-differentiated coverage explicit in `AUTH_TEST_MATRIX.md`.

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
