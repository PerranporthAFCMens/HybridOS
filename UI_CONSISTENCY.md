# HybridOne UI consistency contract

HybridOne uses one shared visual language across Admin, Staff and Member surfaces.

## Canonical layer

`app-consistency.css` is the final stylesheet in the built product.

Page and feature styles may define layout that is unique to a feature, for example a timetable grid, gym floor-plan canvas or workout editor. They must not become a separate visual design system.

The shared layer owns:

- colour and semantic tokens
- typography and page-heading rhythm
- cards and panels
- ordinary buttons and action spacing
- fields, inputs and focus states
- tabs and section navigation
- tables
- notices, empty states and status treatments
- desktop/mobile touch sizing
- shared sidebar and mobile-drawer language

Legacy variables such as `--bg`, `--line`, `--dark`, `--muted` and `--shadow` resolve to the canonical HybridOne tokens so older feature CSS cannot silently introduce a different palette.

## Build rule

`scripts/build_site.py` runs `finalise_ui_contract()` after all feature-specific build transforms. It removes any earlier `app-consistency.css` link and adds exactly one cache-busted link as the final stylesheet.

`scripts/ui_consistency_check.py` validates this rule across every product surface, including the persistent Admin shell.

## Development rule

When adding a new page:

1. Reuse the existing primitives first: `.top`, `.eyebrow`, `.card`, `.btn`, `.field`, `.section-title`, `.row`, `.tag`, `.notice`.
2. Add feature-specific CSS only for layout or behaviour that is genuinely unique to that feature.
3. Do not create a second palette, button system, form system or shell.
4. Test desktop and mobile.
5. Do not weaken the UI consistency check to make a page pass.

This is a consistency pass, not a product redesign. Tenant branding remains tenant-specific and feature layouts remain feature-specific.
