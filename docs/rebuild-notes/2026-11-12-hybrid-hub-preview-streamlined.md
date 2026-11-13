# Hybrid Hub preview: streamlined

**Date:** 12 November 2026
**Gym touched:** none (static pages, no Supabase, no app code)

## What

Adam found the seven-page preview too busy, so it has been cut back to four calm pages on a light background with much less on each one:

| Page | File | Holds |
| --- | --- | --- |
| Home | `index.html` | Photo hero, three ways to train, two headline prices |
| Train | `train.html` | Live timetable, classes, START, recovery |
| Memberships | `memberships.html` | One simple price list |
| Visit | `visit.html` | Address, times, map, co-owners |

Removed: section labels, badges, numbered cards, repeated join banners, the floating mobile action bar and the floating edit button. "Edit site" now sits in the top notice line, and "Highlight text to check" is in the footer.

`classes.html`, `start.html`, `recovery.html` and `about.html` are now one-line redirects to the matching new page, so links already shared still work.

## Checks

- `python3 scripts/build_site.py`, `smoke_test.py`, `ui_consistency_check.py` and `project_control_check.py`: all passed.
- Playwright on all 4 pages at 1440px and 390px: no script errors, no missing local files and no horizontal scroll. Menu navigation works, and edits stay on their own page.

## Rollback

Revert this commit to go back to the seven-page version.
