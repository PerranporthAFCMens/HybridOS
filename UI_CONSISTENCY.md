# HybridOne UI consistency contract

**Updated: 29 September 2026**

HybridOne uses one shared visual language across Admin, Staff and Member surfaces.

## Canonical layer

`app-consistency.css` is the final shared visual stylesheet in the built product.

Feature CSS may define genuinely unique layout, such as a timetable grid, gym floor-plan canvas or workout editor. It must not create a second product design system.

**Known visual-system debt (29 Sep):** the final shared layer currently applies some base rules too broadly. In particular, a generic `.card,.panel` background override can erase semantic variants such as Member/Staff heroes. The contract is therefore being refined so shared tokens/primitives stay authoritative without flattening explicit component variants.

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


## Latest dev head

Current verified dev source before this documentation checkpoint:

`0654b4a085d463eaaaccd241caf741015e0ac871`

- smoke `36467112929`: PASS
- public runtime `36467112883`: PASS

The persistent Admin shell and canonical `app-consistency.css` contract remain intact.

## Multi-gym shell visibility

For accounts with access to more than one active gym, the shared shell must expose a discoverable **Switch gym** route. This is part of the cross-app consistency contract, not a page-specific feature.

The 28 September visibility regression is **closed**. Fix `3ee9028a...` hardened the persistent shell switcher; authenticated browser run `36466232127` passed the visible desktop/mobile switch and Hub <-> Puffin navigation. Later current-dev commits do not modify that runtime implementation.


## Full visual / UX audit — 29 September

A deeper audit now supplements the structural consistency test above.

- audited revision: `1bd1a6c075d70dd5ea52da77c817bcc26663b973`
- authenticated browser run: `36570992500` — PASS
- screenshot artifact: `11035095102`
- 59 successful captures, 0 capture errors
- 28 desktop captures at 1440 × 1000
- 31 mobile captures at 390 × 844

The audit includes public/Auth, Owner/Admin, Staff preview, Member preview and mobile drawer states.

Full findings and implementation phases are recorded in `VISUAL_UX_AUDIT.md`.

The audit distinguishes **structural consistency** (shared shell, no overflow, common primitives) from **visual quality** (hierarchy, semantic variants, density, branding, loading/empty states). A page is not considered visually complete merely because the structural consistency check passes.

### Immediate visual priorities

1. stop base card rules overriding semantic hero variants
2. restore the desktop Member hero to match its configured preview
3. restore the Staff workspace hero on desktop/mobile
4. unify Member/Staff preview banner and mobile safe-area handling
5. standardise loading/empty states
6. reduce page-local visual drift and native browser alerts
7. make gym-targeted customer/member login surfaces gym-first while keeping universal login HybridOne-first
