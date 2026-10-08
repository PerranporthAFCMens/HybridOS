# Report builder: chart and headline figures (2026-10-10)

- Single-series columns are wider (up to 64px) and show their figure above each column when there are 14 or fewer and room.
- Headline figures now show the change between the last two groups when the report is grouped by a date (for example "▼ 48.2% latest Oct 2026 vs Sep 2026") and a small trend line. Logic in `src/builder/trend.ts` with tests.
- The chart plot has a little more headroom at the top for the labels (affects every column chart).
- Side-panel boxes lose their dashed outlines; filter remove buttons are compact.
