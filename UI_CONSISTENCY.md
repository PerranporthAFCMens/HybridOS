# HybridOne UI consistency contract

**Updated: 26 September 2026**

HybridOne uses one shared visual language across Admin, Staff and Member surfaces.

## Canonical layer

`app-consistency.css` is the final shared visual stylesheet in the built product.

Feature CSS may define genuinely unique layout, such as a timetable grid, gym floor-plan canvas or workout editor. It must not create a second product design system.

The shared layer owns:

- semantic colour/tokens
- typography and page-heading rhythm
- cards/panels
- ordinary buttons/actions
- inputs/forms/focus states
- tabs/navigation
- tables
- notices/empty/status states
- desktop/mobile touch sizing
- shell/sidebar/mobile-drawer language

## Build rule

`scripts/build_site.py` finalises the UI contract after feature transforms.

`scripts/ui_consistency_check.py` validates the stylesheet contract across 23 product surfaces.

## Authenticated whole-app sweep

Final browser audit:

- run: `36199919230`
- source: `6a14cfed829f01eace2ad094dd14e1dd08b27120`
- desktop: 1440 x 1000
- mobile: 390 x 844
- authenticated surfaces captured per viewport: 21
- horizontal overflow on audited surfaces: none

The same run also verified universal multi-gym login/switching before capturing the product screens.

This is stronger evidence than a source-only CSS check.

## Development rule

When adding/changing a page:

1. reuse shared primitives first
2. keep page CSS focused on unique layout/behaviour
3. do not create a separate palette/button/form/shell system
4. test desktop and mobile
5. run the built-site UI consistency check
6. browser-check meaningful new interaction/layout
7. never weaken checks just to obtain green CI

Consistency does not mean every feature has identical geometry. It means the user should always feel they are in the same HybridOne product.
