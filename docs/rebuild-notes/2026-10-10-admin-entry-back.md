# Admin opens the new app; Back links; remove an exercise

- **admin.html** now sends owners and admins straight to `next/#/today` (an early script, no flash of the old frame). Old pages still open when asked for by name (`admin.html?view=gym-layout.html` and so on). Sign-in, "Back to Owner/Admin" and invite links all land in the new app because they go through admin.html.
- Every admin page that is not in the sidebar has a **‹ Back** link (goes to the page you came from, or Settings when opened directly).
- Workouts: an exercise a member added themselves has **Remove** (also on a saved one) instead of Skip. Coach-sent exercises can still only be skipped.
- Old pages still reachable only the old way: Channels chat, gym layout, the detailed Reporting page (the report builder replaces it). Nothing in the sidebar needs rebuilding first.
