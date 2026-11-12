# Hybrid Hub preview: separate pages

**Date:** 12 November 2026
**Gym touched:** none (static pages, no Supabase, no app code)

## What

Adam didn't like the single long scrolling page, so the Hybrid Hub concept preview is now split into seven short pages with a menu between them:

| Page | File |
| --- | --- |
| Home | `preview/hybrid-hub-nqy/index.html` |
| Memberships | `preview/hybrid-hub-nqy/memberships.html` |
| Classes and timetable | `preview/hybrid-hub-nqy/classes.html` |
| START (beginners) | `preview/hybrid-hub-nqy/start.html` |
| Recovery | `preview/hybrid-hub-nqy/recovery.html` |
| About | `preview/hybrid-hub-nqy/about.html` |
| Visit | `preview/hybrid-hub-nqy/visit.html` |

Shared styles and scripts moved into `site.css` and `site.js` in the same folder.

## Copy

- Most of the wording now comes word for word from the gym's current site (hybridhubnqy.co.uk), including the homepage headline "Level up at the Hybrid Hub" and the START, recovery and about text.
- Anything written for the concept carries `data-draft`. The "Highlight text to check" button in the top banner (or `?check=1`) shades it yellow so the owners can review it. Missing facts still show as "to confirm".

## Edit mode

- The demo edit mode is on every page. Edits are saved per page in that browser only (localStorage key `hh-preview-edits-v2:<page>`).

## Paths

- Pages link to each other relatively. A small head script adds a `<base>` with a trailing slash when the folder is opened without one (hybridone.co.uk uses `trailingSlash: false`), so links work on both GitHub Pages and Vercel.

## Checks

- `python3 scripts/build_site.py`, `smoke_test.py`, `ui_consistency_check.py` and `project_control_check.py`: all passed.
- Playwright, all 7 pages at 1440px and 390px: no script errors, no missing local files, no horizontal scroll. Menu navigation works, and an edit on one page doesn't change another.

## Rollback

Revert this commit to go back to the single page.
