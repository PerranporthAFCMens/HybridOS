# HybridOne web app: UI rules

Short rules so every screen looks and behaves the same, and so layout mistakes are caught by a machine instead of by a person on a phone. The brand itself (colours, fonts, logo) is in `../BRAND.md`; these rules are about layout and controls.

## The rules

1. **Form boxes come from `ui/Field`.** Use `Input`, `DateInput`, `Select` and wrap them in `Field` / `FieldRow`. A raw `<input>`, `<select>` or `<textarea>` anywhere outside `src/ui/` fails lint. The shared boxes shrink below their built-in width (iPhone date boxes are very wide by default), are 44px tall, and never stretch past their card.
2. **Columns can always shrink.** Grids use `minmax(0, 1fr)`, never plain `1fr`, and grid children get `min-width: 0`. No fixed pixel widths on anything that holds text; use `max-width` or percentages. Phone layouts (under 900px) are one column.
3. **Tap targets are at least 40px tall** (44px is the target): buttons, button-style links and form boxes. The one named exception is a *dense index* such as the A to Z jump bar; mark its container `data-dense`. Add to the exceptions only with a reason written in the PR.
4. **Long text wraps, it does not spill.** Names, plan names and emails use `overflow-wrap: anywhere` or wrap naturally. Never assume a short name.
5. **Colours, fonts and radii come from the brand variables** (`--hybrid-*`, from `assets/brand/brand.css`). No new hex colours in components. The one exception is white behind an uploaded gym logo, so any logo stays visible on the dark menu.
6. **Every screen and pop-up is registered in `browser/audit.mjs`.** The audit opens each one at 320, 390 and 1280px with the wide iPhone date-box width faked, and fails if the page scrolls sideways, anything sticks out of its parent or off the screen, or a tap target is under 40px. A new screen is not done until it is added to `STATES` in that file and the audit passes.
7. **Pop-ups become bottom sheets on a phone** (`Modal` does this) and close with Escape or a tap outside.
8. **Gym logos** show as a small light tile (56px) with the name beside it; see `shell/gymBrand.ts`.

## Adding a screen: checklist

- [ ] Uses `Card`, `Button`, `Field` and friends from `src/ui/`; no raw form boxes.
- [ ] Data through `src/data/`, rules in a unit-tested `calc.ts` (see `ARCHITECTURE.md`).
- [ ] Added to `STATES` in `browser/audit.mjs` (and its pop-ups).
- [ ] `npm run check` passes, then the browser checks (below).
- [ ] The PR shows a phone screenshot and says what was checked and what was not.
- [ ] One look on a real phone after it reaches the dev site, because the browser used in tests is not Safari.

## Running the checks

```
npm run check          # type check, lint, unit tests, build
# serve the built site (from the repo root: python3 scripts/build_site.py, then
#   python3 -m http.server 4173 --directory _site), then:
npm run browser        # signed-out, Today, Members and the layout audit
```

## What the audit cannot tell you

It finds things that spill, overlap the screen edge or are too small to tap. It cannot tell you that something looks ugly or confusing. That is still a human judgement, which is why new patterns get a real-phone look.
