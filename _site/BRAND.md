# HybridOne brand guidelines

This file is the source of truth for how HybridOne looks and sounds. Follow it for every screen, page, email and asset. If something here conflicts with an older style in the codebase, this file wins.

## The idea

HybridOne is the operating system for gyms. Members join, pay, book and chat, and owners manage the lot, in one connected platform. The logo says it literally: a lowercase "hybrid" for the gym, and a single tile holding a 1 for the platform. The tile is also the app icon, so the logo and the product are the same object.

Master line: **Your gym. Your members. One operating system.**
Sign-off: **Run it as one.**
Descriptor: **Gym management software**

## Name

- In running text, always write **HybridOne**: one word, capital H, capital O.
- Never "Hybrid One", "Hybrid1", "hybridone" or "HYBRIDONE" in text.
- The logo itself is the lowercase artwork. Never retype the logo in a font. Always use the files in `logo/` or the `Logo` component.

## Logo

Files are in `logo/svg` (use these wherever possible) and `logo/png`.

| Use | File |
| --- | --- |
| Product UI, dark pages, decks | `hybridone-logo-on-dark.svg` (white word, Volt tile, Midnight 1) |
| White or Mist backgrounds, documents, invoices | `hybridone-logo-on-light.svg` (Midnight word, Midnight tile, Volt 1) |
| Volt backgrounds | `hybridone-logo-on-light.svg` |
| Photography, mid tones, one colour print | `hybridone-logo-mono-white.svg` or `-mono-midnight.svg` (1 knocked out) |
| Square spaces, merch, signage | `hybridone-stacked-on-dark.svg` / `-on-light.svg` |
| App icon, avatar, small spaces | `hybridone-tile-volt.svg` (dark grounds) or `hybridone-tile-midnight.svg` (light grounds) |

Rules:
- The tile is always the brightest part of the logo. On dark it is Volt. On light it flips to Midnight and the 1 turns Volt.
- Never put a Volt tile or Volt text on white. It disappears.
- Clear space: half the tile height on every side.
- Minimum size: lockup 80px wide (20mm in print). Below that, use the tile alone, minimum 16px.
- Never stretch, outline, add shadows or glows, recolour outside the palette, rotate, or rebuild the 1 with a typed character.
- The 45° flag on the 1 is the brand angle. Reuse it for cut corners, image crops and motion. Do not invent other angles.

In React, use `code/Logo.tsx`:

```tsx
<Logo height={28} />                       // lockup, for the dark app shell
<Logo tone="onLight" height={32} />        // marketing page on white
<Logo variant="tile" height={32} />        // collapsed sidebar, avatar
<Logo tone="mono" className="text-white" />// one colour, follows currentColor
```

## Colour

Dark is the default. The product lives on Midnight.

| Token | Hex | Role |
| --- | --- | --- |
| Midnight | `#0B1020` | Primary ground for the app, site and decks |
| Deep | `#121A2E` | Cards and panels on Midnight |
| Line | `#232C44` | Borders and dividers on dark |
| Raised | `#2B3550` | Hover fills, inactive chart bars, mid tone grounds |
| Slate | `#8B95AB` | Secondary text and labels on dark |
| Fog | `#C9CFDC` | Body text on dark |
| White | `#FFFFFF` | Headings on dark, light surfaces |
| Mist | `#EEF1F6` | Light ground for marketing, print and documents |
| Graphite | `#4A5368` | Secondary text on light |
| **Volt** | `#C6F135` | The signal. One per view: the primary action, the live number, the 1 |
| Pulse | `#6C8CFF` | Second data series, links on dark, focus rings |
| Ember | `#FF7A45` | Alerts, attrition, overdue payments, destructive actions |

Rough proportions on any screen: Midnight about 60%, Deep 15%, light surfaces 18%, Volt about 6%, data colours the rest.

Rules:
- Volt is earned. Use it for one primary action per view and the one number that matters. If everything is Volt, nothing is.
- Text on Volt is always Midnight. Never white text on Volt.
- Volt never sits on white or Mist. On light surfaces the primary button is Midnight with Volt or white text.
- Body text on dark is Fog, not pure white. Headings and key numbers are White.
- Never use gradients, glows or drop shadows as decoration. Depth comes from Deep on Midnight.
- Data: series order is Volt (current), Pulse (comparison), Raised (history). Ember only for negative movement.

## Typography

- **Geist** for everything: headings, interface, body.
- **Geist Mono** for numbers, prices, dates, metrics and small labels. Use tabular figures so columns line up.
- Both are free (SIL Open Font Licence) from Google Fonts or the `geist` npm package.

| Style | Size / line height | Weight | Tracking |
| --- | --- | --- | --- |
| Display | 72 / 72 | 550 | -4.5% |
| Heading 1 | 44 / 48 | 550 | -3.5% |
| Heading 2 | 28 / 34 | 550 | -2.5% |
| Heading 3 | 20 / 26 | 600 | -1.5% |
| Body | 16 / 26 | 400 | 0 |
| Small | 14 / 21 | 400 | 0 |
| Label (Mono) | 12 / 16, uppercase | 500 | +8% |
| Metric (Mono) | 34 / 38 | 500 | -3% |

- Sentence case everywhere, including buttons and navigation.
- Headlines can end with a full stop. Buttons and labels do not.
- Never bold body copy for emphasis. Never use all caps outside the Mono label style.

## Interface

- Corner radius: 10px for controls, 16px for cards and panels, fully round for pills. The logo tile uses its own 27% radius.
- Spacing on a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Buttons are at least 44px tall. Primary: Volt with Midnight text. Secondary: transparent with a Line border.
- Focus: a visible 2px Pulse outline on every interactive element.
- Icons: one consistent stroke icon set (for example Lucide) at 1.75px stroke, 20px. No emoji or Unicode symbols as icons.
- Navigation active state: Volt pill with Midnight text, or a Deep fill with White text where Volt is already used on the page.
- Empty states always tell the owner the next step and give them the button for it.

## Voice

HybridOne sounds like a good coach who also runs a tidy business.

- **Clear.** Say what it does. Short sentences, plain words, real features.
- **Coach-like.** Direct and encouraging. Give the next step and back people to take it. No hype, no exclamation marks.
- **On the owner's side.** Talk about members, classes and cash flow. The gym is the hero, HybridOne is the system behind it.

| We say | Not |
| --- | --- |
| Members | Users, customers |
| Your gym | Your facility, your venue |
| One place | Seamless all-in-one solution |
| Runs on its own | Leverage automation |
| Book, pay, join | Transact, onboard, convert |

Interface copy examples:
- Empty state: "No classes yet. Add your first one and members can book straight away."
- Success: "Membership live. The first payment goes out on the 1st."
- Warning: "3 payments need a look. We've paused reminders until you check them."
- Errors explain what happened and how to fix it. They do not apologise and are never vague.
