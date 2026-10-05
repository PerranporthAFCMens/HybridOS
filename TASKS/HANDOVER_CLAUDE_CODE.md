# HybridOne handover (read this first)

Repo: PerranporthAFCMens/HybridOS (public). Read `STATUS.md` and `AI_WORKING_RULES.md` in the repo root first. They are the project record. This file adds the working agreements and the state of the current task.

## Who the owner is and how to work with them
- The owner is a non-developer building this with AI help. Use plain English. Explain what each step does and what a pass or fail looks like.
- One action at a time. Put anything the owner must do or wait for FIRST in a list, never in a closing line.
- Do not schedule the owner's steps onto days or dates.
- When they say "stop" or ask a question, stop and answer before doing more.
- Minimise handling: the owner talks to the builder tool directly and should not have to relay messages between tools.

## Who does what
- Builder (Claude Code): writes code, runs the build and smoke test, opens the PR to `dev`, updates `STATUS.md`.
- Reviewer (Claude in chat): reviews each PR once from its number, reading GitHub directly, and says merge or do not merge with reasons.
- ChatGPT: only for Actions run results after a merge and for Supabase or Vercel connector work. SQL is written for the owner to approve.
- Owner: merges everything and approves anything touching `main`, rulesets, Vercel settings or the live Supabase project.

## Hard rules (the owner approved these; they have prevented real incidents)
1. You open PRs to `dev`. The owner merges. Never merge.
2. Never change `main`, rulesets, Vercel settings or the LIVE Supabase project without the owner approving the exact text (the exact SQL, command or setting). Workflow files: a task-related change may be committed to the PR branch without prior approval and is reviewed at the PR (see rule 15 in `AI_WORKING_RULES.md`). That does not cover the release workflow, `permissions`, secrets, OIDC, anything that changes who can deploy, direct pushes to `dev` or `main`, or loosening an assertion.
3. Live Supabase is read-only unless the owner approves exact SQL. Never run `supabase db push`. Never apply the baseline migration. Never mark migration history as applied.
4. Stop at the first problem and report. Do not fix forward. After any live change, a fresh Auth journey run on the exact resulting `dev` SHA must pass, or roll back first.
5. No secrets, tokens, passwords or personal emails in the repo (it is PUBLIC). Use placeholders.
6. Update `STATUS.md` in every PR.
7. Say which gym a change touches. Puffin Performance is the test gym. Hybrid Hub is a demo for the owner's friend, so keep experiments and test accounts off it.
8. Do not weaken a test to make it pass. A test is changed only when the test is wrong, with evidence.
9. Never retry or disguise a write that a tool blocks. Report it.

## How the pipeline works
- `dev` is development. `main` is production (Vercel project `hybrid-one`, domain hybridone.co.uk). The dev test site is GitHub Pages, which ignores `vercel.json`.
- Four gates run on pushes to `dev`: smoke, dev runtime (`verify`), Auth journey (`auth-journeys`), protected routing (`routing`). The two browser gates trigger on any `**.html`, `**.js`, `**.css`, `vercel.json`, `scripts/**`, `PROJECT_STATE.json` or `.github/workflows/**` change. Docs-only changes trigger neither. The browser gates only run after a merge to `dev`, so the first real browser run of a change happens after the merge.
- Production release is manual: workflow "Manual production release", run from `dev` with the exact 40-character dev SHA. It needs `production_hold: false` in `PROJECT_STATE.json` on that SHA. The hold is currently ON and the workflow is disabled in the Actions tab. A release needs its own hold-lift PR, all four gates green on that exact merge commit, a preview-only identical-tree commit for a phone check (never deploy the candidate SHA itself: Vercel's Ignored Build Step is Automatic and skips previously deployed SHAs), the owner at a screen, then a production routing check.
- The `main` ruleset requires four checks that can't report on PRs to `main`. The owner has a temporary "pull requests only" bypass (admin). Use it only on a PR that has been checked.
- Last release: `538312c` live. Rollback tag `prod-2026-10-02` points at the previous production `94803ab`. Baseline tag `task4-baseline-2026-10-01`.

## Current task: membership status rules
Owner decisions:
- The NEWEST membership row (by created_at, then id) for the SELECTED gym governs, whatever its status. Never filter by status before choosing the row. Never fall back to another gym.
- Active = everything. Paused = can sign in and see account, membership page, workouts, PBs, Member Coach; banner "membership is paused"; cannot book. Pending (and no membership row) = membership page and plans only. Cancelled and expired = a message ("Your membership has ended. Contact your gym to renew.") plus sign out only; nothing else.
- Owners, admins, staff and coaches bypass all of it.
- Stage 1 (UI only) is PR #60 on branch `member-access-stage1`. Stage 2 (database enforcement via RLS and RPC changes, plus the calendar-feed Edge Function) and Stage 3 (browser tests with disposable per-run personas) are separate and need the owner's approval of exact SQL and a rollback file. A Stage 2 design exists (replace `private.is_gym_member` and `private.can_write_gym` with status-aware versions plus explicit policy changes, copying exact current definitions from the live catalog for the rollback). Not started.
- Known gaps in Stage 1: `member-experience.js` home tiles are not status-aware; `group-join.html` is not guarded; nothing blocks API reads until Stage 2; no browser test has run yet on a paused, cancelled or pending member.
- Smoke-test constraints to respect: locked rendering assets (`app-consistency.css`, `admin-*.css`, `admin-embed.js`, `admin-frame.js`, `app-stability.js`, `shared-admin-nav.js`) must not change; member.html must still contain `const membershipShort=$('membershipShort');if(membershipShort)membershipShort.textContent=` and `.eq('gym_id',selectedGymId)`; member-coach.js must still contain `memberWeekPlan`, `member_class_schedule`, `workout_sessions`, `hybrid_member_weekly_goal`, `NEXT 7 DAYS`; no uppercase brand text variant anywhere.

## Data facts from a read-only audit
- Hybrid Hub: 24 members, all active, no duplicates. Puffin Performance: 1 active, 1 paused, 1 ended-type membership; 19 active members with no membership row (would become "pending"); one user has 8 active membership rows in the same gym.
- Two temporary Puffin test accounts exist (paused and cancelled); details are in STATUS.md with placeholders. Keep them until disposable per-run personas replace them. Delete them before go-live.

## Other open items (see STATUS.md)
Supabase quota warning banner (restrictions from 22 Oct if over quota; not yet investigated); `ubuntu-latest` runner change on 19 Oct; leaked-password protection (off, paid feature, enable before real customers); make the repo private (needs a paid plan for Pages); browser test for the /hybrid-hub and /puffin-performance redirect pages; white menu button overlapping "Community" in the member drawer; replace the temporary ruleset bypass; Football PA Core is a separate project handled in its own chat (its hourly auto-promotion workflow should be disabled).
