# Save the level with the workout, and link exercises to movements (programming library, part 3, screens)

Gym touched: whichever gym the member is training in (shared gym context). Test gym: Puffin Performance. Needs the SQL from 20261016160000_workout_level_and_movement_link.sql (already run live).

- When a member finishes a workout that offers levels, the workout stores the level they picked (rx, scaled or foundations). A workout with no level wording stores none, so an old remembered choice is never stamped on an unrelated workout.
- Each saved exercise is linked to its library movement when the gym's list has one with that name. Unknown exercises stay unlinked and are still matched by name.
- Personal bests are unchanged (already keyed by the lower-cased name, which equals the movement key).
- Files: `web/src/data/train.ts`, `web/src/train/Player.tsx`, `web/src/data/database.types.ts`, `web/browser/member-levels.mjs`.
- Evidence: 770 unit tests pass; browser checks member-levels (4 runs, 16/10 checks), member-class-workout, train, train-again, member-leaderboard all pass.
