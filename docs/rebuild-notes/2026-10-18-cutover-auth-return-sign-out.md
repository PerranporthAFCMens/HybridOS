# Cut-over: email-link landing and sign-out screens (2026-10-18)

Gym touched: none directly (screens only; Puffin Performance is the test gym).

New app screens, no database change:
- `/auth-return` replaces the old auth-return.html: reset-password form (8+ characters, must match), "secure link verified" with Continue, and a clear message when the link is no longer active.
- `/sign-out` replaces sign-out.html: ends the session, forgets the selected gym, shows sign-in.

Not changed yet: emails still open the old `auth-return.html`. Supabase's redirect allow-list must include any new address before email links move. Nothing in production routing changes here beyond the new addresses being handed to the app.

Passing: `npm run check` and the new `browser/authreturn.mjs` (dead link, reset form, magic link Continue, sign-out). Failing would show as a missing heading/message or the wrong page after Continue or sign-out.
