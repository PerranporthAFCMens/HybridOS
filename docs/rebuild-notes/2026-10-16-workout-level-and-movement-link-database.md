# Workout level and movement link: database (programming library, part 3 of 3)

Gym touched: none directly (schema only). Test gym for later screens: Puffin Performance.

## What and why
- `workout_sessions.level`: the level (rx, scaled or foundations) a member trained at, saved when they finish a workout in the player.
- `workout_entries.movement_id`: the library movement an exercise was. Empty on old records, which are still matched by name.
- A trigger (`private.check_entry_movement_gym`) refuses a link to another gym's movement.
- Personal bests are unchanged: they are keyed by the lower-cased exercise name, which is exactly `movements.key`, so bests already line up with movements.

## Safety
- No rows are changed or deleted. Existing row rules cover the new columns (members write their own; staff only see their own PT clients' sessions).
- Rollback: `supabase/rollback/20261016_drop_workout_level_and_movement_link.sql` (also removes any saved levels and links).

## Evidence (scratch Postgres)
- Persona tests: 17 checks, 0 failed. Verification query: 4 rows, all ok.
- Rollback restores the catalog snapshot exactly; re-applying gives the same snapshot.
- Counts now 93 tables, 167 functions, 224 policies, 42 triggers (workflow updated).

## Next
The player and PBs code that uses these columns comes in the next pull request, after the SQL is run live.
