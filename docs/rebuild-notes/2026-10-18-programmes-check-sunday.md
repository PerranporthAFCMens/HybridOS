# Programmes browser check: fix two day-of-week assumptions

Test only; no app change, no database, no gym touched.

On a Sunday the check failed twice: the timetable puts Sunday last in the grid, so `.first()` picked Monday's row; and the "1 class matches" wording did not fit the pattern `classes? match`. The check now finds the row for today's weekday (UK time) and accepts either wording.

Checks: `programmes.mjs` passes (42 checks, phone and desktop) on Sunday 18 October 2026.
