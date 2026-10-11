# Privacy policy and data-deletion pages (2026-10-11)

Two plain static pages, `privacy.html` and `data-deletion.html`, at `/privacy` and `/data-deletion`, linked from two small links in the landing page footer. Facebook and Google sign-in setup (and later app stores) need public addresses for both.

- They replace the first version, which was built inside the new app (PR 221, 223). That version is removed: the app routes, the `web/src/legal` files and the footer links in the join page, staff app and member app.
- Static pages work without the app or scripts, so they can be released to the live site on their own.
- `vercel.json` rewrites `/privacy` and `/data-deletion` to the static files. `web/browser/legal.mjs` checks both pages and the two landing-page links.
- The wording is a plain-English draft describing what the system stores today. It is not legal advice; have it reviewed before relying on it.
- Roll back by reverting the PR.
