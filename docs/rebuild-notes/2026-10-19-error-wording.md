# Error messages no longer start with an internal label (15 October 2026)

**What the owner saw:** on the live join page the payment refusal read "context: Finish your details first: signature on the terms and waiver."

**Cause:** the Edge Functions send a `stage` (where they stopped, for example "context") with every error, and `edgeErrorMessage` put it in front of the reason. It is for diagnosing, not for the person reading the screen.

**Fix:** `web/src/data/edge.ts` shows only the reason. This covers every place that shows an Edge Function error (payment, joining, staff login, owners, terms, signup, the training and welcome emails). The stage is still sent and is still in the function's own logs. Unit test: `web/tests/edge.test.ts`.

**Also in this PR (release preparation, as for earlier releases):** one comment-only line in each of `.github/workflows/auth-journey-browser.yml` and `.github/workflows/protected-routing-browser.yml`, so that the Auth journey and protected routing checks start from this commit's own push. This PR must be the LAST one merged into `dev` before the release.
