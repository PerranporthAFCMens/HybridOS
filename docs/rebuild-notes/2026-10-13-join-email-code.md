# Joining: confirm the email with a 6-digit code (13 October 2026)

**What the owner asked for.** The confirmation link in the sign-up email was awkward: it opens in another tab or on another device, can land
on the wrong site, and is hard to test. A short code typed on the sign-up page replaces it.

**What changed.**
- The sign-up page's "Check your email" step now asks for the 6-digit code from the email. Typing it confirms the account and signs the
  person in on the same page, then they carry on to "About you". "Send me a new code" and "Use a different email" are there too.
  A wrong or old code says so in plain words. Spaces and dashes in a pasted code are ignored.
- The confirmation email (`send-auth-email`) now shows the code, large, and its default wording is "Type this code into the sign-up
  page..." (subject: "Your <gym> confirmation code"). The old button stays underneath as "Or confirm with this button", so nobody who
  taps it is stranded. No gym had its own saved wording for this email, so the new default applies everywhere.
- No database change, no new secret.

**To switch on.** The edited `supabase/functions/send-auth-email/index.ts` must be pasted into Supabase again (keep its settings:
Verify JWT off, as it is now). The web page change comes with the next release of the web app.

**Checked.** Unit tests for the code cleaning and check; browser check (phone and desktop): empty and short code refused, wrong code
refused with a plain message, tidy digits sent for the right email and type, a new code can be requested, the right code lands on
"About you" signed in. Email hook smoke check passes.

## Follow-up: the code is 8 digits, not 6 (13 October 2026)

The first real test showed the email carries an **8-digit** code (this Supabase project's "email code length" is 8; Supabase allows 6 to
10). The page only accepted exactly 6, so it would have refused a correct code. The page now accepts 6 to 10 digits, says "Code from the
email", and ignores spaces and dashes. The length is a Supabase setting (Authentication, Providers, Email), so it can be changed there
without touching the page.

**Not changed, noted for later.** The sign-up email still says "HybridOne" instead of the gym's name. The email sender only finds the
gym when the link carries `gym_id`, which the new sign-up page does not send, and the database lookup needs it. Making emails carry the
gym's name needs both the page and a small database change; left alone so the confirmation link's redirect does not change.
