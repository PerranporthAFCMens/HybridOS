# Class workouts (12 October 2026)

**What it does.** The coach of a class puts a workout on that day's class (one specific class, including ones in the
future), then makes it available. People in that class can open it in their app, record their own weights, reps and
times, and keep them. Those results are ordinary workout entries, so they feed the same "last time" and personal bests
as everything else; that is the benchmark. There is no leaderboard and no coach review: it is the member's own record.

**Who can do what.**
- Set it up and make it available: owners and admins, and the staff assigned to that class (a class can only be
  changed by people who run it).
- Read it: those people, and members who are **booked into** or **marked attended at** that class, once the coach has
  made it available, and only while their membership is active. No-shows and people who never booked cannot. Being
  booked is enough because attendance is often marked after the class, and people need it during the class.
- Until the coach makes it available it is a draft; the coach can take it back at any time.

**On screen.**
- Coach: open a class, "Workout for this class": pick one from the library or build a new one right there (the same
  simple builder), "Make available to the class", "Take it back", "Change workout", "Remove".
- Member: "From your classes" on the Workouts tab (classes from the last two weeks), a notice on Today when one is made
  available, and `/m/train/class/<class>`. It uses the same recording screen as a coach's workout: "As set" fills in the
  coach's numbers, a note per exercise, skip or swap. It does not ask the review questions (changed it, why, how hard).

**Database (owner runs the SQL).** New table `class_session_workouts` (a copy of the workout, so changing the library
later never changes a class), `workout_sessions.class_session_id`, a check that a finished workout can only link to a
class the person is in, and one notification trigger. No existing rule is changed. Undo:
`supabase/rollback/20261012_drop_class_workouts.sql`. Checks: `supabase/verification/20261012_class_workouts_check.sql`
and `supabase/tests/class_workouts.sql` (41 checks). CI counts are now tables 74, functions 126, policies 189,
triggers 34.

**Found by the existing tests.** `membership_status_personas.sql` caught that the first version of the read rule did not
check membership status; it does now (active only), with a test for a cancelled member holding an old booking.

**Not done.** A leaderboard or class-wide results; recording against a class that has no booking; showing the workout on
the member's Today class card (it is on Workouts and as a notice for now).
