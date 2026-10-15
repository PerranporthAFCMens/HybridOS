# New admin by default (sign-in cutover)

Before: owners and admins only reached the new admin after opening `admin.html?next=1` once per browser; everyone else landed on the old admin.

After: every sign-in route (login, choose-gym, auth-return, invite) already ends at `admin.html?gym_id=...` for owners/admins, and `admin.html` now forwards to the new app (`/today`) unless the browser opted out with `?next=0`. `?next=1` clears the opt-out. `?view=...` still opens the old pages.

Files: `admin.html` (one inline script). Auth checks are unchanged: the new app still gates on role, members never reach admin functions.
Gym: all gyms (no data change).
