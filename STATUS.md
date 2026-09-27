# HybridOne live status

**Updated: 27 September 2026**

Machine-readable state: [PROJECT_STATE.json](./PROJECT_STATE.json)

## Release state

**PRODUCTION_HOLD: ACTIVE**

Production promotion allowed: **NO**

The universal login/multi-gym model is working on dev. Exact-SHA browser run `36311299027` now verifies desktop/mobile switching, sign-out/re-login and mobile refresh/back. Production is intentionally still on the older gym-specific entry model until the remaining Auth release-gate journeys are complete.

## Branches

- production `main`: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- development application checkpoint: `cbee25179d8b6ce5a93c09c8937b3194c62da974`
- relationship: diverged
- dev ahead of main at application checkpoint: 115 commits
- dev behind main: 4 commits
- merge base: `b7d83243e9248a64978677efec91c4f9d83c1052`

Do **not** blindly merge or overwrite either branch.

## Latest verified dev checkpoint

Source:

`cbee25179d8b6ce5a93c09c8937b3194c62da974`

Latest verification:

- HybridOne smoke checks: run `36311298789` -> **PASS**
- HybridOne dev runtime verification: run `36311298820` -> **PASS**
- HybridOne Auth journey browser: run `36311299027` -> **PASS**

The latest change makes the bare application entry coherent with the new Auth model:

- bare `index.html` -> universal `login.html`
- embedded Admin dashboard use remains valid
- explicit `gym_id` context remains valid
- access-invite context remains valid

This prevents the old tenant-less dashboard/login surface from appearing when someone visits the app entry directly.

## Universal login / gym context

Authoritative rule:

> **Authenticate the person first. Then select an active gym context.**

Verified flow:

1. user signs in once with email + password
2. HybridOne loads all active gym memberships
3. one active gym -> direct entry
4. multiple active gyms -> **Choose a gym**
5. selected gym becomes the current context
6. role is resolved for that gym
7. multi-gym users can use **Switch gym** later

Current context:

`sessionStorage['hybrid-gym-id']`

Last-used convenience hint:

`localStorage['hybrid-last-gym-id']`

Never use the last-used value, email address or a URL gym hint as permission.

## Multi-gym browser evidence

Authenticated browser audit:

- workflow run `36199919230`
- source `6a14cfed829f01eace2ad094dd14e1dd08b27120`
- desktop: 1440 x 1000
- mobile: 390 x 844
- Hub -> Puffin -> Hub switching: **PASS**
- 21 authenticated product surfaces per viewport
- no horizontal overflow on audited surfaces

The exact application checkpoint above retains the same gym-context model. Smoke, runtime and the end-to-end Auth journey are green.

Protected routing browser evidence:

- run `36199700825` -> **PASS**
- verifies universal login redirect
- verifies gym hint preservation
- verifies safe same-origin `return_to`

## UI consistency

The app-wide visual consistency sweep remains in force.

- canonical shared layer: `app-consistency.css`
- static guard: `scripts/ui_consistency_check.py`
- contract: [UI_CONSISTENCY.md](./UI_CONSISTENCY.md)
- authenticated whole-app audit: `36199919230` -> **PASS**

The purpose is consistency, not identical feature geometry.

## Auth/email

Verified:

- Hybrid Hub password reset
- Puffin Performance password reset
- Hybrid Hub magic link
- Puffin Performance magic link
- same Auth identity across multiple gyms
- universal chooser / gym switching
- protected-route universal login
- corrected Admin invite email template
- invite resend UI + delivery
- live backend wrong-account / expired / revoked invite rejection
- one-Owner and multi-Owner invite governance
- Admin invite activation in a fresh browser context

Still release-gating:

- fresh new-account invite **Create account** browser journey
- repeatable existing-account invite acceptance fixture
- wrong-account mismatch / switch-account browser UI journey
- enable Supabase member email confirmation and browser-test the confirmation-link flow

See [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md).

## Member email confirmation decision

Decision remains:

> Self-service member registration must confirm the email address before account access continues.

The product decision is locked. `join.html` now handles the no-session confirmation state, but live run `36311299027` still observed an active session with the email already confirmed at creation. Supabase still needs the Email confirmation setting enabled and the resulting join/confirmation journey browser-tested before release.

## Production

Production origin:

`https://www.hybridone.co.uk`

Production remains on `main` at:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Do not treat dev behaviour as production behaviour until an intentional promotion has occurred and the Vercel runtime has been browser-verified.

## Next work

1. finish the remaining repeatable invite UI journeys and same-user different-role-per-gym browser fixture
2. enable and verify member email confirmation
3. intentionally reconcile `main` and `dev`
4. promote only after the release gate clears
5. browser-test the exact Vercel production revision
6. then remove the production hold
