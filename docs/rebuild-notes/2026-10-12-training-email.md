# Emails for the training loop (2026-10-12)

The owner chose email over push (push on an iPhone only works for a web app installed to the home screen, and is fiddly). A client is emailed when a coach sets them workouts, and when a coach replies to a workout they did. The in-app notice (database trigger) is separate and always happens; the email is an extra and may fail on its own.

## How it works
- After the coach sends, the app calls the Edge Function `notify-training` with the new workouts' ids, or the reply's id. The function checks the caller is an active owner, admin, staff or coach of the same gym, that they are the person who set the workouts or wrote the reply, and that it happened in the last 15 minutes (so it cannot be used to send someone an old or someone else's message). One email per call, however many workouts. Resend's idempotency key stops a double send.
- Wording is calm: "There is no deadline. Do them whenever suits you." The coach's note is included. Names, titles and notes are escaped. The from address is the gym's verified sender when it has one, otherwise `noreply@hybridone.co.uk`, with the gym's reply-to.
- The coach sees one sentence after sending: "…has been emailed too", or "The email did not go (reason), but they will see it in the app." A failed email never undoes the assignment or the reply.
- The link in the email goes to `https://www.hybridone.co.uk/m/train` (or `/m/train/done/<id>` for a reply). It can be changed with a function secret `APP_URL`. **Until the new member app is on the live site those addresses do not exist yet**, so set `APP_URL` to the dev site while testing, or release first.

## To switch it on (owner)
1. Run `supabase/migrations/20261012160000_training_notify_service_access.sql` (and its check). It lets the function read what it needs; it writes nothing. This project removes the service role's table access on purpose, so without it every call fails with "permission denied".
2. Deploy `supabase/functions/notify-training/index.ts` (paste into the dashboard function editor as `notify-training`, or deploy with the CLI). It uses the existing `RESEND_API_KEY`.
3. Merge the app change (any time; before step 2 the coach just sees "The email did not go").

## Checks
`web/tests/trainingemail.test.ts` (wording, plural, note, escaping, one-line subject), the Workout builder and client file browser checks (the email is asked for with exactly the right ids, one request for a whole set, a failure is reported and never undoes the send), and the database CI step for the grants (verification, rollback, re-apply).
