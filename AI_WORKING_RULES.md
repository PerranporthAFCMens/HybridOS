# HybridOne AI working rules

> Reconstructed on 1 October 2026 because the original `AI_WORKING_RULES.md` was not present on `dev`.
> This reconstruction is based on the current `STATUS.md`, the existing project-control documents, and the owner's explicit working rules. Replace it with the original later if the original contains stricter wording.

## 1. Human approval and branch ownership

- The AI may prepare branches and open pull requests.
- The owner merges pull requests. The AI does not merge them.
- Normal pull requests target `dev`.
- Do not change `main`, production workflows, GitHub rulesets, Vercel production behaviour, or live Supabase without the owner's exact approval of the exact proposed change.
- If an approved Task 4 step requires an exceptional PR to `main`, show the exact diff/purpose first and wait for approval before opening or applying it.

## 2. Production safety

- `PRODUCTION_HOLD` remains active until the documented release gate is deliberately cleared.
- Do not blindly merge, rebase, reset, overwrite, or fast-forward `main` and `dev`.
- Keep the legacy `.github/workflows/hourly-production.yml` disabled while the scheduled version still exists on `main`.
- No step may make `dev` a descendant of `main`, or otherwise make the branches fast-forwardable, while the hourly schedule remains on `main`.
- Do not re-enable that workflow until `main` contains the verified manual-only version with no schedule trigger.

## 3. Live changes and rollback-first rule

- Before any live change, state exactly what will change, where it will change, and which gym/environment it affects.
- After any approved live change, run a fresh Auth journey against the exact resulting `dev` SHA.
- If that journey fails, roll back the live change first.
- Do not fix forward after a failed live change.
- If anything looks inconsistent, unexpected, or broader than approved, stop and report before making another change.

## 4. Testing scope

- Puffin Performance is the test gym.
- Hybrid Hub is a demo site for a friend's gym; do not place test accounts or experiments there.
- Always say which gym a proposed or completed change touches.
- Release evidence must be tied to the exact SHA being considered.
- Browser checks must cover desktop and mobile where the affected flow exists on both.
- Multi-gym work must verify selected-gym isolation and role resolution for the selected gym.

## 5. Pull requests and documentation

- Every PR must update `STATUS.md`.
- Keep PRs narrow: one controlled purpose, no unrelated cleanup.
- Explain changes in plain English and one step at a time.
- Do not hide operational changes inside documentation or unrelated feature work.
- Record test evidence, exact SHAs, rollback notes, and remaining risks in the PR and/or `STATUS.md`.

## 6. Task 4 reconciliation

- Task 4 starts with Step 0: neutralise the legacy hourly release before ancestry changes.
- The workflow stays disabled throughout Step 0.
- The scheduled trigger must be removed from the version that lands on `main` before any operation creates fast-forward ancestry between `main` and `dev`.
- Ruleset changes are owner-operated unless the owner explicitly approves otherwise.
- Preserve working production URLs and production-only fixes deliberately; do not copy older production implementations over newer dev equivalents.
- Before each approval, present: the exact diff, what could break, test evidence, rollback point, and what the owner should inspect.

## 7. Stop conditions

Stop and report rather than continuing if:

- a diff contains files outside the approved scope;
- a workflow/ruleset/live-Supabase change appears without exact approval;
- branch ancestry changes earlier than planned;
- a required check does not report or is ambiguous;
- a browser/Auth test fails;
- production URL behaviour changes unexpectedly;
- a rollback point cannot be identified;
- the observed repository state differs materially from the documented plan.
