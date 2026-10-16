# Programming library, part 1: movements and levels (database only)

Gym touched: any gym, once the SQL is run (Puffin Performance is the test gym; keep it off Hybrid Hub until tried). Not applied to the live project. Adam approves the exact SQL in `supabase/migrations/20261016150000_movement_library.sql` before it is run in the Supabase SQL editor.

**What it adds:** `movements` (a gym's list of movement names with an optional https video link, a coaching cue and a default way of tracking it) and `movement_levels` (an Rx, Scaled and Foundations prescription per movement, in the same shape the workout builder already saves). Names are unique per gym ignoring case and spaces.

**Who can do what:** gym members read; owners, admins, staff and coaches add and edit; nobody deletes (a movement is switched off instead, so old workouts keep their words). Signed-out people have no access. A level can only be written against a movement of the same gym.

**What does not change:** workouts, class workouts, personal bests and the leaderboard are untouched. Old exercise names keep working. Parts 2 and 3 add the Movements page and picker, then the Player level choice and personal bests by movement.

**The 264 starter names:** not in SQL. Part 2 adds a button that fills the list from the names the workout builder already offers.

Tested on a scratch Postgres built from the repo migrations: 36 persona checks pass (coach, owner, member, another gym's owner and member, a stranger, signed-out); verification 5 rows ok; rollback returns the catalog to the previous counts (91 tables, 217 policies, 39 triggers) and re-applying restores the same catalog. CI expects 93 tables, 166 functions, 224 policies, 41 triggers.

Rollback: `supabase/rollback/20261016_drop_movement_library.sql` (drops both tables).
