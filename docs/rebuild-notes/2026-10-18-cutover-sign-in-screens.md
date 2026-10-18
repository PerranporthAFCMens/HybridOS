# Cutover step: sign-in and choose-a-gym screens in the new app

Touches: no database, no gym data. Applies to every gym. The old pages (`login.html`, `choose-gym.html`) are NOT changed or removed, and nothing sends people to the new screens yet.

- New addresses `/sign-in` and `/choose-gym` (added to the Vercel rewrites). On the dev site use `.../HybridOS/sign-in/` (trailing slash).
- Sign-in: email and password, "Forgot password?", "Email me a sign-in link", a gym named in the link (`?gym_id=`) with the gym's name and logo, and `?return_to=` that only follows addresses on this site. Wrong password says "Email or password not recognised."
- After sign-in: one gym goes straight to that role's home (owner/admin `/today`, staff/coach `/s/today`, member `/m/today`); several gyms go to the chooser. A gym in the link that the account cannot open says so.
- Choose a gym lists each gym with the role and "Last used"; `?switch=1` lets someone already signed in switch.
- The emails still open the classic `auth-return.html`; that page moves in a later step.
- Next steps: the invite and auth-return pages, then pointing the app's signed-out redirect at `/sign-in`, then retiring the old pages.

Checks: web `npm run check` 798 tests pass; new browser check `signin.mjs` passes at phone and desktop widths.
