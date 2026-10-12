# Class blocks (12 October 2026)

**Blocks.** A block is a named run of weeks, like "Hybrid Uppers, 6 weeks from 12 October". The owner or an admin makes it
(Classes, Blocks), then ticks which classes are in it: one class, or several a week (the owner wanted both to be possible).
Each class keeps its **own workout**; the workout varies from session to session. The week of a class ("week 3 of 6") is worked
out from its date and never stored. A class can be in one block, only inside the block's weeks and its own gym (the database
checks this). Members see a block's label and week on their class workouts, grouped under the block with how many they have
recorded.

**What was taken out.** A first version also had a leaderboard per class workout (a score on one exercise, with an opt-out). The
owner said the leaderboard is for **exercises** (the big lifts where personal bests are recorded), not for class workouts, so it
was removed before it was ever run on the live database.

**Found and fixed on the way.** The database only accepts five exercise types (strength, time, distance, calories, custom), but
the member app also sent "reps" and "intervals", so recording a reps-only exercise (like push-ups) would have been refused. It now
saves a reps exercise as strength with no weight, and rounds as custom.

**Database (owner runs the SQL).** `20261012190000_class_blocks.sql` (after the class workouts one): two tables and one trigger.
Undo: `supabase/rollback/20261012_drop_class_blocks.sql`. Checks: the matching verification file and
`supabase/tests/class_blocks.sql` (20 checks). CI counts are now tables 76, functions 127, policies 193, triggers 35.

**Next (see the WodBoard notes the owner supplied).** Percentage targets worked out from each member's best on a movement; a
movement library with a "record personal bests" tick; a leaderboard per such movement.
