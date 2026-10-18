# 2026-10-18: web checks run in parallel (target 2 to 3 minutes)

**Measured before (run 38930290934, 16 Oct):** the `web` job took 9m43s. Setup, type check, lint and unit tests took about 1 minute; the browser checks took 8m18s, one after another. Safari-style (`webkit`) took 10m30s the same way. Locally, one check, the layout audit (`audit.mjs`), is 321s of the roughly 540s total: 3 screen widths x 45 screens, one after another.

**What changed (no test removed, skipped or loosened):**
- `web/browser/run.mjs` now runs the browser checks. `npm run browser` still runs all of them (one after another). `SHARD=2/6` runs only share 2 of 5. Every check lands in exactly one share. The layout audit is split into six jobs (320px, 390px, 1280px, each in two halves) via `AUDIT_SIZES` and `AUDIT_PART`.
- `.github/workflows/web-checks.yml`: type check/lint/unit tests (`static`) and 6 browser shares (`browser`) run side by side. A final job named `web` waits for all of them and only passes if every one passed, so the required check keeps its name. The Safari-style job is split into 6 shares the same way.
- A failing check no longer stops the rest of its share; all failures are listed at the end.

**Adding a browser check:** just add `web/browser/<name>.mjs`. It is picked up automatically (optionally add its run time to `WEIGHT` in `run.mjs` to balance the shares).

**If you add a 7th share:** change `shard: [..]` and `SHARD=.../6` in both the `browser` and `webkit` jobs.
