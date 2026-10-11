# Sign up with Facebook (2026-10-11)

"Continue with Facebook" on the account step of the sign-up link (`/join/<gym>`).

- It calls Supabase `signInWithOAuth` for Facebook and asks to come back to the same sign-up link. A signed-in person already skips the account step, so the rest of the journey is unchanged.
- The database trigger that makes a profile for every new account already reads `full_name` and `avatar_url`/`picture`, so the profile gets Facebook's name and photo with no database change.
- The About-you step fills first and last name from Facebook (given/family name, else the full name split), but never over something the person typed.
- Date of birth is NOT filled in. Facebook only releases it with the `user_birthday` permission, which needs Meta app review, and the sign-in service does not pass it on by default. The join flow still asks for it (it decides under-18 handling).
- The photo is not copied into our storage. Facebook picture links expire; copying one needs the person's consent and its own step.
- Facebook must have the app set to Live in Meta's dashboard, and the sign-up links must be in Supabase's allowed redirect URLs (the same addresses the confirmation email uses).
- Files: `web/src/data/join.ts`, `web/src/join/Join.tsx`, `web/src/join/join.css`, `web/browser/join-facebook.mjs`, `web/package.json`.
- Roll back by reverting the PR.
