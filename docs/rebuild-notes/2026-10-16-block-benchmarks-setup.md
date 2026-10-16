# Block benchmarks: setting them up (benchmarks and progress, part 2 of 3)

Gym touched: the owner's current gym (shared gym context). Test gym: Puffin Performance. Needs the SQL from `20261016170000_block_benchmarks.sql` (already run live).

- In Classes, Blocks, open a block: a new **Benchmarks** section lists the movements the block tests, with the day the start test opens, the day the end test opens, and whether higher or lower is better.
- Add one by choosing a movement (switched-off movements and ones already used are not offered), two days and which result is better (a time defaults to lower, everything else to higher). Remove one with Remove. To change a benchmark, remove it and add it again.
- Plain refusals before anything is sent: no movement, repeated movement, days outside the block, end not after start.
- Members do each test as a normal workout with that movement. Their results and change come in the next pull request.
- Files: `web/src/classes/benchmarks.ts` (rules), `BlockBenchmarks.tsx`, `useBenchmarks.ts`, `ClassBlocks.tsx`, `web/src/data/benchmarks.ts`, `database.types.ts`, `web/tests/benchmarks.test.ts`, `web/browser/block-benchmarks.mjs`, `web/package.json`.
