# Cutover step: remove the dropped Gym layout and two test pages

Touches: no gym data, no database. Applies to every gym (old admin frame only).

- Deleted `gym-layout.html` (dropped by the owner on 8 October 2026: a drawing tool that saved nothing), `mobile-band-test-a.html` and `mobile-band-test-b.html` (test pages).
- Removed the "Gym layout" menu entry and every page list that named it (`shared-admin-nav.js`, `admin-frame.js`, `admin-embed.js`, `app-stability.js`, build and check scripts, the auth journey workflow).
- Removed the `layout` link from `web/src/shell/legacy.ts` (nothing used it).
- `back.mjs` now uses `workout-builder.html` as its "another old page" example.
- Updated the rendering baseline hashes in `scripts/smoke_test.py` for the four locked files; the only change in each is the removed Gym layout entry.

Checks: web `npm run check` 794 tests pass; smoke test and UI consistency pass.
