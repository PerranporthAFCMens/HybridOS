# Old pages now point at the new sign-in addresses (step 1 of removing the old sign-in pages)

Gym touched: none. No database change.

Before: the remaining old pages (admin frame, staff, member, home, landing, join, account menu, gym switcher, and several admin pages) sent people to `login.html`, `choose-gym.html` and `sign-out.html`.

After: they send people to `sign-in`, `choose-gym` and `sign-out`, the new screens. The gym hint and return address are passed on exactly as before. On the live site nothing a person sees changes (those old names already redirect); on the dev preview people now reach the new screens directly instead of via the hand-over.

Checks changed to match (not weakened): the old-contract smoke checks and the protected-routing browser check now expect the new addresses, and the routing check expects the new app's page title. The two pinned file fingerprints for `admin-frame.js` and `shared-admin-nav.js` were updated; the only change in those files is the three address strings above.

Still to do (step 2): delete the seven old sign-in files (`login`, `choose-gym`, `auth-return`, `sign-out`, `hybrid-hub-login`, `puffin-performance-login`, and the dev hand-over for them), remove the smoke and runtime checks that read those files, and port the personas and invite-edge workflows that still open `login.html`.

Undo: revert this PR.
