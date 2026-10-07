# HybridOne handover (read this first)

Repo: PerranporthAFCMens/HybridOS (public). Read `STATUS.md` and `AI_WORKING_RULES.md` in the repo root first. They are the project record. This file adds the working agreements and the state of the current task. Last updated 5 October 2026.

## Who the owner is and how to work with them
- The owner is a non-developer building this with AI help. Use plain English. Explain what each step does and what a pass or fail looks like.
- One action at a time. Put anything the owner must do or wait for FIRST in a list, never in a closing line.
- Do not schedule the owner's steps onto days or dates.
- When they say "stop" or ask a question, stop and answer before doing more.
- Keep handling and length to a minimum. Usage is limited and the owner has said relaying long reports between tools is wasteful. Short replies. Do not ask the owner to paste long reports into another tool: give the PR number and let the reviewer read GitHub.

## Who does what
- Builder (Claude Code): writes code, runs the build and smoke test, opens the PR to `dev`, updates `STATUS.md`. Best for access-control and database code (it can run the build and tests).
- Reviewer (Claude in chat): reviews each PR once from its number, reading GitHub directly, and says merge or do not merge with reasons. Short answers.
- ChatGPT: only for what needs its connectors: reading Actions run results after a merge, and Supabase or Vercel work (live catalog diffs, applying approved SQL). It has hit a safety block when writing access-control code, so do not give it that.
- Owner: merges everything except safe PRs the builder may merge under rule 16 of `AI_WORKING_RULES.md`, and approves anything touching `main`, rulesets, Vercel settings or the live Supabase project.

## Hard rules (the owner approved these; they have prevented real incidents)
1. You open PRs to `dev`. The owner merges. Never merge, except the narrow case in rule 16 of `AI_WORKING_RULES.md` (safe PRs to `dev` inside an allow-list, all checks green, on trial).
2. Never change `main`, rulesets, Vercel settings or the LIVE Supabase project without the owner approving the exact text (the exact SQL, command or setting). Workflow files: a task-related change may be committed to the PR branch without prior approval and is reviewed at the PR (rule 15 in `AI_WORKING_RULES.md`). That does not cover the release workflow, `permissions`, secrets, OIDC, anything that changes who can deploy, direct pushes to `dev` or `main`, or loosening an assertion.
3. Live Supabase is read-only unless the owner approves exact SQL. Never run `supabase db push`. Never apply the baseline migration. Never mark migration history as applied. Apply an approved migration as ONE transaction.
4. Stop at the first problem and report. Do not fix forward. After any live change, a fresh Auth journey run on the exact resulting `dev` SHA must pass, or roll back first.
5. No secrets, tokens, passwords or personal emails in the repo (it is PUBLIC). Use placeholders.
6. Update `STATUS.md` in every PR.
7. Say which gym a change touches. Puffin Performance is the test gym. Hybrid Hub is a demo for the owner's friend, so keep experiments and test accounts off it.
8. Do not weaken a test to make it pass. A test is changed only when the test is wrong, with evidence.
9. Never retry or disguise a write that a tool blocks. Report it.

## How the pipeline works
- `dev` is development. `main` is production (Vercel project `hybrid-one`, domain hybridone.co.uk). The dev test site is GitHub Pages, which ignores `vercel.json`.
- Four gates run on pushes to `dev`: smoke, dev runtime (`verify`), Auth journey (`auth-journeys`), protected routing (`routing`). The two browser gates trigger on any `**.html`, `**.js`, `**.css`, `vercel.json`, `scripts/**`, `PROJECT_STATE.json` or `.github/workflows/**` change. Docs-only and SQL-only changes trigger neither browser gate. The browser gates only run after a merge to `dev`, so the first real browser run of a change happens after the merge. The database schema workflow (`database-schema.yml`) rebuilds an empty Supabase database from the repo migrations and runs the persona tests on PRs and pushes that touch `supabase/**`.
- Production release is manual: workflow "Manual production release", run from `dev` with the exact 40-character dev SHA. It needs `production_hold: false` in `PROJECT_STATE.json` on that SHA. The hold is currently ON and the workflow is disabled in the Actions tab. A release needs its own hold-lift PR, all four gates green on that exact merge commit, a preview-only identical-tree commit for a phone check (never deploy the candidate SHA itself: Vercel's Ignored Build Step is Automatic and skips previously deployed SHAs), the owner at a screen, then a production routing check.
- The `main` ruleset requires four checks that can't report on PRs to `main`. The owner has a temporary "pull requests only" bypass (admin). Use it only on a PR that has been checked.
- Last release: `538312c` live (2 Oct 2026). Rollback tag `prod-2026-10-02` points at the previous production `94803ab`. Baseline tag `task4-baseline-2026-10-01`.

## Current task: membership status rules (Task 6)
Owner decisions:
- The NEWEST membership row (by created_at, then id) for the SELECTED gym governs, whatever its status. Never filter by status before choosing the row. Never fall back to another gym. `ends_on` before today counts as expired. No row counts as pending.
- Active = everything. Paused = can sign in and see account, membership page and plans, workouts, PBs, Member Coach (own workouts/assignments/preferences read-only); banner "membership is paused"; no classes, no booking, no social, no groups, no writes. Pending (and no membership row) = membership page and plans only. Cancelled and expired = a message ("Your membership has ended. Contact your gym to renew.") plus sign out only; nothing else.
- Owners, admins, staff and coaches bypass all of it by gym role (role bypass requires `access_status = 'active'`).
- Non-active members cannot cancel an existing booking (the gym does it). Keep.
- The 19 Puffin members with no membership row stay "pending"; they keep the public self-join route for now.

State:
- **Stage 1 (UI only): MERGED and verified on dev** (PR #60, merge `3681852`). `getMembershipAccess` in `gym-context.js`, `member-access-guard.js`, status-aware `member-coach.js`, `add_member_access_guard()` in `scripts/build_site.py`. All four gates green after one Auth re-run for a password-policy flake (fixed by #62). The owner tried the paused and cancelled Puffin test accounts by hand on dev and they passed. The pending case has NOT been tried in a browser.
- **Stage 2a (database enforcement): MERGED to dev as PR #63 (merge `e606475`), repo only, NOT applied to the live project.** Migration `supabase/migrations/20261005120000_membership_status_enforcement.sql` (status-aware helpers, 28 policies replacing 15 on 16 tables, booking and training-group RPCs gated, `join_public_gym_with_membership` now for new members only, every status can read its own `gyms` row), rollback `supabase/rollback/20261005_restore_pre_membership_status.sql`, verification query and policy before/after in `supabase/verification/`, 662-check persona test and a CI function audit in `supabase/tests/`. Tested locally on a Postgres 16 stand-in (no Docker); the CI run is the first on the Supabase stack, so confirm the "HybridOne database schema rebuild" result in Actions if it is not already recorded.
- **Stage 2b (apply to live): NOT started.** Plan: ChatGPT does a READ-ONLY diff of the repo definitions against the live catalog (every function and policy the migration replaces; confirm every `drop policy` name exists live; list any live policy on the 16 tables the migration does not mention); the owner approves the exact SQL; apply as ONE transaction (`psql -1` or equivalent) with the rollback file ready; run the read-only verification query; then a fresh Auth journey run on the exact `dev` SHA and a by-hand check with the paused and cancelled Puffin accounts and the owner's Hybrid Hub login. Effect on real data: Hybrid Hub has 24 members, all active, and the demo account is an owner, so no change expected; Puffin's 19 no-row members become pending.
- **Stage 2c (calendar-feed Edge Function status check): NOT started.** It uses the service-role key and bypasses RLS, so it must re-check the member's governing status. A separate live deploy needing the owner's approval and a rollback (redeploy the current source).
- **Stage 3 (browser tests with disposable per-run Puffin personas, plus a "Member Coach card renders" assertion): NOT started.** Needs a change to the `hybridone-auth-journey-setup` Edge Function (a live change needing approval and a rollback). Never rotate the real test accounts' passwords.
- Known gaps: `member-experience.js` home tiles are not status-aware; `group-join.html` has no UI guard (the database now blocks it); a paused member's "Edit goal" will fail to save once Stage 2b is applied (cosmetic); the guard and Member Coach duplicate one resolver request for ordinary members.
- Smoke-test constraints to respect: locked rendering assets (`app-consistency.css`, `admin-*.css`, `admin-embed.js`, `admin-frame.js`, `app-stability.js`, `shared-admin-nav.js`) must not change; member.html must still contain `const membershipShort=$('membershipShort');if(membershipShort)membershipShort.textContent=` and `.eq('gym_id',selectedGymId)`; member-coach.js must still contain `memberWeekPlan`, `member_class_schedule`, `workout_sessions`, `hybrid_member_weekly_goal`, `NEXT 7 DAYS`; no uppercase brand text variant anywhere.

## Data facts from a read-only audit (counts only)
- Hybrid Hub: 24 members, all active, no duplicate rows. Puffin Performance: 1 active, 1 paused, 1 ended-type membership; 19 active members with no membership row; one user has 8 active membership rows in the same gym.
- Two temporary Puffin test accounts exist (paused and cancelled); details are in STATUS.md with placeholders. Keep them until disposable per-run personas replace them. Delete them before go-live. A pending test account does not exist; creating one is a live insert needing the owner's approval of exact SQL.

## Other open items (see STATUS.md)
- GitHub's `ubuntu-latest` runner changes on 19 October 2026 (could affect the test workflows).
- Supabase dashboard shows a grace-period banner until 22 October 2026 for a historic egress overage (17 to 21 Sep, a request storm, fixed and flat since; do not reset `pg_stat_statements`). Log Ingestion usage (109 GB against an "upcoming" 1 GB limit) is unexplained.
- Go-live blockers: the public self-join gives any signed-in user a free active membership (manual test payment) and must be replaced by real payment; leaked-password protection (off, paid feature); make the repo private (needs a paid plan for Pages); all-history secret scan; remove test accounts and test helper functions; enable and verify member email confirmation.
- Browser test for the /hybrid-hub and /puffin-performance redirect pages; white menu button overlapping "Community" in the member drawer; replace the temporary ruleset bypass; delete old preview and docs branches.
- Football PA Core is a separate project handled in its own chat (its hourly auto-promotion workflow should be disabled).
