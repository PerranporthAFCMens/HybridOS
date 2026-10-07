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
- Blocked at start: the build environment returned `403 Forbidden` from `registry.npmjs.org` (organisation policy), so packages cannot be installed. Owner is updating the cloud environment's network access (Custom, default package-manager list on, add `registry.npmjs.org`); applies to new sessions only. First action of the next session: check `npm view react version` works, then start step 1.
- Interim patches already merged: #109 (shared database reads, pre-connect).
