# Live addresses for the newer screens

Gym touched: none (routing only, no database change, no SQL).

`vercel.json` hands each new-app address to the app so a refresh, bookmark or typed address works on the live site. The list was missing `/programmes`, `/movements`, `/estate`, `/lifts` and `/payments`: they opened by clicking through the menu but would have shown a missing page on a refresh. They are now in the list. The dev preview (GitHub Pages) already answers any unknown address with the app (`scripts/build_site.py`), so it needed no change.

Takes effect on the next release to the live site, which is the owner's call. Rollback: remove the five names from the pattern.
