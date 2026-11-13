# Hybrid Hub preview: membership plan cards

**Date:** 13 November 2026
**Gym touched:** none (static pages)

Adam liked the side-by-side plan cards from the earlier seven-page version, so the streamlined Memberships page (`preview/hybrid-hub-nqy/memberships.html`) now shows four cards: Full membership (highlighted), Hybrid 2X, START and Gym only & HYROX. Drop-in is a single line underneath. The cards use the calmer light styling in `site.css`. Bullet points and tags written for the concept are marked `data-draft`, and `site.js` now lets edit mode change list items and tags.

Checks: build, smoke test, UI consistency check and project control check all passed. In Playwright at 1440px and 390px there were no script errors and no horizontal scroll, and edit mode found 34 editable items.
