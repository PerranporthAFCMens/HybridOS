# Old sign-in pages deleted (step 2)

Gym touched: none (no data or gym settings change).

Deleted: `login.html`, `choose-gym.html`, `auth-return.html`, `sign-out.html`, `admin-invite.html`, `hybrid-hub-login.html`, `puffin-performance-login.html`. The new screens in `web/` replaced them in the 18 Oct release.

- Live (Vercel): the redirects in `vercel.json` for `/login.html`, `/choose-gym.html`, `/auth-return.html`, `/admin-invite.html`, `/sign-out.html` stay, so emailed links and bookmarks still arrive at the new screens (query and token kept).
- Gym shortcuts: `/hybrid-hub` and `/puffin-performance` used to be rewrites to the deleted gym pages. They are now redirects to `/sign-in?gym_id=...` for that gym (the address bar shows `/sign-in`, which it did not before). The `*-login.html` names redirect the same way.
- Dead rewrite `/login` -> `/login.html` removed (the `/login` redirect already won).
- Dev preview (GitHub Pages has no redirects): `scripts/build_site.py` now writes tiny hand-over pages for the old names instead of editing the old files, so dev links and the personas / invite workflows that open `login.html` or `admin-invite.html` still work.
- Checks: `smoke_test.py`, `runtime_pages_check.py`, `project_control_check.py` no longer read the deleted files; smoke now checks the four gym-shortcut redirects.
- Unchanged on purpose: email links that name `auth-return.html` / `admin-invite.html` (web `invite.ts`, `signin.ts`, `notify-staff-welcome`, `index.html`) still resolve through the redirects above.

Rollback: revert this PR.
