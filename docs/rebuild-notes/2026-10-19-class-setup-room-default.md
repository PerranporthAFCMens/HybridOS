# Class setup: a room starts at its full size (15 October 2026)

**Owner request:** when a class type needs the Crossfit Studio (capacity 30), "How many" should start at the maximum (30), not 1.

**What changed:** in Class setup, ticking a **room** that has a size now starts "How many" at that size. Equipment (even with a count, like 12 Spin bikes) and a room with no size still start at 1. The number can still be changed (for example lowered so two classes can share a room). `defaultQuantity` in `web/src/classsetup/calc.ts`; unit test in `web/tests/classsetup.test.ts`; browser check in `web/browser/classsetup.mjs` (fails on the old code, passes on the new).

**Not changed:** how the scheduling checks use the number. No database change. Existing class types keep what they were saved with.
