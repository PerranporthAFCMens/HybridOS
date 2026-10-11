# Sign-up link: people who already have an account or a membership (11 October 2026)

Found when the owner tested the join link with an account that was already a member: the plan list appeared, and the database then refused with "you already have a membership". The database was right, but the person should never have been shown that page.

- **Signed in and already a member** (active, paused or pending) of the gym: the join steps and plan list never appear. They see "You are already a member of <gym>", with a button to the member app. Their own membership row is read with the existing rule that lets a person read their own memberships; no database change.
- **An email that already has an account**: the sign-up answers "That email address already has an account. Sign in to carry on." and switches the form to sign-in with the email kept, plus a link to the sign-in page. This tells a visitor that an email address has an account, which is how most sign-up pages behave; the owner asked for it.
- Works whether the service answers a repeat sign-up with an error or (with email confirmation on) with a user that has no identities.

Files: `web/src/join/Join.tsx`, `web/src/join/calc.ts`, `web/src/data/join.ts`, `web/tests/join.test.ts`, `web/browser/join.mjs`.
