# Blocks: filter the class list by class name (2026-10-16)

Gym touched: any (screen change only, no database change). Tested against Puffin Performance data in the browser check.

On a block, the list of classes in its weeks can now be filtered by class name ("Show" dropdown, shown when there is more than one class name). The tick buttons then act only on the classes shown ("Tick these N" / "Untick these N"); ticks on hidden classes are kept. With "All classes" the buttons are the same as before ("Tick every class" / "Untick all"). Nothing is saved until "Save classes".

Evidence: `npm run check` passes (786 tests); `class-blocks.mjs` browser check passes on phone and desktop (33 checks each, 2 new).
