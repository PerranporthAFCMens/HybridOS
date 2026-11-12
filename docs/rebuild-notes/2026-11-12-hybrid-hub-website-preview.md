# Hybrid Hub website concept preview

**Date:** 12 November 2026
**Gym touched:** none (static page, no Supabase, no app code)

## What

A one-page concept for a new Hybrid Hub NQY public website, to show the gym's owners what a replacement for their current Wix site could look like.

- File: `preview/hybrid-hub-nqy/index.html` (single self-contained page, inline CSS and a few lines of JS for the mobile menu).
- Address once deployed: `/preview/hybrid-hub-nqy/` on the dev preview (GitHub Pages) and, after a future release, on hybridone.co.uk.

## Hidden

- Not linked from any HybridOne page, menu or sitemap.
- `<meta name="robots" content="noindex,nofollow,noarchive">` so search engines do not list it.
- A banner across the top says it is a concept preview, not the live site.

## Content and photos

- Copy and prices come from the gym's current public site (hybridhubnqy.co.uk), checked 12 November 2026.
- Photos are loaded from Hybrid Hub's own Wix media library (static.wixstatic.com); none are stored in this public repository.
- The live class timetable is the gym's existing WodBoard embed. Join buttons link to the gym's current WodBoard signup and application pages.
- Details the gym has not published (unit number, opening hours, phone, email, parking, Instagram) are shown as "to confirm" chips.

## Owner edit mode (demo)

- An "Edit site" button (bottom left; bottom right above the action bar on phones) turns on click-to-edit. Opening the page with `?edit=1` starts in edit mode.
- Headings, paragraphs, prices, list items, button labels and footer text become editable. Each photo gets a "Change photo" button that takes an image from the device, shrunk to 1600px.
- Links do not navigate while editing. "Save & finish" leaves edit mode. "Reset" asks first, then puts the original page back.
- Demo only: edits are kept in that browser's localStorage, so nobody else sees them and nothing reaches a server. The edit bar says so.
- The real version (owners edit from a Website screen in HybridOne, saved per gym) is a separate, later piece of work.

## Build and safety

- `scripts/build_site.py` copies the `preview/` folder into `_site` unchanged; its brand and app injections only touch top-level pages.
- No relative asset paths, so it works under both `/HybridOS/` (Pages) and `/` (Vercel) and with `trailingSlash: false`.
- No change to `vercel.json`, routes, login or any existing page.

## Checks

- `python3 scripts/build_site.py`: built.
- `python3 scripts/smoke_test.py _site`: passed.
- `python3 scripts/ui_consistency_check.py _site`: passed (17 surfaces).
- `python3 scripts/project_control_check.py`: passed.
- Browser (Playwright, 1440px and 390px): no script errors, no horizontal scroll, timetable embed and map load.
- Edit mode (Playwright, both sizes): 131 editable items, a text edit and a photo swap survive a reload, links stay put while editing, Reset restores the original.

## Rollback

Delete the `preview/hybrid-hub-nqy/` folder.
