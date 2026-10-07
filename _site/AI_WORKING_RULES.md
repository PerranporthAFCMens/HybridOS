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
7. **You open PRs. The owner merges, except the narrow case in rule 16. You never merge anything else.**
8. **Nothing touches `main`, rulesets, Vercel settings or the live Supabase project without the owner's explicit approval of the exact text** (the exact SQL, the exact command, the exact setting). No exceptions for "small" changes. See rule 15 for the one narrow exception for workflow files on a PR branch.
9. **Stop at the first problem and report.** Do not fix forward. If a check fails after a merge or a live change, roll back first and investigate second.
10. **Update `STATUS.md` in every PR.** At the start of every chat, read `STATUS.md` and this file and summarise where we are before doing anything. Anything not in `STATUS.md` counts as forgotten.
11. **Say which gym a change touches.** Puffin Performance is the test gym. Hybrid Hub is a demo for a friend's gym: keep test accounts and experiments off it.
12. **Plain English.** The owner is not a developer. Explain what each step does and what a pass or fail looks like.
13. **The repository is public.** Never put secrets, tokens, passwords, personal emails or user IDs in it. Use placeholders.
14. **Do not weaken a test to make it pass.** Change a test only when the test is wrong, and show the evidence.
15. **Workflow files on a PR branch (owner-approved, 5 Oct 2026).** A workflow change that belongs to the task (for example a browser-test assertion that must change together with the code it checks) may be committed to the task's PR branch without separate prior approval. It only takes effect on `dev` when the owner merges the PR, so the owner's review of the PR diff is the approval. The PR description must list every workflow file changed and show each change. This does NOT cover: the release workflow (`hourly-production.yml`), anything that changes `permissions`, secrets, tokens, OIDC or who can deploy, a change made directly on `dev` or `main`, or loosening any assertion. Those still need the owner's approval of the exact text first.
16. **Builder may merge safe PRs into `dev` (owner-approved, 7 Oct 2026, on trial).** The builder may merge a PR itself only when ALL of these are true:
    - the PR's base is `dev` (never `main`);
    - every check on the PR head is green and the PR has no conflicts;
    - every file the PR changes is inside the allow-list: `web/**` (the new app), `REBUILD_PLAN.md`, `STATUS.md`;
    - the PR does not change a test to make it pass, and does not touch the old pages or shells, locked rendering assets, `.github/**`, `scripts/**`, `vercel.json`, `PROJECT_STATE.json`, `supabase/**`, or any rules or handover file (`AI_WORKING_RULES.md`, `HANDOVER.md`, `TASKS/**`, `PROJECT_CONTROL.md`, `ENVIRONMENT.md`). Those always need the owner.
    Before merging, the builder lists the PR's changed files and checks each against the allow-list. The PR description says it was merged under this rule.
    After merging, the builder reads the checks on the new `dev` commit, including the Auth journey, and tells the owner the result. If anything fails, the builder stops starting new work, reports it, and opens a revert PR; the revert of its own merge may also be merged by the builder. Auto-merge may be used only once the owner has confirmed that "Allow auto-merge" is on and that `dev` requires the checks to pass; until then the builder merges directly.
    Never `main`, production releases, rulesets, Vercel settings or the live Supabase project. Trial: for the first three PRs merged under this rule, the builder tells the owner straight after each merge. If the owner says stop, the rule ends and rule 7 applies in full.

## 2. Definition of done

A change is **not done** until you have shown me:

- the test command you ran and its full output (pass/fail counts, not "looks good"),
- for any UI change, a browser test or screenshot from the running preview,
- confirmation that the existing browser tests still pass.

- after any live Supabase change, a fresh Auth journey run on the exact resulting `dev` SHA (it only runs on a push to `dev`),
- test design: attribute requests to named scripts and avoid hard-coded request counts.

"I've fixed it" without evidence means it is not fixed. If you cannot run something, say so plainly and tell me exactly what I need to check by hand.

## 3. Database rules

- Every schema change (tables, columns, RLS policies, functions, grants) is a **migration file in the repo**. Never suggest changing the database only through the Supabase dashboard.
- Never remove or loosen an RLS policy to make a feature work. Explain the problem and propose a safe alternative.
- No service-role keys in frontend code, ever, and none pasted into chat, SQL or the repo.
- Live Supabase is read-only unless the owner approves the exact SQL. Never run `supabase db push`. Never apply the baseline migration to live. Never mark migration history as applied without explicit approval.
- Applying an approved migration to live: first a read-only diff of the live definitions against the repo, then the owner approves the exact SQL, then apply as ONE transaction with the rollback file ready, then run the read-only verification query and a fresh Auth journey run on the exact `dev` SHA.
- SECURITY DEFINER functions bypass RLS. Any function the member pages can call must gate on a reviewed status or role helper (the CI function audit enforces this).
- Every live change is recorded in `STATUS.md` with its rollback.

## 4. Multi-gym / multi-team rules

- The active gym or team always comes from the shared context module (`HybridGymContext` in HybridOne). Never choose one with `.limit(1)`, "first membership found", or a default ID.
- Membership status is read from the newest membership row for the selected gym only (see `HybridGymContext.getMembershipAccess`), never from another gym and never by filtering statuses before choosing the row.
- Any change touching gym/team selection must be tested with an account that belongs to **two** gyms/teams with different roles.

## 5. Release rules

- Promotion from `dev` to `main` is a **deliberate, manual step** after all checks pass. No automatic promotion.
- Before each promotion, tag the current production commit (`prod-YYYY-MM-DD`) so rollback is a redeploy of that tag.
- Lifting the production hold is its own PR. The merge commit of that PR is the release candidate, and all four gates must pass on that exact commit.
- Never deploy a preview of the exact release-candidate commit (Vercel's Ignored Build Step skips previously deployed commits). Test a new preview-only commit that has an identical tree and prove it changes 0 files.
- After a release, check Vercel deployed the exact SHA, run the production routing check, and check production on a real phone before calling it done. Then put the hold back with a small PR.
- No feature work on the day of a match or a live gym event.
- The release workflow stays disabled in the Actions tab except while a release is being run.

## 6. Honesty rules

- Tell me when you are unsure, when a test is missing, or when a request conflicts with these rules.
- If a tool blocks a write, report the exact message. Do not retry, split, reword or disguise the write to get around it.
- If you find a bug outside the task, report it. Do not silently fix it.
- If a request would break these rules, say so instead of complying.

## 7. Working style with the owner

- One action at a time. Anything the owner must do or wait for goes FIRST in a list, never in a closing line.
- Do not schedule the owner's steps onto days or dates.
- When the owner says stop, or asks a question, stop and answer before doing more.
- Keep handling to a minimum: the owner talks to the builder tool directly and does not relay messages between tools.
- Keep replies short. The owner's usage is limited. Do not ask the owner to paste long reports into another tool: give the PR number and let the reviewer read GitHub directly.

## 8. Who does what (agreed 5 Oct 2026)

- **Builder (Claude Code):** writes code, runs `python3 scripts/build_site.py` and `python3 scripts/smoke_test.py _site`, opens the PR to `dev`, and updates `STATUS.md`. Best for access-control and database code. The owner approves exact text in the builder's own chat.
- **Reviewer (Claude in chat):** reviews each PR once, from the PR number, by reading the diff, files and checks on GitHub. Says merge or do not merge, with reasons. Does not relay or reword the builder's messages, and does not write to the repo unless the owner asks.
- **ChatGPT:** only for what needs its connectors: reading Actions run results after a merge, and Supabase or Vercel work (read-only live catalog diffs, applying owner-approved SQL). It has hit a safety block writing access-control code, so do not give it that.
- **Owner:** merges everything except safe PRs the builder may merge under rule 16, and approves anything touching `main`, rulesets, Vercel settings or the live Supabase project.

---

# HybridOne: tasks (status as of 5 Oct 2026; STATUS.md is authoritative)

**Task 1: Release gate. DONE (PR #21).** Change the hourly promotion workflow so it cannot promote unless the browser and smoke tests pass on the exact commit being promoted. Preferably remove the hourly schedule and make promotion manual. Also set up GitHub branch protection (required status checks) on `main` and `dev`.

**Task 2: Database in the repo. DONE (PR #22, plus security hardening PRs #23 to #31).** Produce the full schema (tables, RLS policies, functions, grants, triggers) from the live Supabase project as migration files. Add a CI step that rebuilds an empty database from those migrations. Report anything that only exists in the live database.

**Task 3: Remove the `.limit(1)` gym lookups. DONE (eight scripts, after the #34 revert and retry).** Originally: remove the six lookups in `session-manager.js`, `scheduling-engine.js`, `class-admin-live-refresh.js`, `class-admin-enhancements.js`, `calendar-views.js` and `staff-operations.js`. Replace them with the shared gym-context helper. Add a browser test with an owner-of-A / member-of-B account that opens classes, scheduling and staff pages and checks the right gym loads each time.

**Task 4: Reconcile `main` and `dev`. DONE (PRs #43 to #48).** The hourly schedule was removed from `main` first, the release workflow was replaced on `main`, and history was reconciled with an ancestry-only merge that left the file tree unchanged.

**Task 5: Cut-over of the new login flow to production. DONE (release `538312c`, 2 Oct 2026).** `/hybrid-hub` and `/puffin-performance` are redirect pages to the universal login, and `/` is the sign-in entry page. Production routing run #5 passed. The hold has been put back.

**Task 6: Membership status rules. IN PROGRESS.** Stage 1 (UI) merged and verified on dev (PR #60). Stage 2a (database enforcement SQL, rollback, verification, persona tests, function audit) merged to `dev` as PR #63 but NOT applied to the live project. Stage 2b (apply to live), Stage 2c (calendar-feed Edge Function) and Stage 3 (browser tests with disposable personas) are open and each needs the owner's approval of exact text. See `TASKS/HANDOVER_CLAUDE_CODE.md`.

Feature work has resumed under the rules above. The restructuring and redesign track below stays report-first until the owner asks for it.

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
