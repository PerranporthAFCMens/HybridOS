# Reports: tiles fit properly (9 October 2026)

**Branch `fix-report-tiles`. New `/next/` app only (CSS and one class name); no database changes. Status: on a branch (PR open).**

Owner report: on a wide screen the Reports overview tiles "don't fit properly" and the second card left a large empty gap. Fixes:
- The eight figure tiles now use the whole row (8 across on very wide screens, 4 on normal desktop screens in two even rows, 2 on a phone) instead of leaving empty space at the end of the row.
- Every tile is the same height and the figure always sits on the bottom line, however many lines the label wraps to (before, "Active memberships" wrapped and pushed its figure down, so the figures were at different heights).
- "What is busiest?" and "Membership mix" are now the same height, so there is no blank block under the shorter one.

Checked: type check, lint, all browser checks (including the layout audit at 320, 390 and 1280px), and screenshots at 1900px and 1280px.
