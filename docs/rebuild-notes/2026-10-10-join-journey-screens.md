# Sign-up journey screens (new app)

A gym's sign-up link opens the new join journey: account, about you (name, date of birth, mobile), address, emergency contact (name, phone, relationship), parent or guardian (under 18 only), terms and health declaration (only when the gym has written some), choose a plan, welcome.

- Route: `/next/#/join/<gym-slug>` (public, outside the gym login gate). The clean `/join/<slug>` address needs a `vercel.json` rewrite, which is the owner's to merge, so it is the next small PR.
- Everything is validated on the screen (`src/join/calc.ts`, tested) and again by the database function `save_my_join_details`. Answers are kept in the browser tab between steps (never the password) and saved in one call after the last details step.
- Joining refuses unless the database says the details and terms are complete (SQL applied 10 Oct, see `supabase/migrations/20261011090000_member_join_details.sql`).
- Email confirmation: the link in the email returns to `/next/?join=<slug>`, which sends the person back into the journey, signed in.
- The old `join.html` still exists and is now refused at the last step by the database; it goes at the cutover. Nothing sends new members to it until then.
- Not yet: gym settings to write the terms wording (until then no gym has terms, so the terms step is skipped), the staff "missing details" list, the clean URL and a copy-link button.
