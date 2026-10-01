# Task 4 — main/dev reconciliation plan

Task 4 is the deliberate reconciliation of `main` and `dev`. Production remains held until this plan is explicitly approved and executed through pull requests.

## Step 0 — neutralise the legacy hourly release before ancestry changes

This step is mandatory and precedes every branch-reconciliation action.

1. Keep `.github/workflows/hourly-production.yml` disabled in the GitHub Actions UI. `main` and `dev` currently have different contents at this same workflow path, so the disabled state also prevents the new manual replacement from running until it is deliberately re-enabled.
2. The reconciliation PR must remove the `schedule` trigger (`cron: '37 * * * *'`) from the workflow version that will land on `main`, leaving only the approved manual release mechanism.
3. Verify the schedule removal is present in the exact reconciliation diff before changing branch ancestry.
4. **Do not merge, rebase, fast-forward, or otherwise make `dev` a descendant of `main`, or make `main` an ancestor of the intended dev release candidate, while the hourly schedule exists on `main`.**
5. Only after the scheduled trigger is removed from the version destined for `main` may later Task 4 reconciliation steps make the branches fast-forwardable.
6. Re-enable the workflow, if desired, only after `main` contains the manual-only version and the absence of any schedule trigger has been verified.

Reason: the legacy `main` workflow performs a direct `git push origin main` after a fast-forward-only merge. The current main ruleset has no pull-request requirement; if the candidate dev SHA already carries the four required green checks, that direct fast-forward could satisfy the ruleset. Divergence has been the accidental safety barrier, not the workflow itself.

## Later Task 4 work

The remaining reconciliation sequence will be planned and approved separately. It must preserve the manual release gate, resolve the main/dev divergence intentionally, ensure all four required checks can report without deadlock, retain rollback capability, and browser-verify the exact production revision before lifting `PRODUCTION_HOLD`.
