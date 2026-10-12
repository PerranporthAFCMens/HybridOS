# Coach and client training loop (2026-10-12)

Owner direction (12 October): a PT assigns workouts to a client with no days and no deadlines; the client does them in their own time and says what they changed and why; the PT sees everything the client has done on the client's file, with the workouts they set outlined, and replies. Not a teacher and pupil thing: no overdue, no red, gentle wording. The full analysis and mock-ups are in the shared page "PT and Member Workflow".

## What the client sees
- **From your coach**: the assigned workouts wait in their own list on Workouts, undated ("Waiting for you"), with the coach's note. Do them whenever.
- **New from your coach** on Today, and a count badge on the Workouts tab, when a workout arrives or a reply is given. Opening the list or the reply clears it.
- Doing a workout: each exercise has **As set** or **I changed it**; a change, a swap or **Not this time** offers reason chips (too heavy, too tired, pain or discomfort, out of time, no equipment, something else) and a few optional words. Nothing is required. If they say neither, it is recorded as just "logged".
- Their history shows the coach-set workouts outlined with "Set by your coach", and "New feedback" when a reply has not been read. Opening one shows what they recorded and the coach's reply.

## What the coach sees (owners and admins in this step)
- **Assign workouts**: tick several, add a note, send. From the client's file (client fixed) or from the Workout builder (the open workout ticked, any client). The old once and weekly-programme options are gone.
- **Training** on the client's file: what is waiting ("Set 5 days ago", with Take back for ones not started), then every workout they have done, the coach-set ones outlined and tagged, with a line like "1 as set, 1 changed", "Needs your feedback" or "You replied", and a quiet "Pain noted". A filter shows only the ones the coach set.
- Opening one: what was set, what they did, the status and reason per exercise, their effort and note, and the reply box (free text and Send feedback, or one tap Looks good). Their own workouts open without a reply box.
- **Client training** (menu): finished coach workouts nobody has replied to yet, each opening the client's file.

## Database (applied by the owner, tested here)
`supabase/migrations/20261012140000_training_feedback_loop.sql` (undo, check and persona tests alongside; added to the database CI workflow):
- `workout_sessions.assignment_id`: which assigned workout a finished one was done for, with a check that it was set for the same person.
- `workout_assignments.result` (the client's per-exercise report) and `feedback_seen_at`.
- `workout_assignment_feedback`: the coach's replies. Owners, admins, staff and coaches write; the client reads their own.
- Two triggers write an in-app notification when a coach assigns a workout and when a coach replies. `member_notifications.related_assignment_id` says what it is about.
- **Finding:** signed-in members had no permission at all on `member_notifications` (the baseline leaves only REFERENCES, TRIGGER, TRUNCATE), so the app could never have shown one, including the existing social ones. This grants read and "mark as read" (the read time only). That may make the existing social notification badge in the original member app start working.
- CI counts moved: tables 72 to 73, functions 121 to 124, policies 184 to 187, triggers 29 to 32.

## Not in this step
- Email when work is assigned or a reply is sent (separate small piece: an Edge Function the owner deploys, like the signed-copy one).
- A PT area for staff and coach logins, and the gym setting "PTs see all members or only their own clients" (a member becomes a client when they book a PT session with that PT). Both change who can read what in the database, so they are step 2. Today any staff member can still read any member's workouts (existing rule).
- Targets as numbers, "As set" worked out automatically with a 2.5 percent weight tolerance (step 3).
- Parked by decision: dates and a week view, "overdue", "has the client seen it".

## Checks
Unit tests for the report rules and the safe reading of a stored report; browser checks `train.mjs` (client side end to end, with the exact requests), `workouts.mjs` (assign several, no dates), the new `client-training.mjs` (coach side end to end), at phone and desktop width.
