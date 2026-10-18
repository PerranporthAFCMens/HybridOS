# Cut-over: switch people to the new sign-in screens (2026-10-18)

Gym touched: none directly (Puffin Performance is the test gym). No database change.

What changes on the live site (www.hybridone.co.uk) when this is merged to main:
1. Signed-out people in the app, and "Sign out" / "Switch gym" buttons, go to `/sign-in` and `/choose-gym` instead of login.html / choose-gym.html.
2. Vercel redirects (temporary, 302) send the old addresses to the new screens, keeping the query and the `#` part (so emailed links still work): `/login`, `/login.html` -> `/sign-in`; `/choose-gym.html` -> `/choose-gym`; `/auth-return.html` -> `/auth-return`; `/admin-invite.html` -> `/invite`; `/sign-out.html` -> `/sign-out`; `/index.html?access_invite=...` -> `/invite`.
3. The "copy invite link" button on the Owners page now makes `/invite?token=...`.

No Supabase change is needed: emails still point at auth-return.html, which Supabase already allows, and Vercel forwards it. The dev preview (GitHub Pages) has no redirects, so the old pages still open there.

Not changed: the gym-branded `/hybrid-hub` and `/puffin-performance` login pages, and the old pages themselves (archived later, one group at a time, after Adam accepts each).

Undo: revert this PR (or remove the `redirects` block in vercel.json).

Passing: `npm run check`, browser checks, smoke test. Failing would show as a redirect missing in the smoke test or a wrong address in the app/owners checks.
