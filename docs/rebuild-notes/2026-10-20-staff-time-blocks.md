# Staff time off, piece 1 of 3: database and booking checks

Gym touched: all gyms by design (per-gym rows). Test on Puffin Performance only; Hybrid Hub has no rows until someone adds one.

## What changes for people
- A coach or PT can block out their own time (immediate, no approval) and remove it again. They can only touch their own blocks.
- Owners and admins can add, change and remove anyone's blocks, and mark gym-wide closed days.
- The class scheduler now refuses a class if a selected coach has a block in that time, or the day is closed.
- A PT appointment cannot be booked into a blocked time or closed day (owner and admin included; delete the block first).
- Nothing already booked is cancelled or moved. Members cannot see the new lists.

## Files
- `supabase/migrations/20261020110000_staff_time_blocks.sql` (tables, rules, shared check, PT guard, scheduler change)
- `supabase/rollback/20261020_drop_staff_time_blocks.sql` (puts the scheduler back exactly, drops the lists)
- Ready-to-run SQL for the owner is in the project's `sql-to-run/` folder (PRE_CHECK, RUN, CHECK).

## How it was checked
Run on a scratch Postgres with stand-in tables (not the live database): own block saved; coach blocked from blocking someone else; a second coach cannot see it; PT booking inside a block refused and the next hour accepted; scheduler says blocked for the blocked coach and ok for the free one; rollback restores the scheduler byte for byte (same hash as the baseline file). Not tested against the live database; the PRE_CHECK confirms the live scheduler matches the baseline copy.

## Noticed, not changed
- Closed days are only checked per selected coach, so a class with no coach picked is not blocked by a closed day.
- Repeating blocks, the calendar screen and the "classes affected" list are pieces 2 and 3.
- `web/src/data/database.types.ts` will need regenerating once the SQL has been run (piece 2 uses it).

- `.github/workflows/database-schema.yml`: the expected schema counts go up to match the new migration (tables 99 to 101, functions 178 to 180, policies 229 to 233, triggers 42 to 43), as in the earlier platform foundation change.
