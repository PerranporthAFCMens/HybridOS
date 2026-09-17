# Hybrid OS

Hybrid OS is a reusable multi-gym operating system for independent gyms and hybrid training facilities. It is being built as a multi-tenant SaaS so each gym can manage memberships, classes, bookings, staff, member profiles, workouts and community features while keeping gym data separated.

> **Current handover:** see [`HANDOVER.md`](./HANDOVER.md) before making further changes. It is the authoritative pickup point for the current build state, known issues, project IDs, URLs and next priorities.

## Current product pillars

1. Memberships and recurring revenue
2. Timetable and classes
3. Member bookings
4. Member profiles, workouts, PBs and progress
5. Staff operations
6. Community / chat
7. Later: referrals, challenges, access/check-in, richer analytics and payment automation

## Current stack

- Frontend: static HTML/CSS/JavaScript prototype
- Hosting: GitHub Pages
- Backend/auth/database: Supabase
- Payments: GoCardless architecture prepared, live integration not connected yet
- Repository: `PerranporthAFCMens/HybridOS`
- Main branch: `main`
- Live prototype: `https://perranporthafcmens.github.io/HybridOS/`

## Supabase

Project name: `Hybrid OS`

Project ref: `mzgnhmeydhhpzgxlgudh`

Region: London (`eu-west-2`)

Current public application tables include:

- `gyms`
- `profiles`
- `gym_members`
- `members`
- `membership_plans`
- `memberships`
- `channels`
- `channel_members`
- `messages`
- `class_sessions`
- `class_bookings`
- `class_session_reserved_plans`
- `class_session_staff`
- `payment_records`
- `workout_sessions`
- `workout_entries`
- `workout_sets`

The current prototype gym is **Puffin Performance**.

## Current frontend pages

- `index.html` — authentication and owner/admin dashboard
- `onboarding.html` — gym onboarding
- `classes.html` — class calendar, booking and staff assignment work
- `member.html` — real member portal, role-gated
- `member-preview.html` — standalone owner-safe member experience preview
- `staff.html` — staff portal
- `member-memberships.html` — older standalone membership page; expected to be retired later

## Current member experience

The member portal direction currently includes:

- Home dashboard
- Class booking access
- Membership details
- Community
- Profile
- Workouts

Workout tracking is deliberately flexible rather than weights-only. Exercises can be tracked by:

- reps + weight
- time
- distance
- calories
- custom numeric value/unit, e.g. pool lengths

The backend supports workout sessions, entries and individual sets.

## Branding

The old sled logo is no longer the preferred Hybrid OS identity. The current UI uses a simple abstract six-stroke triangular Hybrid OS mark and wordmark.

Gym branding is separate from Hybrid OS product branding. Puffin Performance is the current reference gym; a cleaned Puffin Performance-specific gym logo is still to be created/added later.

## Security principles

- Never commit Supabase secret/service-role keys.
- Frontend code may use only the Supabase publishable key.
- All exposed application tables must have appropriate RLS.
- Grants and RLS both matter.
- Authorization must use protected membership/role data, not user-editable profile metadata.
- Payment/bank credentials must remain server-side / with the payment provider.
- Security-definer RPCs must be reviewed carefully before production.
- Before real customer data, separate development and production environments.

## Important current caveats

- `member-preview.html` is a standalone preview with sample data. It exists because owner-to-member role preview routing proved unreliable in the real member portal.
- The real `member.html` remains role-gated and should eventually become the canonical member experience.
- There are temporary synthetic auth users corresponding to seeded test members. Long-term the domain `members` table should be the source of truth, with auth linkage only where needed.
- Current profile RLS is broader than desirable for sensitive fields such as phone/date of birth and must be tightened before real rollout.
- GoCardless tables/architecture exist, but actual OAuth/webhooks/payment execution are not yet wired.
- Static HTML is being used for speed. A proper app framework such as Next.js + TypeScript is still the likely longer-term frontend direction.

## Development approach

Prefer working changes over speculative redesigns. Preserve existing Supabase persistence and current working behaviour unless deliberately replacing it. Verify GitHub Pages deployment before claiming a change is live.

For a full continuation brief, read [`HANDOVER.md`](./HANDOVER.md).
