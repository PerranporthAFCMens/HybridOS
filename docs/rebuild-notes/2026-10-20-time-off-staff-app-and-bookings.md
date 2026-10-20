# Staff time off, piece 3 of 3: coaches block their own time, and what is already booked

Gym touched: the selected gym (test on Puffin Performance; keep experiments off Hybrid Hub). Uses the database from piece 1, which is live. No SQL to run.

## What changes for people
- **Staff app, new Time off tab** (`/s/time-off`). A coach or PT blocks out time (whole days or part of a day, with a reason if they like), and takes it off again. It is live straight away with no approval, and a coach can only touch their own blocks (the database rule from piece 1 enforces that).
- If something was already booked in that time, the same screen lists it ("Already booked in your time off") and says nothing has been cancelled.
- **Owner Rota screen, new "Booked during time off" list.** Classes (with how many are booked) and personal training sessions in the next 60 days that fall inside anyone's time off. Each line has **Change coach** (opens the timetable, where the existing edit form checks the rules) and **Cancel**, which asks first. Nothing is cancelled or moved automatically, and nobody is messaged unless the owner cancels.

## Files
`web/src/rota/` (Clashes.tsx new, calc.ts, useRota.ts, Rota.tsx, rota.css), `web/src/data/rota.ts`, `web/src/staffapp/StaffTimeOff.tsx` (new), `StaffShell.tsx` (tab), `web/src/app/App.tsx` (route), `web/browser/audit.mjs` (two staff states), `web/tests/rota.test.ts`.

## How it was checked
`npm run check` passes (822 tests, 2 new for the booked-during-time-off list). Layout audit at 320, 390 and 1280px passes (150 checks) including the new staff screens. Not checked: saving as a real coach login against the live database, and a real iPhone.

## Noticed, not changed
- Cancelling a class here uses the same change the timetable makes (marks it cancelled); it does not send members a separate message beyond what the timetable does today.
- Closed days are not in the booked list (only people's time off).
- Repeating blocks are still not built.
- The owner is "told" by this list on the Rota screen; there is no email or push message.
