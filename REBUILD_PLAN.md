# HybridOne app rebuild plan (agreed 7 October 2026)

Owner decision: rebuild how the screens are put together so the product is fast, consistent and safe to change, accepting short-term effort for long-term stability. The database, security rules, Edge Functions, brand and what each screen does do NOT change.

## Why
Today the app is about 24 separate hand-written HTML pages. Inside the Admin shell each section loads as a full page in an iframe, so every click repeats the whole start-up (scripts, sign-in check, gym lookup, branding, data). Copy-and-paste between pages causes repeat bugs (double sidebar, Today phone layout). PR #109 reduced repeat database reads but cannot fix the structure.

## Target stack
- TypeScript (strict), React, Vite.
- TanStack Query for data fetching and caching.
- Typed Supabase client from generated database types; screens never call the database directly (one typed data layer).
- One owner for sign-in and gym context (replaces the per-page lookups).
- Brand tokens as shared components (buttons, cards, tables, forms).
- Hash routing so it works on GitHub Pages (dev) and Vercel (live) without rewrites.
- Not Next.js (no public/SEO surface needed), no new backend or database.

## Tight rules (no technical debt)
1. Strict TypeScript; the `any` escape hatch is banned; type check fails the build.
2. Shared things are built once and reused. No copy-pasted screens.
3. One typed data-access layer. A database change is fixed in one place.
4. One owner for sign-in and gym context. Nothing else looks up who the user is.
5. Gates on every PR: type check, lint, unit tests, build, browser tests at phone and desktop width. Nothing merges red.
6. A screen is moved fully and then its old page is deleted. No half-migrated screens, no two versions of the same screen.
7. This file and an ARCHITECTURE note in the repo describe folder layout, naming and how to add a screen.

## Method (strangler)
The new app lives in `web/` and is built to `_site/next/` by `scripts/build_site.py` (relative base, hash routing). Existing routes are untouched. Screens not yet moved keep working inside the new shell. Live is only changed on the owner's say-so.

1. Foundation: scaffold, typed client, auth/gym context, shell, tests, CI gates, ARCHITECTURE note. Nothing visible changes.
2. Shell and Today. Owner judges speed on dev.
3. Members, Classes, Reports, then Settings, then the member app.
4. Retire each old page as its replacement ships.

## Status (updated 7 Oct 2026, evening)

**Done and on `dev` (all six dev checks passed on each merge):**
- Step 1, Foundation (#111): `web/` scaffold, typed data layer, `AuthProvider` as the single owner of sign-in and gym context, brand tokens, CI gates, `ARCHITECTURE.md`.
- Step 2, Shell and Today (#114): Admin shell and a Today screen with the same content as the old one, from real queries.
- Step 3, part 1, Members (#115, date-box fix #120): member directory and member record, including writes (lifecycle dates, activate/pause/cancel, assign membership), with the exact request of every write checked in the browser test.
- Shell polish: gym logo as a compact tile (#116, #119); old-shell menu button no longer covers the logo (#117).
- Quality net: UI rules file and shared form boxes, with lint rejecting raw form boxes (#122); an automatic layout audit that opens every screen and pop-up at 320, 390 and 1280px (#122); the Today test no longer depends on the time of day (#121); CI caches the browser download, retries a stuck install, runs the audit, and has a reporting-only Safari-style (WebKit) job (#123).
- Working rule: the builder may merge safe `web/**` PRs into `dev` (rule 16, trial completed with #116, #119, #122; owner chose to keep it).

**Waiting on the owner:**
- A look at the new Today and Members on the dev site with a real login (`/next/#/today`, `/next/#/members`), and the member record on a real iPhone. Until that, the old Today and old Members code in `index.html` stay (rule 6: delete an old page only when its replacement is accepted).
- The first complete run of the WebKit job in CI (it may need fixing; it cannot block merges).

**Next, in this order (recommended):**
1. **Membership plans** (create, edit, activate/deactivate a plan). Small, finishes the Members area, and Today's "Manage" and "Add a plan" buttons currently still open the old page.
2. **Classes** (timetable view first, then class setup and booking admin). Larger; split into read-only timetable, then writes.
3. **Reports**, then **Settings and staff**, then the **member app**.
4. Retire each old page as its replacement ships (starting with Today and Members once accepted).
5. A signed-in browser test against real data (needs a disposable test persona and an Edge Function change, which needs the owner's approval of the exact text).

Every new screen follows `web/UI_RULES.md` and is added to `web/browser/audit.mjs`.
