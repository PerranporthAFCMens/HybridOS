# Class packs, part 2a (2 of 2): give a pack, see packs held (20 October 2026)

On **Members > Class packs**:
- Each pack on sale has **Give to a member**. It opens a form: choose a member, **Give class pack**. Nothing is charged. It calls the part 1 function `owner_give_class_pack` (owners and admins only), which copies the pack's name, classes and expiry onto the member's own pack.
- Below the pack list, **Packs members hold** shows every pack the gym has given or sold: member, pack, classes left, expiry, given or bought, and a state (In use, Used up, Expired, Cancelled). Packs in use come first.
- **Cancel pack** (only on a pack in use) asks "Yes, cancel it" before calling `owner_void_class_pack`. A cancelled pack's classes can no longer be used.

- No database changes: uses the part 1 tables and functions (SQL already run). Gym comes from the shared gym context; the list is read for this gym only.
- Members still cannot see or buy packs, and booking does not spend a credit yet (parts 2b and 3). A held pack does nothing until part 3.
- Files: `web/src/packs/ClassPacks.tsx`, `calc.ts`, `usePacks.ts`, `packs.css`; `web/src/data/classPacks.ts`; tests `web/tests/packs.test.ts` (12) and `web/browser/packs.mjs` (40 checks per size, exact request of give and cancel); audit states `pack give` and `pack cancel`.
