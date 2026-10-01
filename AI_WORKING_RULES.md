# AI Working Rules (HybridOne first, Football PA next)

Give this file to whichever AI is working on the repo. These rules apply to every task, every time.

## 1. How to work

1. **One task per branch.** Branch from `dev`, named `fix/...` or `feat/...`. Never push directly to `dev` or `main`.
2. **Open a pull request** for every change. The PR description must list:
   - what you changed and why,
   - every file you touched,
   - anything you noticed but did NOT change.
3. **Small changes.** If a task needs more than roughly 5 files, stop and propose a plan first.
4. **Read before you edit.** Open the actual current file. Do not work from memory of what it "probably" contains.
5. **Do not touch unrelated code**, including formatting, renaming and "quick clean-ups". Log them as suggestions instead.
6. **Never edit protected areas** (listed in the project's change-control file) without an explicit instruction from the owner in the current task.
7. **You open PRs. The owner merges. You never merge.**
8. **Nothing touches `main`, workflows, rulesets or the live Supabase project without the owner's explicit approval of the exact text** (the exact SQL, the exact command, the exact file change). No exceptions for "small" changes.
9. **Stop at the first problem and report.** Do not fix forward. If a check fails after a merge or a live change, roll back first and investigate second.
10. **Update `STATUS.md` in every PR.** At the start of every chat, read `STATUS.md` and this file and summarise where we are before doing anything. Anything not in `STATUS.md` counts as forgotten.
11. **Say which gym a change touches.** Puffin Performance is the test gym. Hybrid Hub is a demo for a friend's gym: keep test accounts and experiments off it.
12. **Plain English.** The owner is not a developer. Explain what each step does and what a pass or fail looks like.

## 2. Definition of done

A change is **not done** until you have shown me:

- the test command you ran and its full output (pass/fail counts, not "looks good"),
- for any UI change, a browser test or screenshot from the running preview,
- confirmation that the existing browser tests still pass.

- after any live Supabase change, a fresh Auth journey run on the exact resulting `dev` SHA (it only runs on a push to `dev`, and only for its watched paths),
- test design: attribute requests to named scripts and avoid hard-coded request counts.

"I've fixed it" without evidence means it is not fixed. If you cannot run something, say so plainly and tell me exactly what I need to check by hand.

## 3. Database rules

- Every schema change (tables, columns, RLS policies, functions, grants) is a **migration file in the repo**. Never suggest changing the database only through the Supabase dashboard.
- Never remove or loosen an RLS policy to make a feature work. Explain the problem and propose a safe alternative.
- No service-role keys in frontend code, ever, and none pasted into chat, SQL or the repo.
- Live Supabase is read-only unless the owner approves the exact SQL. Never run `supabase db push`. Never apply the baseline migration to live. Never mark migration history as applied without explicit approval.
- Every live change is recorded in `STATUS.md` with its rollback.

## 4. Multi-gym / multi-team rules

- The active gym or team always comes from the shared context module (`HybridGymContext` in HybridOne). Never choose one with `.limit(1)`, "first membership found", or a default ID.
- Any change touching gym/team selection must be tested with an account that belongs to **two** gyms/teams with different roles.

## 5. Release rules

- Promotion from `dev` to `main` is a **deliberate, manual step** after all checks pass. No automatic promotion.
- Before each promotion, tag the current production commit (`prod-YYYY-MM-DD`) so rollback is a redeploy of that tag.
- No feature work on the day of a match or a live gym event.
- The old hourly promotion workflow must stay disabled until `main` contains the verified manual-only version (see `TASK4_RECONCILIATION_PLAN.md`).

## 6. Honesty rules

- Tell me when you are unsure, when a test is missing, or when a request conflicts with these rules.
- If you find a bug outside the task, report it. Do not silently fix it.
- If a request would break these rules, say so instead of complying.

---

# HybridOne: tasks (status as of 1 Oct 2026; STATUS.md is authoritative)

**Task 1: Release gate. DONE (PR #21).** Change the hourly promotion workflow so it cannot promote unless the browser and smoke tests pass on the exact commit being promoted. Preferably remove the hourly schedule and make promotion manual. Also set up GitHub branch protection (required status checks) on `main` and `dev`.

**Task 2: Database in the repo. DONE (PR #22, plus security hardening PRs #23 to #31).** Produce the full schema (tables, RLS policies, functions, grants, triggers) from the live Supabase project as migration files. Add a CI step that rebuilds an empty database from those migrations. Report anything that only exists in the live database.

**Task 3: Remove the `.limit(1)` gym lookups. DONE (eight scripts, after the #34 revert and retry).** Originally: remove the six lookups in `session-manager.js`, `scheduling-engine.js`, `class-admin-live-refresh.js`, `class-admin-enhancements.js`, `calendar-views.js` and `staff-operations.js`. Replace them with the shared gym-context helper. Add a browser test with an owner-of-A / member-of-B account that opens classes, scheduling and staff pages and checks the right gym loads each time.

**Task 4: Reconcile `main` and `dev`. NEXT. Step 0 is mandatory: remove the hourly schedule from `main` before the branches can become fast-forwardable.** List every commit only on `main` and decide, one by one, whether `dev` already contains it. Known one to check: the `/index.html` redirect in `vercel.json`. Then tag a baseline.

**Task 5: Planned cut-over** of the new login flow to production, with the old `/hybrid-hub` and `/puffin-performance` URLs kept as redirects.

Do not start any restructuring or redesign (below) until Tasks 1 to 4 are done.

---

# Separate track: restructuring and visual design (report first, no code)

Ask for a **written report only**, reviewed by the owner before any implementation.

## A. Technology options

Compare, for HybridOne's actual size and the owner's ability to maintain it:

1. Keep static HTML + vanilla JS, but consolidate into shared modules (one Supabase client, one gym-context, one layout shell).
2. Move to TypeScript with a build tool (for example Vite), keeping Supabase and the current hosting.
3. Move to a full framework (for example Next.js).

For each option, cover migration effort in realistic working sessions, the risk to existing features, what testing it makes easier, and what stays unchanged. Give a recommendation and a migration order that can ship page by page. Do not propose a big-bang rewrite.

## B. Typography and visual identity

The current look reads as generic and AI-generated. Before proposing anything:

1. Audit every font, size, colour and spacing value currently used, and list the inconsistencies.
2. Propose a small **design-token layer** (fonts, colour, spacing, radius) in one shared CSS file, so a redesign becomes a one-file change instead of touching every page.
3. Suggest 2 or 3 typeface pairings suited to a premium hybrid-training brand, each with a licence check (self-hosted or free-to-embed fonts only) and a note on load performance. Avoid default AI look: system-UI stacks, purple/blue gradients, uniform rounded cards, emoji as icons.
4. Show mock screens for one member page and one admin page in each direction before anything is applied.

Design tokens come first because they make the visual refresh safe to do without changing behaviour.
