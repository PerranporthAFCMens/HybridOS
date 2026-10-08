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

**Design rule (the test for every screen):** each of those is reachable in as few taps as possible from the first screen. **Members are not put in boxes** (owner, 8 October: the types above describe the member base, they are not labels to design around). The app does not ask "what type are you"; it shows **what this member has**: their plan decides which of classes, gym and PT are switched on, and the first screen shows what is relevant to them right now (next class booked, today's planned workout, next PT session), so a member with only classes simply has nothing to see about PT. The plan fields (`includes_open_gym`, `includes_classes`, `includes_pt`) are the only input.

**Requested change:** when logging an activity, add **Left / Right / Both** (for single-side exercises).

**What the builder found in the code (so the next step is not guesswork):**
- Old logging today: `workout-logger.js` plus the member pages (`member.html` and several `member-*.js`): a template/block/activity builder with sets (`workout_sets`: reps, weight, duration, distance, calories, custom value, notes). The owner finds creating a workout, then logging an activity, too many steps.
- **There is no side (left/right/both) column** in `workout_sets` or the activity template. Adding it needs a small database change (needs the owner's approval of the exact SQL before anything is applied).
- PT: `pt_appointments` has staff, member, times, status and notes only. "Record what they did" in a PT session needs a link from an appointment to a workout log; nothing links them today. PT also still has none of the clash checks that classes have (the owner has not yet said whether PT should follow the same rules).
- A member's type can be read from `membership_plans` (`includes_open_gym`, `includes_classes`, `includes_pt`, `access_type`).

**Decisions from the owner (8 October 2026):**
- **A web app first** (opens from a link, can be saved to the phone's home screen like an app). A native App Store app is too much for now; revisit only if it is simple and low cost (the builder's note: the same web app can later be wrapped for the stores, with a yearly Apple developer fee and a smaller one-off Google fee plus review time, so the web app is not wasted work).
- **No single "most used thing":** it depends on the member, so the first screen adapts (see the design rule).
- **PT sessions: both the coach and the member can record what was done.** In practice **the PT plans the session first and pushes it to the member**. A PT can also **push a planned workout timetable or set of activities** to a member (the old data already has `workout_assignments` and `workout_templates`, which this builds on).

**What that adds to the build (builder's view):**
- A **coach side** to plan a PT session (activities for that appointment), assign it to a member, and push a **programme** (a timetable of planned workouts over days or weeks).
- The member sees **today's planned workout first** and logs against it (pre-filled with the plan, one-tap "repeat last time").
- A link from a PT appointment to the planned and logged workout (new, needs a database change with the owner's approval of the exact SQL).
- The member is told when something is pushed to them (a notification; the web app can do this once saved to the home screen, details to check when built).

**Still to ask the owner when this step starts (not now):**
- Can a member change a pushed workout (swap an exercise, skip one), or only log against it?
- Does a PT see what the member logged straight away, and can they comment?

**Order:** owner-side screens first (Classes finished with bookings and attendance, Reports 5b to 5d, Settings and staff), then **milestones and awards** (above), then the member app, designed with the owner from the list above.

## Report builder and Enterprise manager (owner requests, 8 October 2026; build later, in this order after the Xero export)

### 1. A report builder the owner uses themselves
The owner wants owners and admins to **build their own reports** from the database by **clicking or dragging** what they want to see.

**Behaviour:** pick what to look at (members, memberships, payments, classes, bookings and attendance, PT sessions, workouts); pick the columns to show or a measure (how many, how much, average); optionally split by something (plan, month, class, coach); optionally filter (status, date range, plan); choose how to see it (table, columns, line, ring, bars); save it; download as CSV, Excel or PDF; click any bar or slice for the rows behind it (as the current reports do). Tap to add fields first (phone friendly), drag to reorder on desktop.

**Safety rule:** no free typing of database commands. The builder offers a fixed, builder-chosen list of fields per dataset, always inside one gym by the existing row rules; personal details (date of birth, gender) are owner and admin only.

**First version (no database change):** five datasets from the data the Reports already load, tables plus the four chart types, filters and group-by, saved reports kept on the device. **Second step (needs a new table and the owner's approval of the exact SQL first):** save reports for the whole gym so every owner and admin sees the same ones.

**Decisions still to confirm with the owner:** shared saved reports (builder suggests yes); coaches get a cut-down version for their own classes or owners and admins only for now (builder suggests owners and admins only).

### 2. Enterprise manager: one view over the whole estate (admin only, no member screens)
The owner wants an overarching **Enterprise manager** that pulls reports, staff reports and the like from **every gym in the estate** into one view.

**What the builder found:** the database has **no organisation above a gym** today. Gyms are separate, and each person's role (owner, admin, staff, coach, member) belongs to one gym. The existing gym picker (Hybrid Hub and Puffin Performance) works by switching one gym at a time.

**Two steps, so value comes early:**
- **Step A, an "Estate" view for anyone who is owner or admin of two or more gyms (no database change).** One screen with a card or row per gym and a total: members, active memberships, estimated monthly income, income collected, failed payments, class fill and attendance, new members and leavers, staff headcount and what each coach taught (classes, PT sessions). Compare gyms side by side and over time with the same charts as Reporting; click a gym to open it in the normal admin; downloads as CSV, Excel and PDF. It uses the access the person already has in each gym, so nothing new can leak.
- **Step B, a true Enterprise manager role (needs new database tables and the owner's approval of the exact SQL first).** A new "organisation" that groups gyms, and an enterprise role for someone who manages the estate **without being a member of each gym**: read access across the organisation's gyms (view first; any changes to a gym stay with that gym's own admins), plus group-level settings. This is also the foundation for franchise or partner gyms later.

**Things to decide with the owner when this starts (not now):**
- What exactly the Enterprise manager must show first (builder's first list above), and who sees it (only the owner, or named enterprise managers).
- Can an enterprise manager **change** things in a gym, or only view and report?
- **Staff reports:** the measures wanted (headcount, hours, classes and PT sessions taught, attendance of their classes, qualifications and expiries).
- Gyms may differ in **currency and time zone** (the data already stores both per gym); for totals across gyms the builder would show each gym in its own currency and only add up gyms that share one.
- Whether partner or franchise gyms with **different owners** are ever in the same estate (changes what data may be shared).

**Order:** Xero export, then the report builder (first version), then the Estate view (Step A), then shared saved reports, then the Enterprise manager role (Step B). The owner can re-order.
