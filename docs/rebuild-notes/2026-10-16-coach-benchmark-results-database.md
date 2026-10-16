# Coach benchmark results: database

Gym: any gym (the switch is per gym). Adam runs the SQL in the Supabase SQL editor; merging does not apply it.

## What it adds
- `gym_benchmark_settings`: one row per gym, `coaches_see_results`, **off by default**. Only an owner or admin can change it; any gym member can read it (so the member screen can say when coaches can see results).
- `get_block_benchmark_results(block)`: returns the exercises booked members recorded inside the test weeks of the block's benchmarks, one row per set. Returns nothing unless the switch is on and the caller is an owner, admin, staff or coach of that gym. Members are people with a booking (not cancelled) on a class in the block.

Members still cannot read each other's workouts directly. The app will work out start, end and change from these rows with the same rules members see.

## Checks
19 persona checks (`supabase/tests/coach_benchmark_results.sql`), 5 verification rows, rollback and re-apply give identical catalogs. CI counts now 95 tables, 168 functions, 228 policies, 42 triggers.

## Next
The screen: the on/off switch for owners and admins and the coach view in the block.
