# Each gym gets its own sign-in page

Gyms touched: Hybrid Hub and Puffin Performance (addresses only; no data changes).

## What changed
- `/hybrid-hub` and `/puffin-performance` are real sign-in pages. The address stays as typed and the page shows that gym's name and logo. Before, both forwarded to the shared `/sign-in?gym_id=...` page.
- `/hybrid-hub-login.html` and `/puffin-performance-login.html` (old addresses) now send people to the new gym addresses.
- Adding a gym page later is one line in `web/src/auth/gymPages.ts` plus its name in the `vercel.json` screen list.
- After sign-in the person is never returned to a gym sign-in page (same rule as `/sign-in`).
- Dev preview (GitHub Pages) works through the 404 fallback; the old "login" hand-over pages point at the new addresses.
- The live-site routing check now expects the final address `/hybrid-hub` or `/puffin-performance` with the app page.

## Database
No change. Uses the existing public gym brand lookup.

## Rollback
Revert this PR. `/hybrid-hub` and `/puffin-performance` go back to forwarding to `/sign-in` for that gym. Nothing goes live until the next release.

## Checks
`npm run check` in `web/` (typecheck, lint, 850 tests, build) and the new browser check `gym-sign-in` (phone and desktop) pass.
