# Block benchmarks: member progress (Workouts tab)

Gym: any gym (no gym id hard-coded; gym comes from the shared gym context). Tested rules only; no database change, no SQL to run.

## What it does
On the member Workouts tab, a "Your progress" card appears when a block the member took a class in has benchmarks and the block has started. Per movement it shows the Start result, the End result and the change (better or worse, in the movement's own unit).

## How results are worked out
Nothing new is stored. The result for a test is the best matching exercise in the member's own recorded workouts inside that test's 7-day window (`TEST_DAYS`). An exercise matches by its `movement_id`, or by lower-cased name for older workouts. Best means lower for `better = 'lower'`, otherwise higher. Value rules reuse `candidatesFor` from `web/src/train/pb.ts`.

## Privacy
Only the signed-in member's own `workout_sessions` are read (existing RLS). Coaches seeing results is a separate, later piece and needs a role-gated function.

## Files
- `web/src/train/benchmarkProgress.ts` (rules), `web/src/data/memberBenchmarks.ts` (reads), `web/src/train/MyBenchmarks.tsx` (card), `web/src/train/Train.tsx` (one line to show it), `web/tests/benchmarkProgress.test.ts` (5 tests).

## Noticed, not changed
- Benchmark days cannot be edited, only removed and re-added.
- No browser check added for the new card yet.
