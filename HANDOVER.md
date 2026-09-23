# HybridOne technical handover

**Updated: 23 September 2026**

This is the authoritative continuation brief for HybridOne. Read it before changing code, database policy, Auth, email, deployment or navigation behaviour.

---

## 1. Product

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

The main pilot tenant is **Hybrid Hub**. It is still a test/demo tenant, not a live operating customer gym, so reviewed work can be promoted more freely than it could be after customer launch.

HybridOne is completely separate from Football PA.

Development preferences:

- British English
- no em dashes
- inspect current code before changing it
- make coherent, reviewable changes
- verify deployed behaviour before calling something fixed
- do not preserve obsolete production behaviour purely because it is old
- do not weaken tenant/security controls for convenience

---

## 2. Repository, branches and current checkpoint

Repository:

`PerranporthAFCMens/HybridOS`

Branches:

- `main` - production source
- `dev` - development source

### Current functional heads before this documentation refresh

Production/main:

- `d6acf67eee9099227fe059a73939f5fee02e5da1`
- **Fix mobile admin drawer navigation on iPhone**
- Vercel production status: success
- hourly production release workflow: succeeding

Development/dev:

- `e20d5985a39c37403a82e89bdfab98f787de443b`
- **Protect explicit mobile admin navigation**
- includes additional tenant/Auth hardening not yet promoted

Current branch relationship:

- merge base: `97c3c3390f7c1fb510315ecbc33ec379956e3654`
- `dev` is ahead of `main` with the Auth-email groundwork
- `main` contains a production iPhone mobile-navigation fix not yet reconciled into `dev`

**Do not blindly fast-forward either branch.** Reconcile the mobile fix with the dev Auth work before the next production promotion.

Production:

- `https://www.hybridone.co.uk`
- `https://www.hybridone.co.uk/hybrid-hub`
- `https://www.hybridone.co.uk/puffin-performance`

Supabase project:

- `mzgnhmeydhhpzgxlgudh`

Monday board:

- **HybridOne Development**
- board ID `5104590878`

---

## 3. Critical deployment architecture

This caused a major production mismatch on 22 September 2026.

The GitHub Pages dev preview is **not raw repository output**. It runs:

```
source
-> scripts/build_site.py
-> _site
-> scripts/smoke_test.py _site
-> GitHub Pages
```

The build injects and normalises shared CSS/runtime, admin shell behaviour, tenant branding, navigation, diagnostics, member/staff/social runtime assets and cache-busted asset URLs.

Production originally served the raw repository directly, so copying `dev` to `main` still produced a different-looking live app.

That was fixed in:

- `d34e96d6f9c0d5a5807a86cc0632ec091c6e9245`
- **Build production from the same site output as dev**

Current `vercel.json` must keep:

```json
"buildCommand": "python3 scripts/build_site.py",
"outputDirectory": "_site"
```

`scripts/build_site.py` uses:

- `VERCEL_GIT_COMMIT_SHA` on Vercel
- `GITHUB_SHA` on GitHub Actions
- `dev` only as a fallback

The user confirmed the resulting production/dev visual parity fix worked.

### Rule

When debugging UI differences, compare the **built `_site` output**, not raw source files.

Never remove the Vercel build/output configuration without proving the replacement against the same built-site smoke suite.

---

## 4. Routing and gym context

Core rule:

> **The login route decides the gym. The email address does not.**

One Auth account may belong to multiple gyms. The user should enter each gym through that gym's dedicated login page.

Gym context is stored in:

```
sessionStorage['hybrid-gym-id']
```

Known tenant IDs:

Hybrid Hub:

```
242f57c2-6e37-4977-b3c5-1c87de7d0b98
```

Puffin Performance:

```
aec16956-3793-4543-873b-4412646ca1eb
```

Production routes:

- `/` -> marketing landing
- `/hybrid-hub` -> Hybrid Hub login
- `/puffin-performance` -> Puffin Performance login
- `/app` -> app entry

Owner/Admin login enters:

```
admin.html?gym_id=<gym id>
```

not the legacy top-level `index.html` dashboard.

Do not reintroduce:

- `.limit(1)` first-membership selection
- first-active-gym inference
- tenant inference from email
- a generic gym picker as the primary routing model

---

## 5. Admin shell and navigation

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

Desktop uses the persistent admin shell and embeds admin content pages.

The menu order currently includes:

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
- Account
  - Sign out

Reporting deliberately sits **above View as**.

### Current mobile branch divergence

Production/main contains:

- `d6acf67...` - iPhone mobile drawer navigation fix

Dev contains its own explicit-mobile-navigation commits:

- `bf1625ab...` - Make mobile admin drawer navigation explicit
- `e20d5985...` - Protect explicit mobile admin navigation

Before promoting dev, compare/reconcile these implementations rather than overwriting main's working mobile fix.

---

## 6. Branding rules

Public product spelling is always:

**HybridOne**

Never ship user-facing `HYBRIDONE`.

Smoke protection exists for this casing.

Brand hierarchy:

### Member/customer

- gym brand first
- HybridOne discreetly attributed

### Staff/Admin

- gym brand first
- HybridOne also visible because staff are using the platform
- preferred attribution: **Powered by HybridOne**

### Platform marketing

- HybridOne first

Staff/Admin invite landing pages must resolve the gym from the secure invite and display the gym brand plus HybridOne, not a generic HybridOne marketing splash.

Important commit:

- `b119ccd1da8845be36b46a9aece8489b1e11f932`
- **Use tenant branding on staff invite landing**

---

## 7. Owner/Admin access

Primary UI:

- `admin-access.html`
- `admin-invite.html`

Implemented:

- individual accounts
- Owner and Admin roles
- pending / active / revoked access
- email-first invitations
- secure invite links
- wrong-account detection
- Owner approval
- equal-Owner governance
- invite revocation/deletion
- retryable invite sends

Important RPCs include:

- `create_email_access_invite`
- `approve_email_owner_invite`
- `create_shareable_access_invite`
- `approve_shareable_owner_invite`
- `get_access_invite`
- `claim_access_invite`
- `prepare_email_invite_token`
- `approve_pending_access`

The historical ambiguous `target_user_id` Owner-action SQL bug has been fixed.

Current live invite Edge Function:

- `send-access-invite`
- ACTIVE
- version **8**
- JWT verification enabled

The Admin Access UI has HybridOne-styled success feedback and send/retry behaviour.

Production Hybrid Hub is the correct environment for inviting trusted reviewers who should see the real-looking app. Admin access is genuine admin access to pilot data.

---

## 8. Staff Access Levels

The product rule is:

> **Every active Staff/Coach account must have one Access Level.**

Staff access is not based on fixed hard-coded presets.

Owner workflow:

1. create a level
2. give it any name
3. choose exactly what it contains with checkboxes
4. save the level
5. assign staff to it
6. later edit the level and propagate the updated permissions to everyone assigned

Primary UI:

- `staff-permissions.html`
- `admin-operations.html`

Database/backend:

- `staff_access_levels`
- `staff_access.access_level_id`
- `assign_staff_access_level`
- `provision_staff_membership_with_level`
- `private.has_gym_staff_permission`
- permission propagation trigger
- `admin-create-staff-with-level` Edge Function

`staff_access.access_level_id` is NOT NULL.

Latest database check:

- active Staff/Coach accounts without a level: **0**

Hybrid Hub levels currently:

- Coach / PT - 1 assigned
- Reception - 1 assigned
- Manager - 0 assigned
- Manager 2 - 0 assigned

Only an **Owner** may create, rename, redefine or delete Access Level definitions.

Admins and staff with `manage_staff` may assign existing levels, but must not redefine what those levels contain.

Example intent:

- **Manager**: broad operational access, no staff/access changes
- **Manager 2**: broad operational access including staff/access changes

These are examples, not fixed product roles.

### Remaining Access Levels work

A full permission-enforcement sweep is still required across every page, button and server action.

Do not assume every historical Owner/Admin/`full_access` check already respects each granular permission checkbox.

---

## 9. Communications

Communications is a standalone admin page:

- `communications.html`

Tabs:

- **Transactional**
- **Marketing** (foundation/roadmap only)

Gym-level storage:

- `gym_communication_settings`
- `gym_email_templates`

Transactional settings support:

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

Protected variables include:

- `{{gym_name}}`
- `{{invited_by}}`
- `{{role}}`

Default managed sender presented by the product:

```
noreply@hybridone.co.uk
```

Reply-to is optional.

Custom gym-owned From domains must be verified before they can actually send.

Latest database check:

- Hybrid Hub has no saved communication settings/templates yet
- Puffin Performance has no saved communication settings/templates yet

Therefore both currently fall back to product defaults until the gym saves settings.

Marketing should share branding/audience infrastructure but remain a separate sending stream with its own consent, unsubscribe and deliverability controls.

---

## 10. Email ownership principle

The user explicitly set this rule:

> **The gym owns the customer relationship. HybridOne is the engine underneath.**

If a user starts from a gym-specific login, the whole journey should remain gym-branded:

- login
- forgotten password
- password-reset email
- reset page
- account confirmation
- magic/sign-in link
- staff/admin invitation
- welcome/onboarding email

The same email address may belong to multiple gyms. The login context, not the email, determines the gym.

For staff/admin journeys, show both brands: gym first, Powered by HybridOne second.

---

## 11. Live email infrastructure

Resend:

- `hybridone.co.uk` verified
- region: EU West
- sending enabled
- receiving disabled
- open tracking disabled
- click tracking disabled

Supabase currently has custom SMTP using Resend.

Live Edge Functions relevant to access/email include:

- `send-access-invite` v8 ACTIVE
- `admin-create-staff-with-level` v1 ACTIVE

### Important: `send-auth-email` is NOT live

Dev contains source at:

```
supabase/functions/send-auth-email/index.ts
```

and CI protection at:

```
scripts/email_hook_smoke.py
```

The source implements tenant-aware Auth email handling using:

- Supabase Send Email Hook payloads
- Standard Webhook signature verification
- exact gym context from redirect/invite
- gym communication settings/templates
- Resend
- idempotency keys
- fallback `noreply@hybridone.co.uk`

However, the current Supabase Edge Function list **does not contain `send-auth-email`**.

Therefore:

- it is dev groundwork only
- it is not the active Supabase Auth Send Email Hook
- live Auth emails still use the existing project-wide SMTP path

Do not claim per-gym Auth From headers are live yet.

### Safe activation sequence

Before activating the Send Email Hook:

1. provision `RESEND_API_KEY` securely in the Edge Function environment
2. provision `SEND_EMAIL_HOOK_SECRET`
3. deploy `send-auth-email`
4. configure Supabase Auth Send Email Hook to the endpoint
5. run the full browser/incognito Auth matrix
6. only then consider promoting the dev Auth work to production

Activating the hook without the required secrets would break Auth email delivery.

---

## 12. Dev-only Auth/tenant hardening

The current `dev` branch includes work not yet promoted to `main`:

- pending Admin/Owner access guard bound to explicit gym context
- member/integrations/social pages no longer selecting first active membership
- gym-bound password-reset flow on dedicated gym login pages
- gym-bound magic-link flow
- new `auth-return.html`
- public signup confirmation carrying explicit `gym_id`
- version-controlled tenant-aware Send Email Hook source
- Auth email hook CI smoke checks

Relevant dev commits include:

- `1b50de5e...` - Bind pending access guard to active gym context
- `27914b35...` - Protect gym-bound pending access guard
- `2efbb469...` - Bind member-facing flows to explicit gym context
- `0a258aea...` - Add gym-bound password reset and magic-link flows
- `823348f8...` - Add tenant-aware Supabase Send Email Hook source
- `cae0524f...` - Add Auth email hook smoke protection
- `155d200c...` - Gate CI on Auth email hook contracts
- `9f0ab03d...` - Document Auth email continuation checkpoint

This work should be browser-tested before production promotion.

---

## 13. Auth test matrix

Before promoting the current dev Auth work, test:

1. Hybrid Hub Owner login
2. Puffin Performance login
3. same Auth account entering each gym independently
4. sign out and return through the correct gym login
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
16. refresh/back behaviour on mobile
17. iPhone mobile drawer navigation after branch reconciliation

---

## 14. Supabase egress incident

A historic request storm caused roughly 15 GB of egress on the Free plan.

The strongest evidence was approximately **16.9 million authenticated PostgREST request initialisations** while normal successful app queries were only in the low thousands.

This indicates a client/request regression, not ordinary HybridOne scale.

Protection now includes:

- `supabase-request-guard.js`
- circuit breaker for >100 protected REST/Function requests in 10 seconds
- 60-second block after trip
- visible warning
- social polling reduced from 30 seconds to 5 minutes
- exact `hybrid-gym-id` lookup instead of first-active-gym logic
- smoke protection

Production protection commit:

- `0ebbf78abdaf9ed6dbc0a6e8aba30321638d7f21`

Do not casually reset the historical Postgres statement statistics while they still have diagnostic value.

Longer-term scale hardening still needs:

```
session
-> gym context
-> permissions
-> shared Supabase client
-> request deduplication/cache
-> lightweight observability
```

---

## 15. Classes and scheduling

Key files:

- `classes.html`
- `class-setup.html`
- `scheduling-engine.js`
- `calendar-mobile.js`
- `calendar-views.js`
- `session-manager.js`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Existing scheduling/conflict logic already covers combinations of:

- staff capability
- working hours
- staff clashes
- resource availability
- resource clashes
- capacity

Do not create a second scheduling engine without checking what already exists.

---

## 16. Workouts

Product rule:

> **One workout is a multi-activity session, not one exercise.**

Examples include Legs Day, Back & Chest, Arms and Cardio.

Direction includes:

- multiple exercises/blocks
- PT/staff push to an individual member
- optional gym Workout of the Day
- member completion/progress

Primary builder:

- `workout-builder.html`

Check the current UX before marking roadmap items complete.

---

## 17. Member experience

Primary files include:

- `member.html`
- `member-preview.html`
- `member-experience.js`
- `member-experience.css`
- `member-coach.js`
- `member-coach.css`

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

Do not reduce Member Home to only a class-sales screen.

---

## 18. Community/social

Primary files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`
- `social-notifications.js`
- `community.html`

Capabilities include posts, comments/replies, reactions, edit/delete ownership, admin participation, member-home summaries and notification work.

Keep the egress-safe polling changes.

---

## 19. Security rules

Always preserve:

- no service-role secrets in browser source
- publishable frontend credentials only
- RLS on exposed tenant data
- exact gym scoping
- server-side permission checks for sensitive operations
- pending access restricted
- Owner/Admin governance enforced in database as well as UI
- no email-to-gym inference
- no weakening RLS for convenience
- security-definer functions checking their own caller permissions
- narrow RPCs/views preferred over broad grants

---

## 20. Smoke and CI protection

Primary built-site smoke test:

- `scripts/smoke_test.py`

Built-site command:

```
python3 scripts/build_site.py
python3 scripts/smoke_test.py _site
```

Dev also includes:

- `scripts/email_hook_smoke.py`

and `.github/workflows/hybrid-smoke.yml` runs it.

Protected contracts include:

- JavaScript syntax
- request guard loading
- explicit gym context
- invite flows
- HybridOne casing
- Communications
- Access Levels
- admin-shell login routing
- critical shared-rendering hashes
- tenant-safe Auth email hook source

Do not weaken smoke checks just to make CI pass.

---

## 21. Development and release flow

Normal development continues on `dev`.

GitHub Pages dev flow:

```
dev push
-> smoke
-> build_site.py
-> smoke_test.py _site
-> preview deploy
```

Vercel Git deployment is disabled for `dev`.

Production follows `main`.

The hourly production release workflow is active and was repeatedly succeeding on 23 September 2026.

Because Hybrid Hub is still a pilot, intentional direct production promotion is acceptable, but only after:

- branch reconciliation
- smoke success
- Vercel success
- actual browser verification

Do not say production is fixed solely because a commit/deployment succeeded.

---

## 22. Current priorities

Recommended order:

### 1. Reconcile main/dev safely

Preserve:

- main iPhone mobile-navigation fix
- dev tenant/Auth hardening

Do not overwrite either side blindly.

### 2. Finish gym-owned Auth email infrastructure

Deploy/configure/test `send-auth-email` only after secrets and hook verification are ready.

### 3. Run the full Auth test matrix

Especially multi-gym same-email behaviour and mobile.

### 4. Complete granular Access Level enforcement

Map every permission checkbox to real page/action/server enforcement.

### 5. Scale hardening

Shared data/context layer, deduplication and observability.

### 6. External trial readiness

Re-test tenant isolation, admin governance, staff permissions, memberships, bookings, workouts, reporting, transactional email and mobile behaviour.

---

## 23. Parked / lower priority

Unless explicitly reopened:

- Gym Layout is parked
- marketing campaigns remain a future Communications extension
- payment-provider collection should not block rollout until provider flows are fully tested

---

## 24. How the next development chat should start

1. read this file
2. fetch latest `main` and `dev`
3. compare them before making changes
4. confirm production still builds `_site`
5. inspect current Vercel status
6. inspect active Supabase Edge Functions before claiming a function is live
7. preserve main's mobile fix when reconciling dev
8. continue one workstream at a time

Most likely immediate workstream:

**reconcile main/dev -> finish gym-owned Auth email delivery -> execute Auth test matrix**

Alternative high-priority workstream:

**granular Access Level enforcement sweep**

---

## 25. Fast handover summary

- HybridOne is a multi-tenant hybrid-gym SaaS.
- Hybrid Hub is the main pilot/demo tenant, not a live operating gym.
- The login route determines the gym. Email never determines gym.
- Production and dev both rely on `scripts/build_site.py -> _site`.
- The old production/dev visual mismatch is fixed and must not be reintroduced.
- `main` functional head before this docs refresh is `d6acf67...`.
- `dev` functional head before this docs refresh is `e20d598...`.
- The branches currently diverge. Reconcile them intentionally.
- Main contains the production iPhone mobile-nav fix.
- Dev contains tenant/Auth hardening and Send Email Hook source.
- `send-auth-email` is **not deployed or active** in Supabase yet.
- Live Auth email still uses the existing project-wide SMTP path.
- Resend `hybridone.co.uk` is verified, EU West, sending enabled.
- Gym branding is primary. HybridOne is discreet for members and visible as Powered by HybridOne for staff/admin.
- Staff permissions use Owner-created Access Levels.
- Every active Staff/Coach must have a level; current missing count is 0.
- Hybrid Hub currently has Coach / PT and Reception assignments, with Manager and Manager 2 available.
- Communications is standalone. Default managed sender is `noreply@hybridone.co.uk`; Reply-to is optional.
- Hybrid Hub and Puffin Performance currently have no saved Communication rows/templates, so defaults apply.
- Supabase egress protection is deployed.
- Next priorities are safe branch reconciliation, Auth email completion/testing, granular permission enforcement and scale hardening.
- Monday board ID: `5104590878`.
- Verify real deployed behaviour before saying something is fixed.
