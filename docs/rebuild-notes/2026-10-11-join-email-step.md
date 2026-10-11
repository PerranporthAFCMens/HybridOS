# Sign-up link: the sign-in email is shown with the mobile number (11 October 2026)

Owner request while testing: the email should be on the same step as the mobile number. The "About you" step now shows the email the person signed in with, next to the mobile number. It is read-only (it is their sign-in address); a different address is a change to their account, not to this form. No database change.

Not done here (needs a database function change, so it is a separate approved step): showing the member's email on the member record for owners, admins and staff.

Files: `web/src/join/Join.tsx`, `web/src/data/join.ts`, `web/browser/join.mjs`.
