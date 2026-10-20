# Archive old member pages, part 1 (20 October 2026)

All gyms; no database changes. Adam approved archiving on 20 October 2026.

- Moved `integrations.html`, `member-memberships.html`, `onboarding.html` to `archive/` (new folder, not copied into the built site; see `archive/README.md`).
- Removed them from the build, smoke and UI-consistency lists, the old admin shell page lists and the Auth journey page list; locked hashes of the four edited shared scripts updated (only page names removed from lists).
- "Integrations" links in the classic member pages (`member.html`, `social.html`, `groups.html`, `member-preview.html`) now go to `m/strava`. `index.html` sends an account with no gym to the gym chooser instead of `onboarding.html`.
- Not archived yet (still needed): `member.html` (social and groups pages, the staff preview and the Auth journey and membership persona checks still use it), `member-preview.html` (wired into the build and checks), `join.html` (linked from the sign-in page and sign-up emails).
