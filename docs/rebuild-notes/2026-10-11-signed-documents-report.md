# Signed documents report (2026-10-11)

A report in Reports › library (group "Membership & growth"): who has signed the terms and waiver, exactly when (UK time), who signed (and as a parent or guardian), which versions, whether the signed copy was made (terms and waiver, terms only, waiver only, none), when it was emailed, and any email problem. Newest first, respects the chosen period, downloads like every other report.

- The picture of the signature is not loaded for reports.
- No database change. Files: `web/src/data/reportLibrary.ts`, `web/src/reports/library.ts`, `web/tests/library.test.ts`, `web/browser/reports-library.mjs`.
- 29 reports now (the tests and browser check count them).
- Roll back by reverting the PR.
