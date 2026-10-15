# Preview as member opens the new member app (15 October 2026)

Touches the old admin frame and the new admin; no database changes. Gym: whichever the owner is signed in to (test with Puffin Performance).

- "Preview as member" in the old admin sidebar (`admin-frame.js`, `shared-admin-nav.js`) and the account menu (`account-menu.js`) now goes to `m/today` (the new member app) instead of `member.html?view=member`.
- "View as member" on the new Member view screen goes to `m/today` too.
- Real members still land on the classic app until the member cutover (next PRs).
