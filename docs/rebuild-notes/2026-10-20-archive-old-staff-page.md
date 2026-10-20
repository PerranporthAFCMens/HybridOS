# Old staff page archived (20 October 2026)

Adam checked the new staff app (`/s/today`, PR #310) on 20 October 2026 and said it works, so the old staff portal is archived.

**Moved to `archive/`:** `staff.html`, `staff-operations.css`, `staff-operations.js`, `staff-shell.js`. The site build no longer copies them.

**Links that pointed at `staff.html` now point at `/s/today`:** account menu, gym chooser redirect (`gym-context.js`, `index.html`), the old admin frame and shared nav ("Preview as staff"), the "no access" bounce on `classes.html`, `community.html`, `member-view-settings.html` and `staff-permissions.html`, and the member preview's "back to staff" link.

**Build and checks:** `build_site.py` no longer injects the staff shell; the smoke test and UI consistency check no longer list the staff page; the rendering lock for `admin-frame.js` and `shared-admin-nav.js` is updated (one-line link change each); the auth journey screenshot run opens `/s/today`.

No database change. Gym: all gyms (links only).
