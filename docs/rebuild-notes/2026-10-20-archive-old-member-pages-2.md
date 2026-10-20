# Archive old member pages, part 2: member preview (20 October 2026)

All gyms; no database changes. Adam approved on 20 October 2026.

- Moved `member-preview.html` and its two preview-only scripts (`member-preview-classes.js`, `member-preview-controls.js`) to `archive/`. The site build no longer generates the preview page from `member.html`.
- The three places that still linked to it ("View member side" on Door access, "Member preview" on the old dashboard, "Member view" on the old Staff and working hours page) now open `m/today`.
- Removed the preview from the smoke and UI-consistency checks.
- Still in place: `member.html` (Social and Training groups pages still use it) and `join.html` (sign-in page and sign-up emails link to it).
