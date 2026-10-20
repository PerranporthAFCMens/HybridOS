# Staff time off, piece 2 of 3: the owner's week calendar

Gym touched: whichever gym the owner or admin has selected (test on Puffin Performance; keep experiments off Hybrid Hub). Needs piece 1 (database), which is live.

## What changes for people
- New screen **Rota and time off** (`/rota`), reached from a button on the Staff screen. Owners and admins only, in the admin shell.
- A week calendar: a row per active team member, a column per day, Monday first. Each day starts from the person's weekly hours. Time off, part-day blocks and gym closed days are laid over them. Search the team, step by week, or jump to a date.
- Tap a day to add time off (blocked out, holiday or leave, sick, other), for whole days or part of a day, with an optional reason. The same pop-up lists what that person already has that day, with a Remove button that asks first.
- A bottom row marks a whole day as gym closed (bank holidays, events) and can reopen it.
- Nothing already booked is cancelled or moved, and the pop-up says so. The warning list of affected classes and the coaches' own screens are piece 3.

## Files
`web/src/rota/` (Rota.tsx, calc.ts, useRota.ts, rota.css), `web/src/data/rota.ts`, `web/src/data/database.types.ts` (two tables added by hand to match the migration; regenerate with the Supabase tool when convenient), `web/src/app/App.tsx` (route), `web/src/shell/legacy.ts` and `web/src/staff/Staff.tsx` (link), `vercel.json` (address rewrite), `web/browser/audit.mjs` (three states), `web/tests/rota.test.ts`.

## How it was checked
`npm run check` (type check, lint, unit tests, build) passes, with 8 new unit tests for weeks, day cells, summer time and saving a block. The layout audit at 320, 390 and 1280px passes (144 checks) including the three new states. Not checked: saving and removing against the live database (the browser check mocks Supabase), and a real iPhone.

## Noticed, not changed
- On a phone the week scrolls sideways inside its own box, so about two days show at once.
- Repeating blocks (for example every Tuesday 14:00 to 15:00) are not built.
- Times are the gym's UK clock, like class times.
