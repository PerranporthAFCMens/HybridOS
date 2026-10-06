# Task 4 — main/dev reconciliation plan

**Status:** planning only. Do not execute any reconciliation step until the owner approves that exact step.

**Read-only inventory date:** 1 October 2026

## Current branch state

- `dev`: `070a3cc3713ceb7aa0be1a340f08b25205cbb149`
- `main`: `1684f9bc155769f6eb718742e3c0029893c674e2`
- merge base: `b7d83243e9248a64978677efec91c4f9d83c1052`
- `main` has **9 commits not in dev**
- `dev` has **256 commits not in main**
- branches are intentionally diverged
- `PRODUCTION_HOLD` remains active
- legacy `.github/workflows/hourly-production.yml` is disabled in the Actions UI

No ancestry-changing operation has been started.

## Main-only commit inventory

### 1. `424bfb9` — Hold production promotion pending dev Auth browser verification

- Files changed by the commit: none in the current commit diff.
- Purpose: a production hold/checkpoint marker.
- Equivalent on dev: yes, the production hold is now represented more explicitly in `PROJECT_STATE.json`, `STATUS.md`, and the manual release workflow.
- Risk of loss: no runtime behaviour to preserve.

### 2. `a197bd2` — Hotfix production Auth return route

- File: `auth-return.html`.
- Purpose: add password-reset / secure-return handling and route the signed-in user to the correct role surface.
- Equivalent on dev: yes, and dev is newer. Dev's `auth-return.html` uses `gym-context.js`, active access status, universal multi-gym selection, and current role routing.
- Risk of loss: do **not** overwrite dev with the older main implementation.

### 3. `54be7b1` — Protect production Auth return route

- File: `scripts/smoke_test.py`.
- Purpose: smoke assertions for the Auth-return contract.
- Equivalent on dev: yes, dev has later Auth/universal-login smoke coverage.
- Risk of loss: preserve the current dev assertions; do not restore an older pinned smoke file wholesale.

### 4. `dbe7528` — Fix canonical production route handling

- Files: `.github/workflows/production-routing.yml`, `vercel.json`.
- Purpose: canonical production-route verification plus `trailingSlash: false`.
- Equivalent on dev: mostly.
  - `trailingSlash: false` is already on dev.
  - dev already has the production-routing workflow.
- Main-only detail still worth preserving: later main routing checks include the public root and `/index.html`; dev's current routing workflow does not yet include those two probes.

### 5. `a28fc08` — Stop exposing legacy generic login at index

- Files: `.github/workflows/production-routing.yml`, `vercel.json`.
- Purpose:
  - verify `/` and `/index.html` resolve to the public landing page;
  - redirect production `/index.html` to `/`.
- Equivalent on dev: partial.
  - dev has a newer universal-login guard inside `index.html`;
  - dev does **not** currently have the Vercel `/index.html -> /` redirect;
  - dev's production-routing workflow does **not** currently probe `/` and `/index.html`.
- Risk of loss: these two production-canonical behaviours are the main items that must be carried forward intentionally.

### 6. `7bf7a22` — Guard bare production index from legacy login

- File: `index.html`.
- Purpose: prevent a bare production index from exposing the old generic login while allowing bound/embedded contexts.
- Equivalent on dev: yes, but implemented differently and more recently. Dev's early universal-login entry redirects unbound app entry to `login.html`, while bound/embedded/invite contexts remain allowed.
- Reconciliation rule: retain dev's newer universal-login implementation. Preserve production `/index.html -> /` at the Vercel route layer rather than replacing dev's `index.html` with main's older script.

### 7. `3e6d01f` — Keep mobile Hybrid Hub login inside admin shell

- File: `admin-frame.js`.
- Purpose: remove the mobile redirect that escaped the persistent Admin shell.
- Equivalent on dev: yes. Current dev no longer contains that mobile escape and has newer admin-shell logic.
- Risk of loss: do not overwrite dev's newer `admin-frame.js`.

### 8. `5276a1a` — Update smoke assertion for persistent mobile admin shell

- File: `scripts/smoke_test.py`.
- Purpose: make smoke fail if the mobile Admin shell redirects out of the persistent shell.
- Equivalent on dev: yes; current dev smoke still contains the persistent-mobile-shell protection plus later checks.
- Risk of loss: keep dev's later smoke implementation.

### 9. `1684f9b` — Merge PR #29 mobile Hybrid Hub login fix

- Files: `admin-frame.js`, `scripts/smoke_test.py`.
- Purpose: merge of items 7 and 8.
- Equivalent on dev: yes.
- Risk of loss: none beyond preserving the newer dev versions already noted.

## Step 1 — production workflow neutralised before reconciliation

**Status: COMPLETE — PR #46**

- frozen `main` SHA for reconciliation: `94803abaf78b3b994708bbd6c3e8f0f956a91d89`
- `.github/workflows/hourly-production.yml` on `main` is now dev's exact gated **Manual production release** file
- blob SHA: `945cc4386654c1199d534d9354d0ac29608d4962`
- trigger: `workflow_dispatch` only
- no `schedule:` and no `cron:`
- PR #46 changed no application files
- no reconciliation commit or ancestry-changing reconciliation branch has been created

The active `main` ruleset retains `smoke`, `auth-journeys`, `routing`, and `verify`, together with deletion and non-fast-forward protection. A repository-admin bypass is configured as **pull requests only**. It is a temporary owner escape hatch for PR deadlocks, not the intended permanent governance model.

**Permanent ruleset follow-up:** Replace the bypass with a permanent fix: make required checks reportable on PRs to main, or trim the ruleset to smoke and let the release workflow enforce the four gates.

Repository visibility: the repository is currently **public**. Any move to private remains a separate infrastructure task and must first account for private GitHub Pages availability and continued Vercel GitHub-app access.

## Task 4 routing decision — Option C

The main-only `/index.html → /` redirect is not carried forward because dev's `index.html` guard supersedes the legacy login it protected against; bare `/index.html` now goes to the universal login.

The useful main-only behaviour retained is the production verification itself: the public root must serve the HybridOne landing page, `/index.html` must serve the current universal-login guard, and a real browser test must prove that the guard executes and reaches `login.html`. Existing `/hybrid-hub`, `/puffin-performance`, and `/app` checks remain.

## What main has that dev would currently lose

The read-only inventory originally identified two main-only routing details. After tracing current dev, the reconciliation decision is:

1. Do **not** carry the Vercel `/index.html -> /` redirect forward; current dev's early `index.html` guard supersedes the legacy generic-login protection and routes bare visits to universal `login.html`.
2. Carry forward the useful production-route verification by checking the public root and the static `index.html` universal-login guard, with a real browser check proving bare `/index.html` executes that guard and reaches `login.html`.

Everything else in the nine main-only commits is either:
- already present on dev in a newer/equivalent form; or
- a historical/empty checkpoint rather than unique runtime behaviour.

## Old URL compatibility contract

The reconciled release must keep these production URLs working:

- `/` -> public HybridOne landing page
- `/index.html` -> universal `login.html` via the current dev guard
- `/hybrid-hub` and `/hybrid-hub/` -> Hybrid Hub login
- `/puffin-performance` and `/puffin-performance/` -> Puffin Performance login
- `/app` and `/app/` -> HybridOne application entry, which then follows the universal person-first login/gym-context model

Bound application contexts (for example embedded/admin, explicit `gym_id`, or access-invite flows) must continue to work and must not be redirected to the public landing page.

## Step 0 — mandatory: neutralise the legacy hourly release

This step must happen before any ancestry change.

1. Keep `.github/workflows/hourly-production.yml` disabled in GitHub Actions.
2. Prepare an exact, reviewable change whose version destined for `main` removes:
   - `schedule:`
   - `cron: '37 * * * *'`
3. The resulting `main` workflow must be the approved manual-only release mechanism.
4. Before the owner approves the change, show:
   - exact workflow diff;
   - confirmation that no application files are included;
   - confirmation that the workflow remains disabled;
   - confirmation that this change does not alter branch ancestry.
5. The owner performs/approves any exceptional `main` PR or merge required for this step.
6. Verify on `main` after merge that:
   - no schedule trigger exists;
   - workflow is still disabled;
   - `main` and `dev` are still not made fast-forwardable by any other operation.

**Hard stop:** no merge/rebase/fast-forward that changes `main`/`dev` ancestry until Step 0 is verified complete.

## Ruleset deadlock — owner-operated fix

Current `main` ruleset requires these four status contexts:

- `smoke`
- `auth-journeys`
- `verify`
- `routing`

Current workflow triggers do not make all four naturally report on a pull request to `main`:

- `smoke`: reports on pull requests.
- `auth-journeys`: runs on `dev` push/manual, not a normal PR to `main`.
- `verify` (dev runtime): runs on `dev` push/manual, not a normal PR to `main`.
- `routing`: production-routing runs on `main` push/manual, not a normal PR to `main`.

That is the deadlock.

### Safe ruleset principle

The `main` ruleset should require only checks that can actually report **before** a PR is merged, while the manual release workflow separately requires the exact release SHA to have all four release-gate workflows green.

Recommended owner change during Task 4:

- keep non-fast-forward protection;
- keep deletion protection;
- require a pull request for normal human changes to `main` if practical for the chosen release design;
- require `smoke` as the PR-time status check because it actually runs on PRs;
- do not require `auth-journeys`, `verify`, or `routing` as PR-time contexts unless their triggers are deliberately changed so they can report safely on the PR candidate;
- keep all four exact-SHA release checks enforced by the manual production-release workflow before promotion.

The owner makes any ruleset edit manually. The AI must show the proposed setting values in plain English first and then wait.

## Option A — recommended: preserve deltas, then merge main into a dev-based reconciliation branch

This option keeps dev as the authoritative application implementation and uses a normal merge only after Step 0 is safe.

### A1. Freeze, re-inventory and tag the reconciliation baseline

After Step 0:
- record exact `main` and `dev` SHAs again;
- confirm no new main-only commits appeared;
- confirm workflow schedule is absent on `main`;
- confirm the workflow remains disabled;
- present the exact proposed baseline tag name and target SHA to the owner;
- only after explicit approval, create the Task 4 baseline tag on the exact pre-reconciliation production commit. Do not move or overwrite that tag later.

**Owner approval view:** branch SHAs, fresh compare, list of any newly changed files, exact proposed baseline tag name/target, and confirmation that creating the tag does not change either branch.

### A2. Carry the intentional production-route verification onto dev first

On a branch created from the exact approved `dev` SHA:
- do **not** change `vercel.json`;
- extend the production-routing verification so it checks `/` serves the public landing and `/index.html` serves the current universal-login guard;
- extend the protected-routing browser test so JavaScript execution proves bare `/index.html` reaches `login.html`;
- keep dev's newer `index.html`, `auth-return.html`, `admin-frame.js`, and smoke logic.

Open a PR to `dev`. Owner merges it.

Checks before approval:
- PR diff contains only the intended routing/config/test-doc changes plus `STATUS.md`;
- smoke green;
- old URL static/config assertions green;
- no production deploy is implied.

Browser checks after merge to dev:
- GitHub Pages/dev application entry still reaches universal login;
- embedded/gym/invite entry still works;
- **Admin-shell regression check on both desktop and mobile:** sign in as an admin, open the Admin shell, and confirm the Admin dashboard still loads correctly with `index.html` embedded inside the shell while bare `/index.html` continues to route to universal login;
- mobile Admin shell remains persistent;
- Auth journey and protected routing pass on the exact merged dev SHA.

**Rollback:** revert this dev PR if any exact-SHA browser gate fails.

### A3. Create reconciliation branch from the now-verified dev SHA and merge main into it

Only after Step 0 and A2 are green:
- create a temporary reconciliation branch from the exact verified `dev` SHA;
- merge the current `main` into that temporary branch;
- resolve conflicts deliberately:
  - prefer current dev for application/auth/admin code where dev already contains a newer equivalent;
  - keep the two production-route behaviours already carried in A2;
  - preserve the manual-only release workflow;
  - never reintroduce the hourly schedule.

Do **not** merge this temporary branch directly to production.

Run:
- smoke;
- dev runtime;
- full Auth journey;
- protected-routing browser;
- invite browser matrix where touched paths require it;
- desktop/mobile spot checks for Hybrid Hub, Puffin, member portal, gym switcher, and Admin shell.

Open the reconciliation PR to `dev`.

**Owner approval view:** full merge diff, conflict-resolution summary by file, exact green workflow links, old-URL checklist, rollback commit.

### A4. Owner merges reconciliation PR to dev

After merge:
- rerun the four exact-SHA release gates on the resulting dev head;
- verify `main` is now an ancestor of the intended dev release candidate;
- verify the manual release workflow is still disabled unless/until separately approved for release;
- verify no schedule trigger exists anywhere in the version intended for main.

If anything fails: revert the reconciliation PR on dev first and stop.

### A5. Ruleset adjustment approval

Before any promotion:
- present current main ruleset and proposed owner changes;
- owner changes the ruleset manually;
- verify the ruleset no longer requires checks that cannot report in the chosen PR/release path.

No production promotion yet.

### A6. Release approval

Before the owner approves release, show:
- exact dev SHA proposed for production;
- all four exact-SHA release checks green;
- production hold status and explicit proposed hold-clear diff;
- old URL compatibility results;
- rollback tag name that will be created;
- confirmation that main is an ancestor of the exact dev SHA;
- confirmation that the workflow on main is manual-only.

Only then may the separately approved release process run.

### A7. Production browser verification

Immediately after promotion:
- verify exact deployed revision/SHA;
- test `/`, `/index.html`, `/hybrid-hub`, `/puffin-performance`, `/app`;
- test universal login and gym selection;
- test Hybrid Hub mobile Admin shell;
- test Puffin member login;
- test one multi-gym switch;
- test password-reset/Auth-return route.

Do not lift `PRODUCTION_HOLD` until these are green.

**Rollback:** use the pre-release production tag to return main to the prior production SHA, then browser-test the rollback revision.

### Why Option A is recommended

It makes the two unique main behaviours explicit before the history merge, so conflict resolution is easier to review. It also avoids copying older main implementations over dev's newer Auth/admin code. The merge then becomes primarily a history reconciliation rather than a feature-selection exercise.

## Option B — merge main into a dev-based reconciliation branch first, then resolve all differences in one PR

After Step 0:
- create a reconciliation branch from exact dev;
- merge current main into it;
- resolve every conflict and current file difference in one branch;
- preserve dev's newer Auth/admin implementations;
- manually preserve the two main-only production route behaviours;
- run the same complete test matrix;
- open one reconciliation PR to dev.

### Advantages

- fewer PRs;
- one combined history reconciliation.

### Disadvantages

- larger review surface;
- routing preservation and history reconciliation are mixed together;
- easier to accidentally accept an older main implementation during conflict resolution;
- rollback and fault isolation are less clear.

### Recommendation

Use **Option A** unless the fresh post-Step-0 compare shows the branches have become materially simpler. It gives the owner smaller approval points and clearer rollback boundaries.

## First-release preview and rollback rehearsal

### Vercel preview rule

The Vercel project currently uses **Ignored Build Step: Automatic**.

Because Automatic can skip a build for a Git SHA that Vercel has already deployed, **never use the exact release-candidate SHA itself to create the production-shape preview**.

For every release candidate:

1. Keep the exact release-candidate commit unchanged.
2. Create a temporary preview-only commit whose tree is byte-for-byte identical to the release-candidate tree and whose parent is the exact release-candidate SHA.
3. Put only that preview-only commit on a temporary non-`dev`, non-`main` preview branch.
4. Prove:
   - preview-only tree SHA equals the release-candidate tree SHA;
   - compare release candidate -> preview-only commit has **0 files changed**.
5. Use only the resulting Vercel Preview deployment to test production-shape routes such as `/hybrid-hub`, `/puffin-performance`, `/index.html`, and `/app`.
6. The preview-only commit/branch is never promoted to production.
7. After the actual release, verify the Vercel **production** deployment:
   - target is `production`;
   - Git ref is `main`;
   - Git SHA is exactly the approved release-candidate SHA;
   - deployment is `READY`;
   - the deployment was not skipped by Automatic / Ignored Build Step.

### Immediate post-promotion production route go/no-go

As soon as the manual release workflow pushes the approved release-candidate SHA to `main` and Vercel reports the matching production deployment as `READY`:

1. Dispatch **HybridOne production routing** from `main` (or run the exact equivalent live route checks).
2. Verify the live production routes:
   - `/`
   - `/hybrid-hub`
   - `/puffin-performance`
   - `/index.html`
   - `/app`
3. For `/index.html`, require all of the following:
   - HTTP 200;
   - final route-layer path remains exactly `/index.html`;
   - the served HTML contains the universal-login guard;
   - the guard contains the embedded / `gym_id` / `access_invite` exemptions;
   - the guard contains `location.replace('./login.html')`.
4. **GO:** only if the production-routing run/live checks are green and the exact Vercel production Git SHA is the approved release candidate.
5. **NO-GO:** if any route check fails, the production deployment SHA does not match, or `/index.html` is redirected/served incorrectly. Stop further release activity and trigger the documented rollback procedure immediately. Do not fix forward in production.

### Re-arm the production hold after a successful release

After production is verified healthy and the first-release acceptance checks are complete, open a separate small PR that returns:

- `production_hold: true`
- `production_promotion_allowed: false`

Merge that hold-reset PR before normal development toward the next planned release. Every future release must use its own separately reviewed hold-lift PR and exact-SHA release gates.

### Paper rollback rehearsal for the first production release

The standard rollback target is the pre-release `prod-YYYY-MM-DD` tag created by the manual release workflow immediately before promotion. The immutable Task 4 fallback remains `task4-baseline-2026-10-01`.

#### A. Immediate service rollback in Vercel

1. **Owner:** identify the failed production deployment and stop further release activity.
2. **Owner:** in Vercel, use **Instant Rollback** to restore the last known-good production deployment when immediate service restoration is required.
3. **Owner:** confirm both production aliases resolve to the rolled-back deployment:
   - `www.hybridone.co.uk`
   - `hybridone.co.uk`
4. **Owner / AI read-only verification:** record the exact Vercel deployment ID and Git SHA now serving production.
5. **Important re-check:** Vercel Instant Rollback normally stops production from automatically following later Git `main` deployments until production is deliberately re-promoted. Before any subsequent release, explicitly verify which deployment currently owns the production aliases and re-promote the intended Git-backed production deployment if required.

Instant Rollback restores service, but it does **not** by itself repair GitHub branch history.

#### B. Restore GitHub main without force-moving protected history

Preferred recovery keeps `main` moving forward.

1. **Owner / AI:** identify the chosen rollback source:
   - first choice: the new `prod-YYYY-MM-DD` tag created immediately before the failed release;
   - fallback: `task4-baseline-2026-10-01`.
2. **AI:** prepare a rollback branch from the current `main` head whose resulting tree exactly matches the chosen rollback tag's tree. Do not force-reset `main`.
3. **AI:** prove the rollback branch tree equals the chosen rollback tag tree and show the exact diff against current `main`.
4. **AI:** open a rollback PR to `main`. Do not merge it.
5. **Owner ruleset step, in plain English:**
   - leave the `main` ruleset enabled;
   - leave all four required checks present;
   - leave deletion protection enabled;
   - leave non-fast-forward protection enabled;
   - use the existing **Repository admin — pull requests only** bypass only on this rollback PR if the normal required-check set cannot all report before merge;
   - explicitly choose GitHub's **Merge without waiting for requirements** option for that PR;
   - do not add any bot, workflow or GitHub App to the bypass list;
   - do not disable the ruleset and do not remove/re-add the required checks.
6. **Owner:** merge the rollback PR with **Create a merge commit**.
7. **AI read-only verification:** confirm the new `main` merge commit's tree exactly matches the selected rollback tag tree.
8. **AI read-only Vercel verification:** confirm Vercel creates a production deployment for that new rollback merge SHA, reaches `READY`, and production aliases point to it.
9. **Owner / AI:** browser-check `/`, `/index.html`, `/hybrid-hub`, `/puffin-performance`, and `/app`, plus one Hybrid Hub Admin login.

#### C. Consequence: main/dev diverge again after a rollback commit

A forward rollback commit on `main` means `main` will no longer be an ancestor of the unchanged `dev` branch.

The manual production release workflow deliberately checks:

`git merge-base --is-ancestor current-main candidate-dev`

Therefore, after the rollback commit, the next attempted promotion from `dev` will correctly **refuse** until history is reconciled again.

Recovery before the next release:

1. Keep the production hold active.
2. Re-run the same controlled history-reconciliation pattern:
   - freeze exact current `main` and `dev` SHAs;
   - preserve the verified `dev` tree;
   - create an ancestry-only two-parent reconciliation commit with the current dev tree, parent 1 = current dev, parent 2 = the new rollback `main`;
   - prove the tree is unchanged, the ordered parents are correct, `main` is now an ancestor, and compare dev -> reconciliation branch has 0 files changed;
   - open a PR to `dev`;
   - owner merges with **Create a merge commit** only.
3. Re-run the four exact-SHA gates on the resulting dev merge SHA.
4. Re-do the preview-only Vercel route check using a new identical-tree preview-only commit, never the exact release-candidate SHA.
5. Only then may a future hold-lift/release sequence proceed.

#### D. Exact historical-SHA reset is emergency-only

If the owner explicitly requires `main` itself to point back to the exact historical tag SHA rather than restoring that tag's tree through a new forward rollback commit, the non-fast-forward protection would have to be temporarily bypassed/changed and `main` force-moved.

That is **not** the standard rollback path and must never happen automatically. It requires a separate explicit owner-approved emergency procedure.

## Approval gates — what the owner should inspect

Before every approval, provide:

1. **Exact scope** — branch/SHA and files changing.
2. **What is deliberately preserved** — especially Auth, mobile Admin shell, old production URLs, and the manual release gate.
3. **What is deliberately not changing** — Supabase, gym data, unrelated UI/features.
4. **Checks** — exact workflow names, run IDs/links, and candidate SHA.
5. **Browser evidence** — which URLs/roles/viewport were tested.
6. **Rollback** — exact commit/tag/revert path.
7. **Risk statement** — anything unresolved or surprising.

If any of these cannot be shown clearly, stop and do not ask for merge/release approval.
