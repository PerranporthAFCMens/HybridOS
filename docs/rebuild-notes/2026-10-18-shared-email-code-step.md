# One emailed-code screen for every new account

Gym touched: none (shared sign-up code).

Before: member join asked a new person to type the code from the email, but the Admin/Owner invitation screen still said "confirm your email, then return to this link". The two flows had separate copies of the code step.

After: one component, `web/src/auth/EmailCodeForm.tsx`, is the code step for both member join and the invitation screen. The functions that check and resend a code now live once in `web/src/data/auth.ts` (`confirmWithCode`, `resendCode`), and `QuickJoin` uses them too. A change to the code step now reaches member join and invitations together.

The sign-up email already carries the code for every new account (the email function shows it for the `signup` type), so no email or database change is needed.

Not changed: QuickJoin keeps its own one-box layout (it sends the code on submit and confirms automatically at 8 digits) but shares the same check and resend functions.

Checks: `npm run check` (802 tests), browser checks `invite` and `join` (new invite code test added).
