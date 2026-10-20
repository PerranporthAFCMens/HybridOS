# Class packs, part 2a (1 of 2): the owner screen (20 October 2026)

New page **Members > Class packs** (`/packs`). Owners and admins see the packs the gym sells and can make one, edit one, and put one on or off sale. A pack is a name, a number of classes (1 to 200), a price (0 allowed) and optionally how many days it lasts (blank = never expires). Editing a pack does not change packs members already hold (each held pack keeps its own copy).

- Uses the database from part 1 (`class_pack_types`; the SQL was run on 20 October 2026). No database changes in this PR.
- Gym comes from the shared gym context; every write names the gym and the pack.
- Not in this PR: giving a pack to a member, seeing the packs members hold (next PR, still part 2a), buying by card (part 2b), spending a credit when booking (3). The page says members cannot buy packs yet.
- Live address: `vercel.json` now rewrites `/packs` to the new app (takes effect at the next live release, Adam's call).
- Files: `web/src/packs/*`, `web/src/data/classPacks.ts`, `web/tests/packs.test.ts` (8 tests), `web/browser/packs.mjs` (22 checks per size), audit states `packs` and `pack form`.
