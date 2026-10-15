# Members land in the new member app, plus Strava (15 October 2026)

All gyms; no database changes. Gym comes from the shared gym context as before.

- `member.html` now forwards real members to the new member app (`/m/today`, or the matching tab for `#membership`, `#classes`, `#workouts`, `#pbs`, `#profile`). `?view=member` / `?preview=...` (staff and owners previewing) still open the old page. `?classic=1` opts one browser back to the old page, `?classic=0` clears it. Same pattern as the admin switch.
- `homeFor` (new app sign-in landing) sends members to `/m/today`; staff and coaches still go to `staff.html`.
- New screen `/m/strava` (from Me): connection status, Connect, Sync now, last ten activities. Same tables and Edge Functions (`strava-connect`, `strava-sync`) as `integrations.html`. The Strava keys are not in Supabase yet, so Connect shows "not switched on for this gym yet" until they are.
- The old `integrations.html` is not archived yet (waiting for sign-off).
- Not changed: `join.html`, `onboarding.html` (join already has a rebuilt version), `member-memberships.html`, `member-preview.html`.
