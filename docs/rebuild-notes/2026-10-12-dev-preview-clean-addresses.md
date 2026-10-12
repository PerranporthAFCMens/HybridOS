# Dev preview: refreshing Classes, Community, Staff, Class setup or Communications (12 October 2026)

**What the owner saw.** On the dev site (GitHub Pages), opening or refreshing "Classes and workouts" on a phone gave a dark blank
screen with only the menu button. Members and the Workout builder were fine.

**Why.** GitHub Pages answers `/classes` with the old file `classes.html` (it adds ".html" itself). Inside the app, tapping the menu
works because the app changes the address without asking the server. A refresh, a bookmark or an old link asks the server, and for
five names that are also old page files the answer is the old page, which is not meant to open on its own. The five are
`classes`, `community`, `staff`, `class-setup` and `communications`. Reproduced here with a copy of Pages' rules: `/classes` and
`/community` returned "Classes · HybridOne" and "Community · HybridOne" (the old pages), `/members` and `/workouts` returned the app.

**The live site is not affected.** Vercel's rewrites in `vercel.json` hand those addresses to the app before it looks for a file.

**The fix (dev preview build only).** `scripts/build_site.py` now adds one line at the top of those five old pages, only when
building the dev preview: if the page was reached by its extension-less address, go to the same address with a trailing slash. A
trailing slash matches no file, so Pages answers with `404.html`, which is the app. The old pages opened by their real name
(`classes.html`, and inside the old admin frame) are untouched. The live build is unchanged (checked: the line is absent).

**Checked.** A copy of Pages' serving rules at phone width: all five addresses now land in the app (`/HybridOS/classes/` shows
"Classes"), `/members` and `/workouts` as before, `/classes.html` still opens the old page. Built-site smoke, UI consistency and
project control checks pass on both the live build and the dev preview build.
