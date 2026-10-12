# Class blocks and the leaderboard (12 October 2026)

**Blocks.** A block is a named run of weeks, like "Hybrid Uppers, 6 weeks from 12 October". The owner or an admin makes it
(Classes, Blocks), then ticks which classes are in it: one class, or several a week (the owner wanted both to be possible).
Each class keeps its **own workout**; the workout varies from session to session. The week of a class ("week 3 of 6") is worked
out from its date and never stored. A class can be in one block, only inside the block's weeks and its own gym (the database
checks this). Members see a block's label and week on their class workouts, grouped under the block with how many they have
recorded.

**Leaderboard.** The coach picks **one exercise as the score** for a class workout (most weight, most reps, furthest, most
calories, or fastest time), on the class's workout section. People in the class see a ranked list (ties share a place, names
shortened like "Priya N."), on the class workout screen and after they have recorded it.
- **Shown unless the member opts out** (the owner's decision). Two ways out: a switch in Me ("Show my scores to others in my
  classes"), and a box when saving a workout ("Show my most reps on the leaderboard"). Your own row is always shown to you.
- Who sees it: people in that class (booked or attended, active membership), and the people who run it (owner, admin, staff
  assigned to that class). Members cannot read each other's workouts directly, so this is one narrow function
  (`get_class_leaderboard`) that returns only names, ranks and the one score, and leaves out anyone who opted out.
- Privacy wording: because scores are shared by default, the gym's terms or privacy notice should say that scores can be seen by
  others in the class and that members can turn it off.

**Found and fixed on the way.** The database only accepts five exercise types (strength, time, distance, calories, custom),
but the member app also sent "reps" and "intervals", so recording a reps-only exercise (like push-ups) would have been refused.
It now saves a reps exercise as strength with no weight, and rounds as custom.

**Database (owner runs the SQL).** `20261012190000_class_blocks_and_leaderboard.sql` (after the class workouts one): three new
tables, score columns on class workouts, `workout_sessions.share_score`, one trigger and one function. Undo:
`supabase/rollback/20261012_drop_class_blocks_and_leaderboard.sql`. Checks: the matching verification file and
`supabase/tests/class_blocks_and_leaderboard.sql` (44 checks). CI counts are now tables 77, functions 128, policies 194,
triggers 35. Two reviewed lists were extended on purpose: the plain-member function guard (`get_class_leaderboard`) and the
"policies on the member's own row" list (`member_score_settings`).

**Not done.** Doing a class workout in your own time without being in the class (a plan setting), percentages of a one-rep max,
and the reminder before class.
