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

## Status
- Step 1 (Foundation) built on `dev` (7 Oct 2026): `web/` scaffold (strict TypeScript, React, Vite, TanStack Query, hash routing), generated Supabase types and a single typed data layer, `AuthProvider` as the one owner of session and gym context (rules mirror the legacy `getMembershipAccess`, with unit tests), brand tokens and Button/Card, a placeholder shell and Today, `scripts/build_site.py` builds it to `_site/next/`, CI workflow "HybridOne web app checks" (type check, lint, unit tests, build, phone and desktop browser check), and `web/ARCHITECTURE.md`. Nothing visible changes for existing routes. A signed-in browser check of `/next/` is not yet written (needs a test persona), so the signed-in path is covered by unit tests only.
- npm access to `registry.npmjs.org` now works in the build environment.
- Step 2 (Shell and Today) built on branch `rebuild-shell-today`, PR open, not merged: Admin shell (sidebar, gym switch, mobile drawer) and a Today screen with the same content as the current Today (summary and actions, Needs you, four figures, Classes today, Members over time, Membership plans, Community), real queries through the typed data layer, brand tokens from `assets/brand/brand.css`. Other sidebar items still open the old pages. Owner judges speed on dev after merge. Old Today (in `index.html`) is NOT deleted yet: rule 6 says delete when the replacement ships, so that happens in a follow-up PR once the owner accepts the new Today on dev.
- Step 2 merged to `dev` (PR #114) and all gates passed on the merge commit. The owner's look at the new Today with a real login (`/next/#/today`) is still to do; the old Today is not deleted until then.
- Step 3, part 1 (Members) built on branch `rebuild-members`, PR open, not merged: member directory (search, sort, A-Z jump) and member record (lifecycle dates, activate/pause/cancel, assign membership) in the new app, with every write checked in the browser test. Membership plans (create/edit plans) is a separate old page and moves later. Old Members code stays in `index.html` until accepted.
- Next: Classes, Reports, Settings, Membership plans, then the member app.
- Interim patches already merged: #109 (shared database reads, pre-connect).
