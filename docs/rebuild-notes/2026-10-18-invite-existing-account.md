# Invite screen: tell people whose email already has an account (18 Oct 2026)

Gym touched: none (invite screen only).

- Problem: on the invite screen, "Create account" for an email that already has an account looked like it worked ("Account created. Confirm your email...") but no email was ever sent. Supabase hides existing addresses on purpose: it returns no error, no session and no identities, and sends nothing. Resend showed no send for the attempt.
- Fix: `signUpForInvite` now returns `signed-in`, `confirm` or `exists`. For `exists` the screen switches to Sign in and says the address already has an account, so no confirmation email was sent.
- Check: `web/browser/invite.mjs` mocks that Supabase answer and expects the message and the Sign in form.
- Not changed: confirmation emails for genuinely new addresses (they still say "Confirm your email, then return to this same invitation link").
