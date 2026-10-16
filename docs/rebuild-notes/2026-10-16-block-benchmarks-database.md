# Block benchmarks: database (benchmarks and progress, part 1 of 3)

Gym touched: schema only. Test gym for later screens: Puffin Performance.

- `block_benchmarks`: one row per block per movement, with the day the start test opens, the day the end test opens, and whether a higher or lower result is better (time: lower; weight, reps, distance: higher).
- Owners and admins set them up; every member of the gym can read them. A benchmark's block and movement must both belong to its own gym (checked in the row rule).
- No results table. A member's result is the workout they record with that movement, picked out by name and date, so nothing is entered twice and earlier workouts already count as history. Members only see their own results.
- Nothing existing changes. Rollback: `supabase/rollback/20261016_drop_block_benchmarks.sql`.
- Evidence (scratch Postgres): 24 persona checks, 0 failed; verification 5 rows ok; rollback restores the catalog snapshot exactly; re-apply gives the same snapshot. Counts now 94 tables, 167 functions, 226 policies, 42 triggers (workflow updated, and the movement library CI step now takes the newer migrations off and on around its rollback).

Next: the screens (coach picks the benchmarks and test dates in Blocks; member sees "Week N of M" and their start and end results), then the coach block view with flags.
