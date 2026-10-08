# Member app, step 2: Train (2026-10-10)

Owner decisions: members can swap or skip exercises in work their coach sent; it is all suggestion, not obligation ("this isn't school").

Built (`src/train/`, `src/data/train.ts`, `/next/#/m/train`, `#/m/train/:id`):
- **Train tab** (shown when the plan includes the gym or PT, or a workout has been sent): Today (workouts due now, Start or Continue), Coming up, Start my own workout, Recent.
- **Today** now puts a due workout on top unless something booked starts within three hours.
- **The workout screen:** every exercise from the coach's copy of the workout (`workout_snapshot`), boxes that fit the exercise (weight and reps, reps, time, distance, calories, or just Done for instructions), "Last time" numbers with a Copy last time button, + Set, Swap (type what you did instead) and Skip (says "That is fine"). Optional how-hard (1 to 10) and notes. Finish saves the session, exercises and sets, and marks the coach's workout done with the member's note plus a list of anything skipped or swapped (so the coach can see). Nothing is required; a half-typed workout is kept on the device if the page is refreshed.
- Starting your own: add exercises by name and what to record.
- Writes use the same tables as the classic logger (`workout_sessions`, `workout_entries`, `workout_sets`, `workout_assignments`), written in order and undone if one step fails.

Not in this step:
- **Left / Right / Both:** needs a new column. SQL written, tested on a scratch Postgres, NOT applied: `supabase/migrations/20261010120000_workout_set_side.sql`, rollback `supabase/rollback/20261010_drop_workout_set_side.sql`, checks `supabase/verification/20261010_workout_set_side_check.sql`. The screen gets the buttons after the owner approves and runs it.
- Personal bests: the classic logger works them out when a set is saved; the new screen does not yet.
- PT sessions linked to a plan, the coach side to plan and push a PT session or programme, notifications.

## Left / Right / Both (added after the owner ran the SQL)
- The `side` column on `workout_sets` is live (owner ran `20261010120000_workout_set_side.sql`; the check showed all "ok").
- Each exercise has a "Left / right" button. Turned on, every set gets Left, Right and Both buttons (tap again to clear). The side is saved with the set, shown in "Last time" and copied by Copy last time. Off by default, so ordinary exercises are unchanged.
