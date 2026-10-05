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
- Member Coach membership decision: eligible statuses are `active` + `paused` only. Paused members keep their coaching dashboard and history; `pending`, `cancelled`, and `expired` do not qualify. The invalid legacy `trial` status is being replaced with `paused`, with browser verification requiring the selected-gym membership request to return HTTP 200.
- No production promotion is implied by Task 3 completion.

### Membership status rules — Stage 1 (UI only), MERGED and verified on dev

PR #60 (`member-access-stage1`) is merged to `dev` at `3681852`. Touches no gym data, no database, no live Supabase.

- **Verification on dev:** all four gates green on `3681852` (smoke, Dev runtime, Auth journey browser, Protected routing browser), after one re-run of the Auth journey for a password-policy flake (run `37296683547` attempt 1: the generated reset password had no digit and Supabase returned 422; fixed by the `Hub1!`/`Puf1!` prefixes in `fix/auth-journey-password-prefix`).
- **Hand-tried on dev:** the paused and cancelled test accounts passed. **The pending case has not been tried in a browser.**

- The newest `memberships` row for the **selected gym** governs (no status filter first, never another gym). Owners, admins, staff and coaches bypass.
- Active = everything. Paused = account, membership, workouts, PBs and Member Coach with a banner, no classes/booking. Pending = membership page only. Cancelled/expired = message plus sign out only.
- New `getMembershipAccess` in `gym-context.js`, new `member-access-guard.js`, status-aware `member-coach.js`. `scripts/build_site.py` gains `add_member_access_guard()` (after `harden_member()`), which injects the guard into `member.html`, `social.html`, `groups.html`, `integrations.html` and patches `member.html` by exact string replacement (build fails if the text moves). If the guard cannot resolve, `member.html` falls back to the old lookup.
- **Not done / known gaps:** database enforcement (separate stage, needs the owner's approval of exact SQL); `member-experience.js` home tiles are not status-aware; `group-join.html` is not guarded.
- **Auth journey test updated in this PR (owner-approved diff):** the Member Coach assertions in `auth-journey-browser.yml` now expect the resolver's requests: a `gym_members` check (`select=gym_id,role,is_active,access_status`, selected gym and user) followed by a `memberships` lookup (selected gym, same user, `order=created_at.desc,id.desc`, `limit=1`, no status filter, HTTP 200). The disposable Auth account is an admin, so only Member Coach makes the memberships request (via `includeMembership`); owners/admins/staff/coaches bypass blocking screens but Member Coach still shows for them by their newest row's effective status. This will be the first browser run of the new code.
- **Stage 3:** a "Member Coach card renders" assertion is deferred, because we do not control whether the disposable account has a membership row.
- **Known duplicate request:** for ordinary members the guard and Member Coach each call the same resolver, so `gym_members` and `memberships` are requested twice per page. Harmless; sharing `HybridMemberAccessReady` is a possible follow-up.
- **Still open:** nothing stops API reads until Stage 2 (database enforcement). The pending case is untested in a browser (needs a pending test account, which needs the owner's approval of exact SQL).

### Membership status rules — Stage 2a (database enforcement, REPO ONLY, not applied)

Branch `feat/membership-status-db`, PR to `dev`. **Nothing was applied to the live Supabase project.** No `supabase db push`, no baseline applied, no migration history touched. Touches no gym data. Calendar-feed Edge Function (Stage 2c) and all locked rendering files untouched.

- New migration `supabase/migrations/20261005120000_membership_status_enforcement.sql`: `private.current_membership_status`, `private.member_status_allows`, status-aware `private.is_gym_member` / `private.can_write_gym` / `private.can_view_profile` / `private.member_has_class_access`, status gates in `book_class_session`, `member_book_class`, `member_class_schedule`, `get_member_home_settings`, and 15 permissive policies replaced by 28 narrower ones on 16 tables. The paid-drop-in loophole is closed: the status gate runs before any paid check, and class access now uses the newest membership row (not "any active row").
- Rollback: `supabase/rollback/20261005_restore_pre_membership_status.sql` (definitions copied programmatically from the repo baseline). Read-only checks and the before/after policy listing are in `supabase/verification/`.
- CI (`database-schema.yml`): expected object counts changed from functions 81 -> 83 and policies 154 -> 167 (tables 62, triggers 25, sequences 1 unchanged); new steps run the twelve-persona test, the read-only verification query, and prove the rollback restores the pre-migration catalog exactly.
- **Before Stage 2b:** the repo definitions must be diffed against the live catalog by ChatGPT (the owner approves the exact SQL first). Data warning: Puffin has 19 active members with no membership row; they count as `pending` and would lose class/social/workout access when this is applied until they have a membership row.
- Local evidence: tests were run on a local PostgreSQL 16 stand-in (no Docker in the build container), not on `supabase db reset --local`; the real CI run is the first run on the Supabase stack.

### Supabase egress incident (17 to 21 Sep 2026) — historic, resolved

About 15 GB of egress and roughly 16.9 million request initialisations over 17 to 21 Sep were a historic request storm. Fixes: the request guard (100 requests per 10 seconds triggers a 60 second block and a banner), social polling reduced from 30 seconds to 5 minutes, and an explicit `hybrid-gym-id` social lookup. The counter has been flat since. Do NOT reset `pg_stat_statements`. The dashboard grace-period banner is Supabase's and lasts until 22 Oct.

### Live test accounts

Two temporary Puffin Performance test accounts are now present for membership-status verification. Public documentation uses placeholders for account emails and Auth user IDs. No passwords are stored here or committed to the repository.

- `<paused-test-email>` — Auth user `<paused-test-user-id>` — Puffin `gym_members` role `member`, access `active`, membership status `paused`.
- `<cancelled-test-email>` — Auth user `<cancelled-test-user-id>` — Puffin `gym_members` role `member`, access `active`, membership status `cancelled`.

Cleanup SQL:

```sql
begin;

delete from public.memberships
where user_id in (
  '<paused-test-user-id>',
  '<cancelled-test-user-id>'
);

delete from public.gym_members
where user_id in (
  '<paused-test-user-id>',
  '<cancelled-test-user-id>'
);

commit;
```

Then delete both Auth users manually in the Supabase dashboard. After deleting the Auth users, confirm that the trigger-created profile rows are gone. If either profile remains, delete only those two profile rows with:

```sql
delete from public.profiles
where id in (
  '<paused-test-user-id>',
  '<cancelled-test-user-id>'
);
```

### Go-live checklist

Before lifting `PRODUCTION_HOLD`:

- remove the two temporary Puffin test accounts using the documented cleanup order;
- delete the test helper functions used for Auth/release verification once they are no longer required;
- turn on Supabase leaked-password protection;
- confirm no disposable/test Auth users remain;
- enable and verify member email confirmation;
- run the full Auth journey against the exact release SHA;
- verify multi-gym switching and per-gym role isolation on the exact release SHA;
- ensure required release/ruleset checks can report cleanly without a status deadlock;
- intentionally reconcile `dev` and `main` rather than blindly merging;
- deploy only the exact approved release SHA;
- browser-test the exact production revision before removing the production hold.

### Workflow backlog

- Auth workflow: Playwright install timeout and retry
- Sidebar active/highlight state quirk in the persistent admin shell (pre-existing; not introduced by Task 3)
- Membership status rules and banner for paused/cancelled/pending/expired members
- Member navigation inconsistent across member.html, groups.html and social.html
- Enable GitHub secret scanning and push protection — **done by owner**
- Make repo private — **separate infrastructure task before real customers**; requires a paid GitHub plan for private Pages and must first confirm the Vercel GitHub app retains access
- Run an all-history secret scan with Gitleaks or TruffleHog before launch
- Work-laptop SSL / connection error — **low priority**; now known to be specific to the work laptop/network environment and is probably not a site fault

### Legacy hourly production workflow safety

`main` and `dev` use the **same workflow path**, `.github/workflows/hourly-production.yml`, but currently contain different versions of that file.

- `main`: **Hourly production release** still contains `cron: '37 * * * *'` plus `workflow_dispatch`, and attempts to fast-forward `main` to `dev` whenever `main` is an ancestor of `dev`.
- `dev`: that same path has been replaced by **Manual production release**, which is `workflow_dispatch` only and requires the exact current dev SHA, an explicitly cleared production hold, all four exact-SHA checks, fast-forward ancestry, and a rollback tag before promotion.
- Because GitHub Actions enables/disables the workflow by repository workflow identity/path, disabling it in the Actions UI also leaves the manual replacement at that path disabled until it is deliberately re-enabled. Keep it disabled through reconciliation; only consider re-enabling after the scheduled trigger is removed from the version on `main`.
- Read-only history review from 26 September onward found **no hourly run that pushed to main**. Scheduled runs skipped because `main` and `dev` were diverged. The observed main changes in that period were direct/manual production changes and PR #29, not hourly promotion.
- The active `main` ruleset does not require a pull request. It requires fast-forward history and four status contexts (`smoke`, `auth-journeys`, `verify`, `routing`). Therefore an hourly fast-forward to a dev SHA carrying those four required green checks could satisfy the ruleset and push directly to `main`.

**Task 4 step 0:** keep the legacy hourly workflow disabled and, in the reconciliation PR, remove its schedule on `main` before any operation can make `dev` a descendant of `main` or otherwise make the branches fast-forwardable. No reconciliation step may create that ancestry while the schedule still exists.

### Task 4 Step 0 — COMPLETE (1 October 2026)

Step 0 was completed through PR #43.

- `main` before Step 0: `1684f9bc155769f6eb718742e3c0029893c674e2`
- Step 0 branch commit: `b16d5234205e093af6bd03138b39ffe0c02b8dbd`
- merged `main` commit: `34fada3c7e1780bdc9aad18acf6d02971049ba6c`
- only changed file on `main`: `.github/workflows/hourly-production.yml`
- exact runtime/config change: removed only the `schedule:` / `cron: '37 * * * *'` trigger; `workflow_dispatch:` remains
- the legacy workflow was kept disabled during the change and no `Hourly production release` run occurred after the merge
- the `main` ruleset was restored immediately after the merge and again requires `smoke`, `auth-journeys`, `verify`, and `routing`, with deletion and non-fast-forward protection still active
- Vercel production deployment `dpl_Ath7h42QS2YGVrWL2Mp49o1SHXue` for exact merge SHA `34fada3c7e1780bdc9aad18acf6d02971049ba6c` completed `READY` in the existing `hybrid-one` project
- compare from `1684f9b` to current `main` shows only the Step 0 workflow file change (0 additions, 2 deletions)
- no further Task 4 reconciliation step has started

**Hard stop remains:** do not begin the next Task 4 step until the owner approves that exact step.

### Task 4 Step 1 — COMPLETE (1 October 2026)

The production release workflow on `main` has been neutralised before any ancestry reconciliation.

- PR #46 replaced only `.github/workflows/hourly-production.yml` on `main` with dev's exact gated **Manual production release** version.
- frozen `main` SHA for reconciliation: `94803abaf78b3b994708bbd6c3e8f0f956a91d89`
- workflow blob on `main`: `945cc4386654c1199d534d9354d0ac29608d4962`, identical to dev
- trigger: `workflow_dispatch` only; no `schedule:` and no `cron:`
- Vercel production deployment for the PR #46 merge SHA completed `READY`
- compare from pre-Step-1 `main` `34fada3c7e1780bdc9aad18acf6d02971049ba6c` to current `main` changes only `.github/workflows/hourly-production.yml`
- no reconciliation commit has been created

The active `main` ruleset keeps all four required checks (`smoke`, `auth-journeys`, `routing`, `verify`) plus deletion and non-fast-forward protection. A repository-admin bypass is configured with mode **pull requests only** so the owner can explicitly bypass unmet PR requirements without weakening direct-push protections.

Temporary bypass governance follow-up:

> **Replace the bypass with a permanent fix:** make required checks reportable on PRs to main, or trim the ruleset to smoke and let the release workflow enforce the four gates.

Repository visibility note: this repository is currently **public**. Making it private remains a separate infrastructure task before real customers and must consider private GitHub Pages availability and Vercel GitHub-app access.

### Task 4 reconciliation — COMPLETE (1 October 2026)

History reconciliation is complete through PR #48.

- reconciled `dev` merge SHA: `db125d7e0f024ec5a828a3930c89ec3fa385fd29`
- reconciled tree SHA: `c3891f8c68e9633b340a5eb3b06be5a3ba76b1ed`, unchanged from pre-merge dev
- frozen `main`: `94803abaf78b3b994708bbd6c3e8f0f956a91d89`
- `main` is now an ancestor of `dev`
- compare `main...dev`: `behind_by: 0`
- exact post-reconciliation smoke run `36931979424` -> **PASS**
- exact post-reconciliation dev runtime run `36931978891` -> **PASS**
- public dev runtime verified at `db125d7e0f024ec5a828a3930c89ec3fa385fd29`
- manual production release workflow remains `workflow_dispatch` only, no schedule/cron, blob `945cc4386654c1199d534d9354d0ac29608d4962`
- production `main` did not change during reconciliation

The next release-candidate state PR records the current state and intentionally adds comment-only trigger changes to the Auth journey and protected-routing workflows. Its merge commit will be the final release-candidate SHA, and all four release gates must pass on that exact SHA.

### Before the first production release

- merge the release-candidate state PR and require all four exact-SHA gates on its merge commit: smoke, dev runtime, Auth journey, and protected routing;
- complete the remaining release prerequisites already tracked in the Auth/release checklist;
- **real-phone Hybrid Hub check:** use the friend's demo/Admin login on a physical phone and verify branded login, persistent Admin shell, dashboard, menu/navigation, refresh, and active-gym persistence;
- **paper rollback rehearsal:** write out the exact rollback sequence before release, anchored by `task4-baseline-2026-10-01` and the workflow's pre-release `prod-YYYY-MM-DD` tag;
- **Vercel read-only settings check:** verify the `hybrid-one` project, Git repository, production branch `main`, build command/output directory, domains, and that no dashboard override changes the repo contract;
- **Vercel Ignored Build Step:** verify the intended setting before release so only the intended production branch/build path is used; do not change it without separate approval;
- **release dry run:** execute the manual release flow up to, but not including, the production push and confirm exact SHA, hold state, four exact-SHA gates, fast-forward ancestry, rollback-tag availability, and the new `/index.html` curl/static guard check;
- **production hold:** lifting `PRODUCTION_HOLD` must be its own explicit PR. Until then, `production_hold: true` and `production_promotion_allowed: false` remain release-blocking;
- after the hold-lift PR, rerun the required exact-SHA gates if its merge commit becomes the release candidate;
- perform production promotion only after explicit owner approval, then verify the exact Vercel production SHA and production browser routes.

### Task 4 Step 2 routing decision — Option C

The main-only `/index.html → /` redirect is not carried forward because dev's `index.html` guard supersedes the legacy login it protected against; bare `/index.html` now goes to the universal login.

The production route gate will verify the public root, the static universal-login guard served at `/index.html`, the existing Hybrid Hub and Puffin Performance entry routes, and `/app`. The protected-routing browser gate verifies with JavaScript execution that bare `/index.html` reaches `login.html`.

### Task 4 read-only inventory — 1 October 2026

Read-only comparison at the start of Task 4 planning:

- current `dev`: `070a3cc3713ceb7aa0be1a340f08b25205cbb149`
- current `main`: `1684f9bc155769f6eb718742e3c0029893c674e2`
- merge base: `b7d83243e9248a64978677efec91c4f9d83c1052`
- branches are diverged: `main` has **9 commits not in dev** and `dev` has **256 commits not in main**
- no ancestry-changing reconciliation has been started
- the legacy `.github/workflows/hourly-production.yml` remains disabled in the Actions UI

The staged reconciliation plan and per-commit inventory are documented in [TASKS/TASK4_RECONCILIATION_PLAN.md](./TASKS/TASK4_RECONCILIATION_PLAN.md).

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

Production release completed at:

`538312c56996de115326970f45e42f0fcd841571`

Release evidence:

- Vercel production for exact SHA `538312c56996de115326970f45e42f0fcd841571` reached **READY**.
- rollback tag `prod-2026-10-02` points to prior production `94803abaf78b3b994708bbd6c3e8f0f956a91d89`.
- production routing run #5 (`37107898456`), dispatched from dev after the route-check corrections, passed against live production.
- production routing run #4 (`37015314660`) is a known, explained failure: it expected the marketing-page title at `/`, while live production and the approved candidate preview serve the universal-login guard there.
- login, Admin dashboard and the account menu were manually verified on production.
- `/` is currently the HybridOne sign-in entry page.
- the marketing page has not been served at `/` on the previous or current production deployment; it is available at `/landing.html`.
- `/hybrid-hub` and `/puffin-performance` are JavaScript redirect entry pages to universal `login.html`, carrying their gym hint and preserving `return_to`.

The production promotion hold is restored in dev after this verified release. A future release must deliberately clear it again.

## Next work

Release / platform backlog:

1. handle the `ubuntu-latest` runner change due on **19 October 2026**
2. fix the white menu button overlapping **Community** in the drawer
3. add a browser test for the `/hybrid-hub` and `/puffin-performance` redirect pages
4. make the product decision on whether a marketing page should be restored at `/`
5. enable leaked-password protection before real customers
6. make the Auth and protected-routing path filters cover each other, so one merge cannot leave a gate missing
7. delete the old preview branches
8. replace the temporary main-ruleset bypass with the permanent release/check solution

Product / auth backlog:

9. finish the remaining repeatable invite UI journeys and same-user different-role-per-gym browser fixture
10. enable and verify member email confirmation

