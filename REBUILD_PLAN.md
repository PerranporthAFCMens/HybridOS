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
1. **Membership plans** (create, edit, activate/deactivate a plan). *Built on branch `rebuild-plans`, awaiting acceptance.* Small, finishes the Members area, and Today's "Manage" and "Add a plan" buttons currently still open the old page.
2. **Classes** (timetable view first, then class setup and booking admin). Larger; split into read-only timetable, then writes. *Read-only timetable merged (#129); Add class form built on branch `rebuild-class-form`, awaiting the owner's merge. Class setup (class types, resources, capabilities) is a separate old page, still to move.*
3. **Reports** (5a Overview built on branch `rebuild-reports`; 5b Memberships, Classes and Members tabs; 5c Payments, report library and exports), then **Settings and staff**, then the **member app**.
4. Retire each old page as its replacement ships (starting with Today and Members once accepted).
5. A signed-in browser test against real data (needs a disposable test persona and an Edge Function change, which needs the owner's approval of the exact text).

Every new screen follows `web/UI_RULES.md` and is added to `web/browser/audit.mjs`.

## Reports: what a gym owner needs to see (agreed direction, 7 October 2026)

The owner wants Reports to show everything needed to run the business, and will write the full report set on 8 October. Until then this is the builder's gap list against the old Reports page, to be reconciled with the owner's list.

**Behaviour for every report (owner request):**
- Click into any chart bar or figure to see the rows behind it.
- Download any report as PDF, Excel or CSV.
- An export for accounting in **Xero**, as files to import (owner confirmed, 7 October: file first, and both kinds: a payments-received list to match against the bank feed, and sales invoices, one per payment). Xero's sales invoice import needs the gym's own sales account code and tax type, so those are boxes in the export (remembered in the browser), and the owner or their accountant supplies the values. A live Xero connection needs a Xero developer app, owner-held credentials and an Edge Function, so it is a separate, owner-approved step, not planned yet.

**Gaps to add (builder's list):** income actually collected per month and its trend; revenue by plan and drop-in income; average income per member; churn, retention and average time a member stays; net growth chart; members at risk (no attendance in 14 or 30 days); new members who have not come back; memberships ending soon, paused or with a payment problem; strongest and weakest classes and times; coach view; every figure compared with the previous period; charts for age and gender; multi-gym roll-up.

**Not possible with today's data (needs new data capture first):** profit (no costs, rent or wages), enquiries and lead conversion, door check-ins that are not class bookings, class waiting lists.

**Order:** 5a Overview (merged #131); 5b-1 click-through and PDF/Excel/CSV downloads on the Overview (branch `reports-drilldown`); 5b comparison with the previous period, churn and retention, income collected and trend, plus the click-through and PDF/Excel/CSV download framework; 5c members at risk, ending soon and payment problems, class and coach views; 5d the full library, Xero export and the multi-gym roll-up.

## Member profile: milestones and awards (owner request, 8 October 2026: "don't forget")

The owner wants **milestones and awards on member profiles**. Not designed or built yet; recorded so it is not lost. It belongs with the **member record** (owner view, already in the new app) and later the **member app** (the member sees their own).

**Open questions for the owner before any design (ask when this is reached):**
- Which milestones are automatic? Examples the builder would suggest: joined (1 month, 6 months, 1 year), 10th, 50th and 100th class attended, a booking streak, a first class of each type. Which does the owner want?
- Which awards are given by hand by an owner or coach (member of the month, personal best, challenge winner)? Can a coach give them, or only owner and admin?
- Does the member see them (member app), and can they be shared (the existing social feed)?
- Are milestones per gym or does a member carry them between gyms (Hybrid Hub and Puffin)?

**What it needs (builder's view):** a place to store each award (type, who, when, given by, optional note), a list of milestone rules, and attendance data to count classes. **Counting classes attended depends on attendance being recordable**, which today is blocked (members' attendance can only be marked through a new database function; see the Classes bookings step). So the order is: bookings and attendance first, then milestones.

## Member side: types of member, and "super easy" (owner direction, 8 October 2026; build later)

The owner's picture of members: **classes-only**, **gym-only**, **PT clients**, and any **mix** of the three. The member side will eventually be an **app** (build later, after the owner-side screens). The owner's words: the current member side is "clunky and kinda difficult"; it must be **SUPER easy**.

**What a member must be able to do (the whole list):**
1. **Book and cancel classes.**
2. **See their workouts and update them.**
3. **See their PT sessions** (upcoming and past).
4. **Record what they did** (log a workout or an activity, including in a PT session).

**Design rule (the test for every screen):** each of those is reachable in as few taps as possible from the first screen, and **what the member sees depends on their type** (a classes-only member never sees gym or PT clutter; a mix sees only what they have). Type should come from their membership plan (the plan already says gym / classes / hybrid / PT), not from a setting the member has to manage.

**Requested change:** when logging an activity, add **Left / Right / Both** (for single-side exercises).

**What the builder found in the code (so the next step is not guesswork):**
- Old logging today: `workout-logger.js` plus the member pages (`member.html` and several `member-*.js`): a template/block/activity builder with sets (`workout_sets`: reps, weight, duration, distance, calories, custom value, notes). The owner finds creating a workout, then logging an activity, too many steps.
- **There is no side (left/right/both) column** in `workout_sets` or the activity template. Adding it needs a small database change (needs the owner's approval of the exact SQL before anything is applied).
- PT: `pt_appointments` has staff, member, times, status and notes only. "Record what they did" in a PT session needs a link from an appointment to a workout log; nothing links them today. PT also still has none of the clash checks that classes have (the owner has not yet said whether PT should follow the same rules).
- A member's type can be read from `membership_plans` (`includes_open_gym`, `includes_classes`, `includes_pt`, `access_type`).

**Questions for the owner when this step starts (not now):**
- Is the member app a **phone-first web app** (opens from a link, can be saved to the home screen) first, with an App Store app later, or an App Store app from the start?
- What is the **one thing** a member opens the app for most often? (That becomes the first screen.)
- Should a member be able to **start logging with one tap** from "today's workout" (set by their coach), and **repeat last time's numbers** in one tap?
- For PT: does the **coach** log what was done in the session, the **member**, or either?

**Order:** owner-side screens first (Classes finished with bookings and attendance, Reports 5b to 5d, Settings and staff), then **milestones and awards** (above), then the member app, designed with the owner from the list above.
