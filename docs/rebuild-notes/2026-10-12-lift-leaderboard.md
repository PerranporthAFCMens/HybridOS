# Lifts and leaderboards (12 October 2026)

**What it does.** The gym ticks the big lifts (squat, deadlift, bench...) that get a leaderboard. Members see a ranking of
the heaviest weight recorded for each ticked lift, and choose whether they appear on it.

**Where.**
- Gym side: **Settings → Lifts and leaderboards**. A searchable list of every weight exercise with a tick, a one-tap
  "Tick the usual big lifts" (Back Squat, Front Squat, Deadlift, Bench Press, Overhead Press), and a box to add one by hand.
- Member side: **Workouts → Leaderboards** (only appears once a lift is ticked) and a switch in **Me**.

**The one switch (easy to reverse).** In the same screen: "Members are shown unless they opt out".
- Ticked (what the owner chose): everyone is on the boards until they opt out.
- Unticked: nobody is until they opt in.
- Flipping it changes everyone who has not made a choice of their own, and nobody else. Members who chose keep their choice.
  It is one row in `gym_lift_settings`; no row means "shown unless they opt out".
- To change the default for every future gym too, change `default true` on `gym_lift_settings.show_by_default`, and the
  `true` in `coalesce(..., true)` in `get_lift_leaderboard`, in a new migration.

**Rules.** The ranking is each person's heaviest recorded weight (any reps) from their personal bests, so it matches the
"personal bests" screen. Ties share a place. Names are shortened (Priya N.). Only people with an active membership (or a
staff role) are listed. You always see your own row. Top 50 plus you. The exercise name must match what members log, so
tick each name your members use (the boards are by exact name, ignoring case).

**What is not changed.** Personal bests are still recorded for every exercise a member logs, as before. The tick controls
the leaderboard, not whether a member's own record is kept.

**Database (owner runs the SQL).** Three small tables (`tracked_lifts`, `gym_lift_settings`, `member_lift_choice`) and one
function, `get_lift_leaderboard`. Members cannot read each other's personal bests directly, so the function is the only
way one member sees another's, and it leaves out anyone whose effective choice is "hide". No existing rule is changed.
Undo: `supabase/rollback/20261012_drop_lift_leaderboard.sql`. Checks: `supabase/verification/20261012_lift_leaderboard_check.sql`
and `supabase/tests/lift_leaderboard.sql` (43 checks). CI counts: tables 79, functions 128, policies 198, triggers 35.
Needs the class blocks SQL run first only because of the order of the file names; it does not use blocks.

**Next step (not in this change).** Percentage targets in the workout builder: "80% of your best" shown as kilos from the
member's heaviest recorded lift for that exercise, rounded to the nearest 1 kg, which the member can nudge up or down.
