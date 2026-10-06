# HybridOne Visual / UX Audit

Date: 29 September 2026

## Evidence

This review is based on the real built `dev` application, not source-only CSS checks.

- Audited source revision: `1bd1a6c075d70dd5ea52da77c817bcc26663b973`
- Auth/browser run: `36570992500` — PASS
- Screenshot artifact: `11035095102`
- Captures: 59 total
  - 28 desktop at 1440 × 1000
  - 31 mobile at 390 × 844
- Capture errors: 0
- Production was not changed.

The audit covers the public landing/auth surfaces, gym join flow, multi-gym chooser, the Owner/Admin shell and major admin pages, Staff preview, Member preview, and mobile drawers.

## Overall assessment

HybridOne already has a credible visual direction. The strongest screens feel like one product: dark navy shell, strong type hierarchy, light grey workspace, white surfaces, restrained mint/teal accents, and clear rounded controls.

The main problem is not that every screen needs redesigning. It is that the visual system is currently implemented as a broad final CSS override plus many page-specific repair rules. That produces regressions when a semantic component such as a hero is also a generic `.card`.

The next UI pass should therefore be a controlled visual-system cleanup, not another series of one-off patches.

## Strong reference surfaces

Use these as quality references rather than redesigning everything from scratch:

- Admin dashboard — strong hierarchy, proportion and responsive behaviour.
- Communications — clear two-column desktop composition and clean mobile form hierarchy.
- Marketing landing page — polished and deliberate.
- Hybrid Hub join flow — good gym-first branding and mobile form composition.
- Universal login — clear and professional platform-first entry.
- Mobile Member home — after the recent polish it has the strongest signed-in mobile hierarchy.
- Shared sidebar / mobile drawer — the navigation language is now broadly coherent across roles.

## Critical visual defects

### 1. Desktop Member training hero is visually broken

Evidence:
- `desktop__member-home.png`
- compare with `mobile__member-home.png`
- compare with the intended preview in `desktop__admin-member-view-settings.png`

The Member home settings preview shows the correct dark training hero. The mobile portal also shows it correctly. The desktop live Member portal renders the same hero as a white card with very low-contrast text.

Root cause:
`app-consistency.css` is the final stylesheet and currently contains a broad rule:

```css
.card,.panel {
  ...
  background: var(--hybrid-panel) !important;
  ...
}
```

That rule overrides semantic hero backgrounds. Mobile currently repairs this with a highly specific `#memberHomeCanvas ... .hero` rule, leaving desktop broken.

Required direction:
- Shared card rules must not force the background of semantic variants.
- The hero contract should explicitly own its background/text colours on every viewport.
- The Member settings preview and real Member portal must render the same component contract.

### 2. Staff workspace hero is broken on desktop and mobile

Evidence:
- `desktop__staff-home.png`
- `mobile__staff-home.png`

The large “Your workspace” surface is white while its supporting text is still styled for a darker hero, making the main explanatory copy look faded/disabled.

This is the same underlying generic-card override problem and should be fixed at the component-contract level, not with another Staff-only patch.

### 3. Staff preview mobile header collides

Evidence:
- `mobile__staff-home.png`
- `mobile__staff-mobile-drawer.png`

The “Staff view · Previewing…” bar and the hamburger occupy the same visual zone. The text wraps under/behind the control.

Member preview already has a better compact banner treatment. Preview mode should be one shared shell component used by Member and Staff so safe-area offsets and fixed controls are handled once.

### 4. Admin Classes loading state is not product-quality

Evidence:
- `desktop__admin-classes.png`
- `mobile__admin-classes.png`

The desktop capture can remain at a small “Loading…” state; mobile can display large anonymous skeleton rectangles with no page identity. This audit does not prove the class data itself is broken — the capture happened during the loading lifecycle — but it does prove the loading experience is inconsistent and visually weak.

Required direction:
- one canonical loading/skeleton treatment;
- preserve page title/context while loading;
- visual audit should later wait on a page-ready signal as well as capturing the loading state intentionally.

## High-priority consistency issues

### 5. The final shared stylesheet is too aggressive

The current implementation pattern is:

1. individual page CSS defines the screen;
2. specialist CSS layers modify it;
3. `app-consistency.css` is injected last;
4. broad `!important` rules force visual primitives;
5. page-specific CSS then needs increasingly specific overrides to recover intended variants.

This is visible in `member-experience.css`, which now contains several `:has(...)`, viewport-specific and `!important` repairs to protect the Member experience.

The visual system should instead use:

- tokens: colours, radii, shadows, spacing, type;
- base components: page header, surface/card, button, field, tabs, empty state, modal;
- explicit variants: hero, stat, danger, success, dense, flat;
- role/surface CSS only for layout and truly unique components.

A base `.card` rule should never silently erase a `.hero`.

### 6. Page-local styling is still creating drift

Static scan of representative source pages:

| Page | Embedded CSS | Inline style attrs | Unique hard-coded hex colours |
| --- | ---: | ---: | ---: |
| `index.html` | ~14.2 KB | 36 | 43 |
| `gym-layout.html` | ~11.3 KB | 13 | 25 |
| `member.html` | ~7.3 KB | 26 | 26 |
| `landing.html` | ~5.7 KB | 1 | 25 |
| `social.html` | ~5.6 KB | 3 | 20 |
| `member-view-settings.html` | ~5.5 KB | 7 | 22 |
| `reporting.html` | ~5.2 KB | 6 | 22 |
| `classes.html` | ~4.6 KB | 6 | 25 |
| `staff.html` | ~4.2 KB | 8 | 28 |
| `communications.html` | ~4.1 KB | 5 | 18 |

This does not mean all embedded CSS must be removed. It does mean repeated visual decisions should migrate to the shared system instead of being independently restated on every page.

### 7. Desktop information density is uneven

Some desktop screens use the workspace well:
- Dashboard
- Communications
- Gym layout
- Workout builder
- Member home settings

Others can feel like a small mobile-style tool placed in a very large desktop canvas:
- Reporting when no report is selected
- Classes while loading / empty
- restricted Admin access
- several sparse Member tabs

Use a small set of desktop layout archetypes:
- dashboard grid;
- form/editor with secondary panel;
- dense data/report workspace;
- focused narrow task;
- empty/restricted state.

Do not let every page invent its own max-width and whitespace behaviour.

### 8. “Everything is a card” is flattening hierarchy on mobile

The mobile Member and Staff experiences are now consistent, but too many low-priority sections are presented as equally weighted white rounded cards on the grey canvas.

This makes long pages feel heavier and longer than necessary.

Keep strong cards for:
- primary action/hero;
- key status/goal;
- forms;
- actionable grouped content.

Use flatter list/divider treatments for:
- secondary statistics;
- empty informational sections;
- repeated low-priority rows.

### 9. Empty states need a shared language

Examples:
- Reporting opens into a large blank canvas.
- Classes can show a minimal `Loading...` box or anonymous skeletons.
- Member workouts/PBs/membership can become a single empty white panel.
- restricted Admin access leaves a very large unused canvas.

Empty states should consistently answer:
1. What is this area?
2. Why is it empty?
3. What can the user do next?

### 10. Native browser alerts remain in product workflows

Static scan found extensive raw `alert(...)` usage, including 17 occurrences in `admin-access.html`.

These bypass the HybridOne visual language and feel like developer tooling rather than a finished product.

Replace user-facing browser alerts/confirms with:
- inline feedback for field/action results;
- shared toast for lightweight success/error;
- branded confirmation modal for destructive or consequential actions.

## Branding / public experience

### 11. Universal login is strong; gym-specific login is not yet truly gym-first

The universal login is appropriately HybridOne-first.

However the gym-targeted login links for Hybrid Hub and Puffin Performance still use the same large HybridOne “Your gyms. One login.” masthead, with the gym name shown only as a small hint box.

That contrasts with the Hybrid Hub join flow, which is correctly gym-first with discreet “Powered by HybridOne”.

Recommended contract:
- Universal login: HybridOne-first.
- Gym-specific member/customer login: gym-first, discreet Powered by HybridOne.
- Staff/system access can retain stronger HybridOne attribution where appropriate.

### 12. Decide the accent-colour roles

The marketing landing page uses a strong purple accent. Admin dashboard hero also uses purple. Member surfaces lean toward mint/teal.

That can work, but the roles should be deliberate:
- HybridOne platform accent;
- gym/tenant accent;
- member/training accent;
- semantic success/warning/error.

Reduce ad-hoc hard-coded colours once those roles are defined.

## Things that should not be rewritten

The audit does **not** support a wholesale visual rewrite of every page.

Keep:
- the dark navigation shell;
- current typography direction;
- overall light workspace;
- core button/field proportions;
- dashboard visual direction;
- the current mobile Member hero;
- Communications layout;
- public landing structure;
- gym join structure.

The goal is to make the weaker screens inherit the quality of the stronger ones.

## Recommended implementation phases

### Phase 1 — Visual contract and critical regressions

No feature redesign.

- split shared tokens from component variants;
- stop generic card rules overriding heroes;
- fix Member desktop hero;
- fix Staff desktop/mobile hero;
- create one shared preview-mode banner/safe-area contract;
- standardise page heading and desktop content-width archetypes;
- add intentional empty/loading state primitives.

### Phase 2 — Member and Staff polish

- make desktop Member preview match the configurable preview;
- reduce mobile card-on-card density;
- standardise Member/Staff section headers and secondary lists;
- review every Member tab on both widths;
- review Staff dashboard hierarchy and role-preview chrome.

### Phase 3 — Owner/Admin high-use surfaces

Prioritise:
1. Dashboard
2. Members / memberships
3. Classes / class setup
4. Workouts
5. Staff management
6. Communications
7. Reporting
8. Services/resources

For each surface:
- use an approved page archetype;
- remove one-off control styles where a shared primitive exists;
- replace browser alerts;
- standardise loading, empty, success and error states.

### Phase 4 — Auth and tenant branding

- keep universal login HybridOne-first;
- make gym-targeted login gym-first;
- align join, reset, invite and login branding;
- ensure Powered by HybridOne remains discreet on member/customer surfaces.

### Phase 5 — Visual regression gate

Keep the authenticated screenshot audit as a repeatable release tool.

For every visual-system change:
- capture desktop + mobile;
- compare high-risk surfaces;
- require zero horizontal overflow;
- keep representative hero, shell, modal, form, dense-data, empty and loading states in the baseline.

## Promotion guidance

Do not use this audit as a reason to promote `dev` to production. The existing production hold remains independent.

Complete visual changes in controlled batches on `dev`, browser-review each batch, then include them in the deliberate production reconciliation only when the wider Auth/release gates are ready.
