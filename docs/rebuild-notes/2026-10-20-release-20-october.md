# Release prepared: 20 October 2026

Gym touched: none (release record only). No database change: all SQL for this release is already live.

Only the release record changes: `release_gate` in `PROJECT_STATE.json` goes to hold off for this release, and one comment line in each of the two workflows whose checks must start from the release commit's own push (auth-journey and protected-routing).

Before running the release: nothing else may merge into dev. The four checks (smoke, dev runtime, auth journey, protected routing) must be green on the exact commit. After it: verify Vercel deployed the exact SHA, run the production routing workflow, then restore the hold in its own small PR.
