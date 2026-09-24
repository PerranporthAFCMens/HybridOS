# HybridOne technical handover

**Updated: 24 September 2026**

This file is architectural and historical background for HybridOne / Hybrid Hub.

**Do not use volatile branch heads, deployment versions, live Edge Function versions or release status in this file as operational truth.**

Before changing code, database policy, Auth, email, deployment, routing, navigation or permissions, read:

1. [PROJECT_STATE.json](./PROJECT_STATE.json)
2. [PROJECT_CONTROL.md](./PROJECT_CONTROL.md)
3. [ENVIRONMENT.md](./ENVIRONMENT.md)
4. [STATUS.md](./STATUS.md)
5. [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md) when relevant

The control layer overrides any older checkpoint text below.

---

## 1. Product and operating state

HybridOne is a multi-tenant operating system for hybrid gyms.

Core areas include:

- memberships and members
- classes and scheduling
- workouts/programming
- staff and permissions
- community/social
- reporting
- communications
- member and staff experiences
- operational/access administration

Primary pilot tenant:

- **Hybrid Hub**

Hybrid Hub is still a **pilot/demo tenant, not a live operating customer gym**. This means reviewed work can still be promoted more freely than it could after launch.

HybridOne is completely separate from Football PA.

Development expectations:

- British English
- no em dashes
- inspect current code before changing it
- one coherent change at a time
- preserve working behaviour unless intentionally replacing it
- verify deployed behaviour before saying something is fixed
- do not weaken tenant/security controls for convenience

---

## 2. Repository and current branch checkpoint

Repository:

`PerranporthAFCMens/HybridOS`

Branches:

- `main` = production source
- `dev` = development source

### Functional heads immediately before this documentation-only refresh

**main**

- `784bac0c253479265728381f34fab816baf4507c`
- **Fix Staff and Resources mobile layout**
- smoke: success
- Vercel status: success

**dev**

- `e82bf5106093624709bed85deb40540f071340f6`
- **Fix Staff and Resources mobile layout**
- smoke: success

Current merge base:

- `97c3c3390f7c1fb510315ecbc33ec379956e3654`

Relationship before docs refresh:

- dev ahead of main: 13 commits
- dev behind main: 4 commits
- status: **diverged**

### Important

Both branches now contain the same named Staff & Resources mobile-layout fix, but they reached it through different histories.

Do **not** blindly fast-forward, force-push or replace one branch with the other.

Main contains production mobile fixes.

Dev contains additional tenant/Auth-email hardening.

---

## 3. Production, dev and deployment architecture

Production:

- https://www.hybridone.co.uk
- https://www.hybridone.co.uk/hybrid-hub
- https://www.hybridone.co.uk/puffin-performance

Dev preview:

- GitHub Pages from `dev`

Dedicated deployment handover:

- [VERCEL.md](./VERCEL.md)

### Critical rule

Production and dev preview must both serve the generated site:

```
source
-> scripts/build_site.py
-> _site
```

Current Vercel contract:

```json
"buildCommand": "python3 scripts/build_site.py",
"outputDirectory": "_site"
```

This fixed the previous production/dev visual mismatch.

The build injects shared CSS/runtime, admin-shell behaviour, tenant branding, navigation, diagnostics and cache-busted URLs.

**When debugging visual differences, inspect the built `_site` output, not raw source alone.**

Do not remove the Vercel build/output settings without proving the replacement.

### Cache busting

`scripts/build_site.py` uses:

- `VERCEL_GIT_COMMIT_SHA` on Vercel
- `GITHUB_SHA` in GitHub Actions
- `dev` only as fallback

---

## 4. Current workflow state

### Dev

Normal development happens on `dev`.

Flow:

```
dev push
-> HybridOne smoke checks
-> build_site.py
-> smoke_test.py _site
-> email_hook_smoke.py
-> GitHub Pages dev preview
```

Vercel Git deployment is disabled for `dev`.

### Production

Production follows `main`.

Hourly workflow:

- file: `.github/workflows/hourly-production.yml`
- scheduled at minute 37
- only fast-forwards main when main is an ancestor of dev

Because main/dev currently diverge, the workflow **safely skips promotion**.

The latest hourly run on 24 September reported success and logged:

`main and dev have intentionally diverged; skipping hourly promotion.`

So:

> **A green hourly workflow does not mean dev was promoted.**

---

## 5. Tenant model

Core rule:

> **The login route decides the gym. The email address does not.**

A single Supabase Auth account may belong to multiple gyms.

Gym context:

```
sessionStorage['hybrid-gym-id']
```

Known gym IDs:

Hybrid Hub:

`242f57c2-6e37-4977-b3c5-1c87de7d0b98`

Puffin Performance:

`aec16956-3793-4543-873b-4412646ca1eb`

Routes:

- `/` -> platform marketing
- `/hybrid-hub` -> Hybrid Hub login
- `/puffin-performance` -> Puffin Performance login
- `/app` -> app entry

Owner/Admin login should enter:

```
admin.html?gym_id=<gym-id>
```

Do not reintroduce:

- first-active-gym inference
- `.limit(1)` tenant selection
- email-to-gym inference
- a generic gym picker as the primary flow

---

## 6. Admin shell and mobile

Important files:

- `admin.html`
- `admin-frame.js`
- `admin-frame.css`
- `shared-shell.js`
- `shared-admin-nav.js`
- `admin-embed.js`
- `admin-shell.css`
- `admin-pages.css`
- `app-consistency.css`
- `scripts/build_site.py`

Current menu order includes:

- Dashboard
- Community
- Classes
- Workouts
- Services & resources
- Staff management
- Members
- Communications
- Reporting
- View as
  - Member view
  - Staff view
- Account / Sign out

Reporting deliberately sits **above View as**.

### Latest UI/mobile work

Both current functional heads contain:

- **Fix Staff and Resources mobile layout**

Main also includes:

- `d6acf67...` — **Fix mobile admin drawer navigation on iPhone**

Dev includes:

- `bf1625ab...` — explicit mobile admin navigation
- `e20d5985...` — protect explicit mobile admin navigation

Reconcile these histories intentionally before the next broad promotion.

---

## 7. Branding

Public product spelling is always:

**HybridOne**

Never ship user-facing `HYBRIDONE`.

Brand hierarchy:

### Members/customers

- gym first
- HybridOne discreet

### Staff/Admin

- gym first
- **Powered by HybridOne** visible

### Platform marketing

- HybridOne first

Staff/Admin invite pages should resolve the gym from the secure invite and show the gym brand plus HybridOne.

---

## 8. Owner/Admin access

Primary UI:

- `admin-access.html`
- `admin-invite.html`

Implemented:

- Owner/Admin roles
- pending/active/revoked states
- email invitation
- secure invite link
- wrong-account detection
- Owner approval
- equal-Owner governance
- revoke/delete
- resend/retry flow

Important RPCs include:

- `create_email_access_invite`
- `approve_email_owner_invite`
- `create_shareable_access_invite`
- `approve_shareable_owner_invite`
- `get_access_invite`
- `claim_access_invite`
- `prepare_email_invite_token`
- `approve_pending_access`

Live invite Edge Function:

- `send-access-invite`
- ACTIVE
- version **8**
- JWT verification enabled

Production Hybrid Hub is the correct environment for trusted reviewers who need to inspect the real app. Remember that Admin access is genuine access to pilot data.

---

## 9. Staff Access Levels

Product rule:

> **Every active Staff/Coach account must have exactly one Access Level.**

Owner workflow:

1. create a level
2. name it
3. select permissions with checkboxes
4. save it
5. assign staff to it
6. later edit the level and propagate changes to assigned staff

Primary UI:

- `staff-permissions.html`
- `admin-operations.html`

Backend/database:

- `staff_access_levels`
- `staff_access.access_level_id`
- `assign_staff_access_level`
- `provision_staff_membership_with_level`
- `private.has_gym_staff_permission`
- propagation trigger
- `admin-create-staff-with-level` Edge Function

Rules:

- `staff_access.access_level_id` is NOT NULL
- Owner creates/renames/redefines/deletes level definitions
- eligible Admin/staff may assign existing levels
- assigning a level copies its permission set
- editing a level propagates permissions

Hybrid Hub examples:

- Coach / PT
- Reception
- Manager
- Manager 2

Intent examples:

- Manager: broad operational access, no staff/access changes
- Manager 2: broad access including staff/access changes

These are examples, not hard-coded product roles.

### Remaining work

A granular permission-enforcement sweep is still required.

Do not assume every historic Owner/Admin/`full_access` check already maps perfectly to each checkbox.

---

## 10. Communications

Standalone page:

- `communications.html`

Tabs:

- Transactional
- Marketing

Gym-level storage:

- `gym_communication_settings`
- `gym_email_templates`

Gym-controlled settings include:

- email brand name
- From email preference
- optional Reply-to
- brand colour
- logo URL
- footer
- subject
- preheader
- heading
- body
- button text

Protected template variables include:

- `{{gym_name}}`
- `{{invited_by}}`
- `{{role}}`

Default managed sender:

`noreply@hybridone.co.uk`

Reply-to is optional.

Custom gym-owned From domains require verification.

Marketing is currently infrastructure/roadmap only and should remain a separate sending stream with consent/unsubscribe/deliverability controls.

---

## 11. Email ownership principle

Explicit product rule:

> **The gym owns the customer relationship. HybridOne is the engine underneath.**

If a journey starts from a gym-specific login, it should remain gym-branded:

- login
- forgotten password
- reset email
- reset page
- confirmation
- magic/sign-in link
- staff/admin invitation
- welcome/onboarding

The same email address may belong to several gyms. The login context determines the gym.

For staff/admin flows, show both brands: gym first, Powered by HybridOne second.

---

## 12. Current email/Auth implementation

Resend:

- `hybridone.co.uk` verified
- sending enabled
- current Supabase custom SMTP uses Resend

Current relevant live Edge Functions verified on 24 September:

- `send-access-invite` v8 ACTIVE
- `admin-create-staff-with-level` v1 ACTIVE
- `admin-create-staff` v1 ACTIVE

Other active project functions exist for Strava, class calendar and demo seeding.

### Important: `send-auth-email` is NOT live

Dev contains:

- `supabase/functions/send-auth-email/index.ts`
- `scripts/email_hook_smoke.py`
- CI protection in `.github/workflows/hybrid-smoke.yml`

The source is intended to support tenant-aware Auth email delivery.

However, the live Supabase Edge Function list **does not contain `send-auth-email`**.

Therefore:

- it is source/groundwork only
- it is not the active Send Email Hook
- live Auth email still uses the project-wide SMTP route
- do not claim per-gym Auth From headers are live

### Safe activation sequence

Before enabling Supabase Send Email Hook:

1. provision Resend API secret for the function
2. provision Supabase webhook signing secret
3. deploy `send-auth-email`
4. configure Auth Send Email Hook
5. run browser/incognito test matrix
6. only then consider production promotion

Do not activate the hook without secrets. That would break Auth email.

---

## 13. Dev-only tenant/Auth hardening

Dev contains work not yet reconciled into main:

- pending Admin/Owner guard bound to explicit gym context
- member/integrations/social flows bound to explicit gym context
- gym-bound password reset
- gym-bound magic link
- `auth-return.html`
- tenant-aware `send-auth-email` source
- Auth email hook smoke protection

Relevant commits include:

- `1b50de5e...` — Bind pending access guard to active gym context
- `27914b35...` — Protect gym-bound pending access guard
- `2efbb469...` — Bind member-facing flows to explicit gym context
- `0a258aea...` — Add gym-bound password reset and magic-link flows
- `823348f8...` — Add tenant-aware Supabase Send Email Hook source
- `cae0524f...` — Add Auth email hook smoke protection
- `155d200c...` — Gate CI on Auth email hook contracts
- `9f0ab03d...` — Document Auth email continuation checkpoint

This needs browser testing before production reconciliation.

---

## 14. Auth test matrix

Before promoting the current dev Auth work, test:

1. Hybrid Hub Owner login
2. Puffin Performance login
3. same Auth account entering each gym independently
4. sign out and return through correct gym login
5. password reset from Hybrid Hub
6. password reset from Puffin Performance
7. magic-link sign-in from each gym
8. member signup confirmation
9. Admin invite in fresh incognito
10. existing account accepting invite
11. new account accepting invite
12. wrong account already signed in
13. expired/revoked invite
14. Owner invite with one Owner
15. Owner invite with multiple Owners
16. refresh/back on mobile
17. iPhone admin drawer
18. Staff & Resources mobile layout

---

## 15. Supabase egress incident

Historic request storm caused roughly 15 GB egress on Free.

Evidence showed about 16.9 million authenticated PostgREST request initialisations while normal successful queries were only in the low thousands.

Conclusion:

- software/client regression
- not normal HybridOne scale

Protection includes:

- `supabase-request-guard.js`
- >100 REST/Function calls in 10 sec circuit breaker
- 60 sec protected block after trip
- user-visible warning
- social polling reduced from 30 sec to 5 min
- exact gym context
- smoke protection

Do not casually reset historical Postgres statement statistics while they remain diagnostically useful.

Longer-term scale hardening:

```
session
-> gym context
-> permissions
-> shared Supabase client
-> request deduplication/cache
-> lightweight observability
```

---

## 16. Classes, scheduling and workouts

Scheduling files include:

- `classes.html`
- `class-setup.html`
- `scheduling-engine.js`
- `calendar-mobile.js`
- `calendar-views.js`
- `session-manager.js`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Existing scheduling logic already handles capability, hours, clashes, resources and capacity. Do not build a second scheduler without checking current code.

Workout rule:

> **One workout is a multi-activity session, not one exercise.**

Primary builder:

- `workout-builder.html`

Direction:

- multiple exercises/blocks
- staff/PT push to member
- optional WOD
- completion/progress

---

## 17. Member and community experience

Member files include:

- `member.html`
- `member-preview.html`
- `member-experience.js/css`
- `member-coach.js/css`

Direction:

- training-first home
- class booking
- workouts
- PBs
- PT
- membership
- profile/account
- integrations
- community
- access

Community/social files include:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`
- `social-notifications.js`
- `community.html`

Keep egress-safe polling.

---

## 18. Security rules

Always preserve:

- no service-role secrets in browser source
- publishable browser credentials only
- RLS on exposed tenant data
- exact gym scoping
- server-side checks for sensitive actions
- pending access restrictions
- Owner/Admin governance in database as well as UI
- no email-to-gym inference
- no weakening RLS for convenience
- security-definer functions validate caller permissions
- narrow RPCs/views instead of broad grants

---

## 19. Smoke and CI

Primary workflow:

- `.github/workflows/hybrid-smoke.yml`

It runs:

```
python3 scripts/build_site.py
python3 scripts/smoke_test.py _site
python3 scripts/email_hook_smoke.py
```

Protected contracts include:

- JS syntax
- built-site shell
- request guard
- explicit gym context
- invite flows
- HybridOne casing
- Communications
- Access Levels
- admin-shell routing
- critical rendering hashes
- Auth email hook source

Do not weaken smoke tests just to make CI green.

---

## 20. Immediate priorities

Recommended order:

### 1. Reconcile main/dev intentionally

Preserve:

- main production mobile/iPhone fixes
- dev tenant/Auth hardening
- latest Staff & Resources mobile layout on both

### 2. Browser-test dev Auth work

Run the full multi-gym test matrix.

### 3. Finish gym-owned Auth email delivery

Only deploy/enable `send-auth-email` after secrets and browser testing are ready.

### 4. Complete Access Level enforcement

Map every checkbox to actual UI/server behaviour.

### 5. Scale hardening

Shared data/context, request dedupe and observability.

### 6. External trial readiness

Re-test tenant isolation, governance, permissions, memberships, scheduling, workouts, reporting, email and mobile.

---

## 21. Parked/lower priority

Unless explicitly reopened:

- Gym Layout is parked
- marketing campaigns are future Communications work
- payment collection should not block initial rollout until provider flows are fully tested

---

## 22. How the next chat should start

1. Read this file.
2. Fetch latest `main` and `dev`.
3. Compare them before editing.
4. Treat the functional checkpoints above as historical anchors, not guaranteed current heads.
5. Confirm Vercel still builds `_site`.
6. Check GitHub smoke status.
7. Inspect active Supabase Edge Functions before claiming anything is live.
8. Do not infer promotion from a green hourly workflow while branches diverge.
9. Continue one workstream at a time.

Most likely next workstream:

**reconcile main/dev -> browser-test gym-bound Auth -> finish tenant-owned Auth email delivery**

Alternative:

**granular Access Level enforcement sweep**

---

## 23. Fast continuation summary

- HybridOne is a multi-tenant hybrid-gym SaaS.
- Hybrid Hub is the main pilot/demo tenant and is not yet a live operating gym.
- Repository: `PerranporthAFCMens/HybridOS`.
- Supabase project: `mzgnhmeydhhpzgxlgudh`.
- Functional main checkpoint before this docs refresh: `784bac0...`.
- Functional dev checkpoint before this docs refresh: `e82bf510...`.
- Main Vercel status was success.
- Dev smoke status was success.
- Branches diverge. Do not blindly merge.
- Production and dev must both use `build_site.py -> _site`.
- The login route determines the gym. Email never determines gym.
- Gym brand is primary. Staff/Admin shows Powered by HybridOne.
- Staff access uses Owner-created levels. Every active Staff/Coach requires one.
- Communications is standalone. Default managed sender: `noreply@hybridone.co.uk`.
- `send-access-invite` v8 is live.
- `admin-create-staff-with-level` v1 is live.
- `send-auth-email` is **not live**.
- Live Auth mail still uses project-wide SMTP.
- Supabase request-storm protection is deployed.
- Hourly production workflow currently skips because branches diverge.
- Verify real browser behaviour before saying something is fixed.
