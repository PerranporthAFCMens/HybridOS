# Welcome email for a new team member (14 October 2026)

**Asked by the owner:** when someone is added as staff, they should get an email welcoming them to the team, with the link to the staff app.

**What happens now:** after "Add staff login" creates the login and saves the details, the screen asks the new `notify-staff-welcome` function to send the email. It says "Welcome to the team at <gym>", who added them, and gives the sign-in link (`/login?gym_id=<gym>`; after signing in, staff and coaches land in the staff app). It explains how to sign in: use the temporary password if one was given, otherwise "Email me a sign-in link", and "Forgot password?" to choose their own.
- The email never contains the temporary password. The owner still sees it on screen and passes it on.
- Works for a person who already had a HybridOne login too (no temporary password then).
- If the email cannot be sent, the owner is told and the login still stands ("Tell <name> to sign in at hybridone.co.uk/login").

**The function (deployed to the live project on 14 October 2026, JWT required):** `supabase/functions/notify-staff-welcome/index.ts`, built like `notify-training`. The caller must be an active owner or admin of the gym; the person must be staff or coach there and added in the last 15 minutes; Resend's idempotency key stops a second send the same day. Sender and reply-to follow the gym's own communication settings, else `noreply@hybridone.co.uk`.

**Tests:** wording in `web/tests/staffwelcome.test.ts`; the Staff browser check (`web/browser/staff.mjs`) now covers the call, the success message and the failed-email message.
**Undo:** remove the call in `StaffEditor.tsx`; the function can stay deployed (nothing calls it) or be deleted in the Supabase dashboard. No database change.
**Not changed:** the live function `admin-create-staff-with-level` (it is not in the repository; it creates the login and returns the temporary password).
