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

## Personal bests (step 3)
- Same rules as the classic logger (`src/train/pb.ts`, 9 tests): heaviest weight (else most reps) for strength, most reps, shortest time (longest for holds such as plank), furthest distance, most calories. A first log creates the best; later logs only replace it when better; old times saved in minutes are compared in seconds.
- Finishing a workout records any bests and the Train screen says so ("New personal bests: ..."). If a best cannot be saved the workout is still saved and the screen says so.
- Train has a Personal bests card; "See all" opens the list with add by hand and remove (with a confirm). Time is shown as minutes and seconds.
- Not done: the old page's workout-set link (`workout_set_id`) is not filled in; cardio best times for a set distance (needs distance and time together on one set).

## Personal training page (step 4)
- Train shows a Personal training card for members whose plan includes PT or who have sessions; "See all" opens `#/m/train/pt`: coming up (day, time, length) and past sessions (Done / Missed). Members cannot move or cancel from the app; it says to ask the coach (PT has no clash rules yet, so there is no safe self-service).
- The coach's name and notes are not shown: the coach notes on an appointment may be private, and whether members can read coach profiles has not been checked.
- Still to do: the coach side (plan a PT session, send a programme) and linking a session to its plan. Both need a database change; the exact SQL goes to the owner first.

## The tab is now "Workouts" and everyone has it (step 5)
Owner asked "there is no workout tab?". The tab was called Train and only showed for plans that include the gym or PT (or when a workout had been sent), so an owner previewing (no plan), or a classes-only member, did not see it. It is now called Workouts and every member has it; the first screen still adapts to what the member has.

## Save each exercise, and an exercise list as you type (step 6)
Owner: "no save exercise button once you have added the weight and reps and L/R/both" and "the exercise list isn't there so it doesn't pre-populate as you type".
- Each exercise now has **Save exercise**. It writes that exercise straight away (the workout is created by the first one), works out any personal best, and the card shows Saved with the numbers and a **Change** button (which takes it back out so it can be edited; a best already set is kept). Finish saves anything still unsaved, names the workout, and marks the coach's workout done. A refresh after saving keeps the saved state.
- Names are suggested as you type, in Add an exercise and in Swap: the member's own exercises first, then the same 264-name list the classic app uses. Picking one fills the name and guesses what to record (a plank or hang is timed, runs, rows, skis and bikes are distance, anything else weight and reps).
