# Dev preview: hand the Switch gym address to the new chooser (18 Oct 2026)

Gym touched: none (dev preview and release check only; Puffin Performance is the test gym).

- Problem: on the GitHub Pages dev preview, the extension-less address `/choose-gym` was answered with the old `choose-gym.html`, so "Switch gym" in the new app opened the old chooser. The updated Auth journey check caught it.
- Fix: `scripts/build_site.py` adds `choose-gym` to the pages that hand an extension-less address to the app (same as `invite`, `sign-out`, `auth-return`). Live (Vercel) is unaffected: it redirects `/choose-gym.html` to `/choose-gym`.
- Two comment-only lines in the Auth journey and protected routing workflows so those required checks start from the release commit.
- Noticed, not changed: the old `choose-gym.html` stays until the old pages are archived.
