# Programming library, part 2: the Movements page and builder picker

Gym touched: any (Puffin Performance is the test gym). Needs part 1 (`20261016150000_movement_library.sql`) run first; without it the page reports an error and the workout builder carries on as before.

**Movements page** (Classes and workouts > Movements, owners, admins and staff): the gym's movement list with search. Add or edit a movement: name, how it is recorded, an optional https video link, a coaching cue, and the wording for Rx, Scaled and Foundations. Switch off and on (nothing is deleted). One button adds the standard movements the workout builder already offered (names the gym does not have yet; existing ones are left alone).

**Workout builder:** the exercise box now offers the gym's movements first, then the standard list. Picking a movement from the gym's list uses its usual way of recording; anything else is guessed from the name as before. Saved workouts are unchanged.

**Not yet:** the member Player does not show levels, video or cue, and personal bests are still kept by exercise name. That is part 3.

Checks: unit tests (rules, standard-name matching, level wording), new browser check `browser/movements.mjs` on phone and desktop, workouts and layout audit checks pass, `npm run check` passes.

Rollback: revert this change. The database part rolls back with `supabase/rollback/20261016_drop_movement_library.sql`.
