# Coach benchmark results: screens

Gym: any gym; the switch is per gym and off by default. Needs `5-coach-benchmark-results.sql` run first (database part, already merged as #325).

## What it does
- In a block's Benchmarks section, an owner or admin sees a checkbox "Coaches can see members' benchmark results".
- When it is on, the block shows "Member results" for the team: each booked member's start result, end result and change per benchmark. Members who have recorded nothing are not listed.
- Members' own progress card says "You and your coaches can see these." while the switch is on, otherwise "Only you see these."

## How
Reads `gym_benchmark_settings` and `get_block_benchmark_results`; the function itself refuses anyone who is not on the team or when the switch is off. Start, end and change use the same rules as the member card (`progressFor`).

## Files
`web/src/classes/BlockBenchmarks.tsx`, `CoachBenchmarkResults.tsx` (new), `benchmarks.ts`, `web/src/data/benchmarkSettings.ts` (new), `web/src/train/benchmarkProgress.ts`, `MyBenchmarks.tsx`, `web/src/data/database.types.ts`, `web/tests/benchmarkProgress.test.ts`, `web/browser/class-blocks.mjs` (its class checkbox count now ignores the new switch; same expectation of 5 class boxes).

## Noticed, not changed
- Members with no recorded test are not listed, so "who has not tested" is not shown yet.
- No browser check yet for the switch or the results list.
