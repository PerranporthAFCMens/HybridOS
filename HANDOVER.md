# HybridOne technical handover

**Updated: 26 September 2026**

This file is architecture/background. Volatile operational truth is in the control layer:

1. [PROJECT_STATE.json](./PROJECT_STATE.json)
2. [PROJECT_CONTROL.md](./PROJECT_CONTROL.md)
3. [ENVIRONMENT.md](./ENVIRONMENT.md)
4. [STATUS.md](./STATUS.md)
5. [AUTH_CONTEXT.md](./AUTH_CONTEXT.md)
6. [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md)
7. [UI_CONSISTENCY.md](./UI_CONSISTENCY.md)

## Product

HybridOne is a multi-tenant operating system for hybrid gyms.

Primary pilot/demo tenant: **Hybrid Hub**.

Major areas:

- memberships and members
- classes and scheduling
- workouts/programming
- staff and permissions
- community/social
- reporting
- communications
- member/staff experiences
- operational/access administration

HybridOne is separate from Football PA.

## Repository and environments

Repository:

`PerranporthAFCMens/HybridOS`

- `main`: production source
- `dev`: development source

Verified production checkpoint:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Verified dev application checkpoint:

`6a14cfed829f01eace2ad094dd14e1dd08b27120`

At that checkpoint the branches were diverged, dev ahead 89 and behind 4, merge base `b7d83243e9248a64978677efec91c4f9d83c1052`.

Do not blindly merge/overwrite.

## Build/deployment

Both environments use:

```
source
-> python3 scripts/build_site.py
-> _site
```

Vercel must keep the build/output contract. GitHub Pages also serves the generated site.

Dev runtime authority:

`.github/workflows/dev-runtime.yml`

Production deployment details:

[VERCEL.md](./VERCEL.md)

## Identity and gym context

The previous “login URL decides the gym” model has been retired on dev.

Current model:

> **Authenticate the person first. Then select an active gym context.**

A Supabase Auth identity may belong to multiple gyms.

After login:

- 0 active memberships -> no gym entry
- 1 -> direct entry
- 2+ -> Choose a gym

Current gym:

`sessionStorage['hybrid-gym-id']`

Last-used hint:

`localStorage['hybrid-last-gym-id']`

Multi-gym users can use **Switch gym** from the signed-in UI.

Role is resolved separately for each gym.

See [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

## Multi-site future

Full organisation/site hierarchy is parked.

Do not design new work around an assumption that one user has one gym. The person -> access -> context separation is deliberate so organisation/site context can be added later.

## Universal login evidence

Authenticated audit run:

`36199919230`

Passed:

- universal email/password login
- two-gym chooser
- Hub -> Puffin
- Puffin -> Hub
- desktop account switch
- desktop current-gym/sidebar switch
- mobile account switch

Protected-route browser run:

`36199700825`

Passed universal-login redirect plus gym hint and safe `return_to`.

## UI system

Canonical shared visual layer:

`app-consistency.css`

Build guarantees it is the final shared stylesheet on product surfaces.

Static UI contract:

`scripts/ui_consistency_check.py`

Current authenticated audit covered 21 surfaces on desktop and 21 on mobile with no horizontal overflow.

See [UI_CONSISTENCY.md](./UI_CONSISTENCY.md).

## Auth/email

Live:

- `send-auth-email` v5
- `send-access-invite` v11
- Resend domain verified
- managed sender `noreply@hybridone.co.uk`

Full browser password-reset and magic-link journeys have passed for Hybrid Hub and Puffin Performance.

Invite resend and corrected template delivery have passed.

Remaining release-gate work is primarily invite/access edge cases. See [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md).

## Owner/Admin access

Primary files:

- `admin-access.html`
- `admin-invite.html`

Backend rules include Owner governance, pending/active/revoked states, secure invite claims and wrong-account handling.

Do not weaken governance for testing.

## Staff access

Every active Staff/Coach must have an Owner-created Access Level.

Important backend areas:

- `staff_access_levels`
- `staff_access.access_level_id`
- assignment/provision RPCs
- permission propagation
- `admin-create-staff-with-level`

Granular enforcement across every UI/server action remains a priority.

## Communications

`communications.html` is the Admin communications workspace.

Gym-controlled transactional settings include brand, From preference, Reply-to, logo, footer and template copy.

Marketing remains future work.

## Scheduling/workouts

Reuse the existing scheduler and clash/resource/capability logic.

Workout rule:

> One workout is a multi-activity session, not one exercise.

Do not create parallel scheduling/workout systems without inspecting current code.

## Egress/security

Keep:

- `supabase-request-guard.js`
- exact gym scoping
- low-frequency social polling
- no service-role secrets in browser
- RLS
- server-side sensitive checks
- narrow SECURITY DEFINER/RPC permissions
- Owner governance
- no silent cross-gym fallback

## Current release gate

Production remains held.

Before release:

1. finish remaining invite/access Auth matrix
2. intentionally reconcile main/dev
3. run built-site smoke
4. verify exact deployed production revision
5. run real production browser journeys
6. then update the release gate

## Temporary audit infrastructure

The authenticated whole-app audit used a disposable two-gym user.

After the final PASS:

- user cleanup succeeded
- database check confirmed the disposable user no longer exists
- audit Edge Function was made inert with JWT verification enabled
- temporary workflow/script are removed in the cleanup/docs commit
