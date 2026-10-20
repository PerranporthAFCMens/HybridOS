# Membership personas browser check signs in on the new screen

Gym touched: Puffin Performance test members only (disposable, deleted after each run). No database change.

- Before: the check typed into the old `login.html` form. Since the dev site began handing `login.html` over to `/sign-in` (#353), that form no longer exists, so all six personas timed out waiting for `#email` (run 39390998746). The app and member pages were not broken.
- After: the check signs in at `/sign-in` using the same label-based steps as the sign-in journey check, then opens the old `member.html` and `social.html` exactly as before. The status assertions are unchanged.
- Why it still works: the new app and old pages use the same Supabase session on the same address.
- Undo: revert this PR.
