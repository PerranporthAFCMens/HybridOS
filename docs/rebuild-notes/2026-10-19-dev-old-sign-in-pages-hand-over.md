# Dev preview: old sign-in addresses open the new screens

Gym touched: none. No database change. Applies to the dev preview only (GitHub Pages); live already redirects these addresses in `vercel.json`.

- Before: on the dev site, `login.html`, `hybrid-hub-login.html`, `puffin-performance-login.html` and the real `.html` names of `choose-gym`, `auth-return`, `admin-invite` and `sign-out` still opened the old screens.
- After: each hands over to its new screen (`sign-in`, `choose-gym`, `auth-return`, `invite`, `sign-out`), keeping the query and `#` part. The two gym links add their `gym_id` to `sign-in`.
- How: new `hand_old_sign_in_pages_to_app()` in `scripts/build_site.py`, applied to the built copy only. Source files are untouched, so the old pages remain in the repo for now.
- Not done: moving the old files to an archive folder and rewriting the old-contract smoke tests and browser workflows. Do that after the dev site is accepted.
- Undo: revert this PR.

## Also fixed here: date-dependent builder browser check

- The builder check expected the paper report to list "Sep 2026|Oct 2026". The mock payments run from today back 24 days, so that only held when the last 24 days crossed from September into October. The "+6 days" run (25 October) failed on every PR.
- `web/browser/builder.mjs` now works out the expected months from the mock payments themselves. Checked: original fails at +6 days; fixed passes at +0 and +6.
