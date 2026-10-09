# Admin opens the new app; Back links; remove an exercise

- **admin.html opt-in switch.** Open `admin.html?next=1` once in a browser and from then on admin.html sends owners and admins straight to `next/#/today`; `?next=0` turns it off. It is off by default because the Auth journey check signs in and drives the old admin frame (account chip, gym switcher, drawer); making the new app the default needs that check rewritten first (part of the cutover). Old pages still open by name (`?view=gym-layout.html`).
- Every admin page that is not in the sidebar has a **‹ Back** link (goes to the page you came from, or Settings when opened directly).
- Workouts: an exercise a member added themselves has **Remove** (also on a saved one) instead of Skip. Coach-sent exercises can still only be skipped.
- Old pages still reachable only the old way: Channels chat, gym layout, the detailed Reporting page (the report builder replaces it). Nothing in the sidebar needs rebuilding first.
