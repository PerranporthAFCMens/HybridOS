# HybridOne project control rules

This is the operating protocol for any future HybridOne work.

## Mandatory read order

Before making a HybridOne change:

1. read `PROJECT_STATE.json`
2. read `ENVIRONMENT.md`
3. read `STATUS.md`
4. read `AUTH_TEST_MATRIX.md` when the work touches Auth, routing, invitations, email or permissions
5. use `HANDOVER.md` for architecture/background only
6. inspect the current code and live service state relevant to the task

Do not rely on chat memory when repository/live state can be checked.

## Mandatory live checks before changing code

Fetch:

- current `dev` head
- current `main` head
- main/dev relationship before any merge/promotion
- latest production Vercel deployment for production-sensitive work
- relevant live Supabase Edge Function version for Auth/email work

For GitHub Pages, require `HybridOne dev runtime verification` to pass. It waits for `deployment.json` to match the exact dev SHA and checks the public tenant-login routes. Workflow metadata alone is not proof.

## Definition of "fixed"

Never tell the user something is fixed merely because source code changed.

A user-facing fix requires, where applicable:

1. code committed
2. build completed
3. smoke/CI passed
4. target environment deployed
5. exact deployed revision verified
6. actual runtime/browser behaviour verified

If step 6 is missing, say **deployed, runtime verification pending**, not **fixed**.

## URL rule

Never give a HybridOne login/dev URL from memory.

Use `ENVIRONMENT.md`, then require a green public runtime route check before giving a dev route to the user.

If source and deployed behaviour disagree, deployed behaviour wins for diagnosis.

## Environment rule

Do not confuse:

- source file
- built `_site`
- GitHub Pages dev
- Vercel production
- live Supabase functions/database

State explicitly which layer was changed and which layer was verified.

## Production rule

While `PROJECT_STATE.json -> release_gate.production_hold` is true:

- do not promote dev to main
- do not remove the hold commit
- do not treat green CI as permission to promote
- production fixes require an explicit release decision after the release gate is reviewed

## Temporary test rule

Any temporary user, RPC, workflow or Edge Function created for testing must be:

- tightly scoped
- recorded in `STATUS.md` while active
- removed or made inert after use
- verified cleaned before the task is considered complete

## State-update rule

After any meaningful change to routing, Auth, email, permissions, deployment or the release gate:

- update `PROJECT_STATE.json`
- update `STATUS.md`
- update `AUTH_TEST_MATRIX.md` if evidence changed
- update `ENVIRONMENT.md` if a route/ID/deployment contract changed

The control files are part of the change, not optional documentation afterwards.

## Security rule

Do not weaken RLS, tenant isolation, service-role boundaries, webhook verification or Owner governance to make a test easier.

Prefer narrow SECURITY DEFINER RPCs with explicit caller/service checks over broad table grants.
