# Cut-over: Admin/Owner invitation screen (2026-10-18)

Gym touched: none directly (the invited gym comes from the invitation; Puffin Performance is the test gym). No database change; uses the existing `get_access_invite` and `claim_access_invite` functions.

New app screen `/invite?token=...` replaces admin-invite.html: create account or sign in as the invited email, accept, optional "set a password" after a first-time invite, a clear message when the signed-in account is the wrong one or the invitation is revoked/expired.

Not changed yet: invitation links people receive still go through index.html to admin-invite.html, and the confirmation email after "Create account" still returns to admin-invite.html (keeps Supabase's redirect allow-list safe). The CI jobs that test admin-invite.html are untouched until the old page is archived.

Passing: `npm run check` and `browser/invite.mjs` (invitation shows, revoked, no token, wrong account, accepted).
