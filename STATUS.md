# HybridOne live status

## Authoritative post-regression checkpoint — 28 September 2026

Current `dev` application/state head before this documentation checkpoint:

`0654b4a085d463eaaaccd241caf741015e0ac871`

Current verification:

- smoke `36467112929` -> **PASS**
- public dev runtime `36467112883` -> **PASS**
- production `main` remains `dbe7528b83687df73a2ef2b289ae44390205ed11`
- branches remain diverged: dev **146 ahead / 4 behind**, merge base `b7d83243e9248a64978677efec91c4f9d83c1052`

### Gym picker regression — CLOSED

The missing **Switch gym** / gym picker regression is fixed.

- runtime fix: `3ee9028a7cae68e07d7536a10c60a969c14aabdf`
- exact authenticated browser evidence: run `36466232127` on `25ad1f57282dd1a21e29e868e28ac6cbcf80ace8`
- desktop + mobile visible persistent sidebar switch: **PASS**
- Hub -> Puffin -> Hub: **PASS**
- refresh/back and sign-out/re-login context handling: **PASS**
- later commits through current dev do not modify the picker runtime implementation

The overall Auth workflow later failed in a separate fixed-email helper collision because two Auth runs overlapped. The real reset/magic-link browser journeys had already passed. The shared fixture is now serialized by workflow commit `cc519860add97eb796dc379c5eaf3f53c1cff133`.

### Invite browser gate — PASS

Run `36465324428` on `574f959d33a716661ad321e9a9d803d312e5bb33` now repeatably verifies fresh Create account invites, existing-account acceptance, wrong-account mismatch + Switch account recovery, backend invite edge cases and cleanup.

### Task 3 multi-gym selector hardening — DONE

Task 3 is complete on dev.

- PR #34 first applied the eight selected-gym hardening changes, then PR #35 reverted it when the Auth journey failed.
- Read-only diagnosis showed the first failure was a test-design error: the test expected six Classes membership-selector requests, but only five named helper scripts make that lookup; `calendar-mobile.js` is DOM-only.
- PR #36 retried the eight runtime changes with named-helper verification instead of relying on the original six-request assumption.
- The retry run then exposed a second test-design error: the Member-page test treated every `select=gym_id` request as Social, but the pre-existing `tenant-branding.js` legitimately lists the current user's active gyms.
- PR #37 corrected that classification: it allows exactly one named tenant-branding list-my-gyms call, separately requires `social-nav.js` to query the selected gym, and rejects any other unscoped `select=gym_id` lookup.
- Verified Task 3 source SHA: `979a36ce7aba3ab6c85bbffd3efe7822a310c6a7` (`979a36c`). Manual gym-switching verification on dev passed.
- Task 3 test-design lessons:
  - do not hard-code request counts when multiple independently loaded helpers can change timing or request coalescing;
  - attribute important network assertions to named scripts/behaviours rather than infer ownership from a broad URL shape;
  - shared scripts can make legitimate unscoped list-my-gyms calls, so tests must permit only the exact named call and continue rejecting broader unscoped tenant selection.
- Separate pre-existing issue remains: `member-coach.js` queries membership status `trial`, but the live membership status enum does not contain `trial`. This is not part of Task 3 and remains unresolved.
- No production promotion is implied by Task 3 completion.

### Workflow backlog

- Auth workflow: Playwright install timeout and retry
- Sidebar active/highlight state quirk in the persistent admin shell (pre-existing; not introduced by Task 3)

### Remaining Auth release gates

Still open:

1. same Auth user with **different roles in different gyms** browser fixture
2. enable Supabase member email confirmation
3. browser-test the real confirmation-link signup journey
4. intentionally reconcile `main` / `dev`
   - Restore the `main` ruleset to all 4 required checks as a permanent fix, but ensure every required check can actually report on a PR to `main` (or is enforced by the release workflow) so required-status deadlocks cannot recur.
5. promote and browser-test the exact Vercel production revision

**PRODUCTION_HOLD remains ACTIVE.**

> Older checkpoint sections below are retained as historical evidence; this block is the current operational state.


## Current checkpoint - 28 September 2026

Current `dev` head:

`35a7a80a3b6894a776dd253c94f8b47fcefc15d6`

Current exact-head evidence:

- smoke run `36460766581` -> **PASS**
- public dev runtime run `36460766735` -> **PASS**

Latest full Auth/multi-gym browser evidence:

- run `36311647499` -> **PASS**
- source `9039ed4b20017580be0eb0c17034497d3cc6733b`

Important: that full Auth browser pass predates the 28 September member-view/navigation commits.

### OPEN REGRESSION: gym picker / Switch gym visibility

The user reports that the gym selection picker is **not showing in the core app** on the current dev build.

Expected contract:

- authentication is person-first
- one active gym -> enter directly
- 2+ active gyms -> `choose-gym.html`
- once inside the app, a multi-gym user must have a visible **Switch gym** route back to the chooser
- role must be re-resolved for the selected gym

Current implementation still contains:

- `choose-gym.html`
- `account-menu.js` multi-membership loading
- `Switch gym` action to `choose-gym.html?switch=1`

Do **not** treat the historical multi-gym browser pass as proof that the picker is visible on the current head. Reproduce this exact report first in the next chat.

### Recent 28 September change

The latest commits separate **member settings** from the authenticated **Member view** navigation and align the smoke assertions with that structure:

- `f80dbe5a...` Separate member settings from authenticated member view
- `f0665dc2...` Update smoke checks for authenticated member view
- `35a7a80a...` Align member-view smoke assertion with nav structure

The final smoke/runtime checks are green at `35a7a80a...`.

Production remains **HELD** on `main` `dbe7528b83687df73a2ef2b289ae44390205ed11`.

**Updated: 28 September 2026**

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
