# Release prepared: 18 October 2026

Only the release record changes: the reason text in PROJECT_STATE.json (the hold was already cleared by the 14 October release and never put back, so `production_hold` stays false) and one comment line in each of the two workflows whose checks must start from the release commit's own push (auth-journey and protected-routing).

Before running the release: the SQL files 3, 4 and 5 in sql-to-run must be run on the live database (Adam), and nothing else may merge into dev. After it: verify Vercel deployed the exact SHA, run the production routing workflow, then restore the hold in its own small PR.
