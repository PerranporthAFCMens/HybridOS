# HybridOne technical handover

**Updated: 22 September 2026**

This is the authoritative continuation brief for the next HybridOne development chat.

Read this before touching the codebase.

---

## 1. Product and user intent

HybridOne is a multi-tenant operating system for hybrid gyms.

Core areas include:

- memberships
- members
- classes and scheduling
- workouts/programming
- staff
- community/social
- reporting
- member experience
- communications
- gym operations/access

The current pilot/test tenant is **Hybrid Hub**. It is not yet a live working customer gym, so reviewed dev work can be promoted to production while the product is still being hardened.

HybridOne is completely separate from Football PA. Do not edit Football PA from this repository unless explicitly asked.

User preferences for development work:

- British English
- no em dashes
- one clear change at a time
- inspect current code before rebuilding anything
- verify real deployed behaviour before saying something is fixed
- keep production safe, but do not preserve obsolete production code purely because it is old
- if dev has the approved UI, production should actually serve the same built result

---

## 2. Current source and environment checkpoint

Repository:

`PerranporthAFCMens/HybridOS`

Branches:

- `main` - production source
- `dev` - development source

Last functional checkpoint before this documentation update:

- `d34e96d6f9c0d5a5807a86cc0632ec091c6e9245`
- message: **Build production from the same site output as dev**

At that checkpoint:

- Vercel production deployment: success
- main built-site smoke suite: success
- dev built-site smoke suite: success
- GitHub Pages dev preview: success
- user confirmed the production visual parity fix worked

Production:

- `https://www.hybridone.co.uk`
- `https://www.hybridone.co.uk/hybrid-hub`
- `https://www.hybridone.co.uk/puffin-performance`

Supabase:

- project ref: `mzgnhmeydhhpzgxlgudh`
- region: London / eu-west-2

Monday:

- board: **HybridOne Development**
- board ID: `5104590878`

---

## 3. Critical production/dev parity lesson

This caused a major production mismatch on 22 September 2026.

### What happened

The GitHub Pages dev preview ran:

```
scripts/build_site.py
```

and served the generated:

```
_site
```

The build injects and normalises:

- shared app CSS
- admin shell CSS
- admin page CSS
- shared shell runtime
- admin embed runtime
- admin navigation
- tenant branding
- diagnostics
- member/staff/social runtime assets
- cache-busted asset URLs

Vercel production was serving the **raw repository files**, not `_site`.

Therefore copying `dev` into `main` did **not** make production visually identical to dev.

### Current fix

`vercel.json` now contains a Vercel build command:

```
python3 scripts/build_site.py
```

and output directory:

```
_site
```

`scripts/build_site.py` uses:

- `VERCEL_GIT_COMMIT_SHA` on Vercel
- `GITHUB_SHA` on GitHub Actions
- `dev` only as a final fallback

This keeps the dev preview and production on the same build transformation and provides proper asset cache-busting.

### Rule

**Never compare raw source output with the dev preview as though they are the same thing.**

When debugging a production visual mismatch:

1. inspect `scripts/build_site.py`
2. inspect Vercel `buildCommand` and `outputDirectory`
3. run/test `_site`
4. verify the deployed page, not just the Git commit

Do not remove the Vercel build configuration without a proven replacement.

---

## 4. Hosting and routes

`vercel.json` is the production routing/build configuration.

Current clean routes:

- `/` -> `landing.html`
- `/hybrid-hub` -> `hybrid-hub-login.html`
- `/puffin-performance` -> `puffin-performance-login.html`
- `/app` -> `index.html`

Vercel Git deployment is disabled for `dev`.

GitHub Pages is the dev preview.

The safe preview flow is:

```
dev push
-> smoke workflow
-> build_site.py
-> smoke_test.py _site
-> GitHub Pages
```

The production build now also uses `build_site.py -> _site`.

---

## 5. Login and tenant architecture

This rule is non-negotiable:

> **The URL/login route decides the gym. The email does not.**

The same user account may belong to more than one gym.

Current context key:

```
sessionStorage['hybrid-gym-id']
```

Known gym IDs:

Hybrid Hub:

```
242f57c2-6e37-4977-b3c5-1c87de7d0b98
```

Puffin Performance:

```
aec16956-3793-4543-873b-4412646ca1eb
```

Dedicated gym login pages set the fixed gym ID.

Owner/Admin gym login now redirects to:

```
admin.html?gym_id=<gym id>
```

not directly to the legacy `index.html` top-level layout.

Important commit:

- `6dc85e66e437febc30564afd30c92f1b27360061`
- **Route gym logins into polished admin shell**

The invite acceptance page also opens the admin shell after acceptance.

Do not reintroduce:

- first active membership selection
- `.limit(1)` tenant selection
- email-address-to-gym inference
- a gym picker as the primary routing model

If no valid gym context exists, fail safely or return the user to the relevant gym login.

---

## 6. Desktop admin shell

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

Desktop `admin.html` owns the persistent admin navigation and loads admin pages into the content frame.

The built admin pages are modified by `build_site.py` for embedded rendering.

On small screens, the shell has a different/top-level behaviour. There is historical baggage around iframe/mobile shell experiments. Do not reintroduce old grey-band or nested-shell behaviour without reproducing the issue first.

The Reporting nav item now sits above the **View as** section.

---

## 7. Branding rules

Public product spelling is:

**HybridOne**

Do not ship:

`HYBRIDONE`

as user-facing text.

A smoke guard now fails if that literal uppercase brand appears in customer-facing source.

### Brand hierarchy

Member/customer:

- gym identity first
- HybridOne discreet attribution

Staff/Admin:

- gym identity first
- HybridOne also visible because staff are using the platform
- preferred wording: **Powered by HybridOne**

Platform marketing:

- HybridOne first

### Staff/Admin invite landing

The invite landing must not show a generic HybridOne marketing splash when the invite is for a gym.

The secure invite token is authoritative. The landing resolves the invite/gym and renders:

- gym identity prominently
- invite details
- Powered by HybridOne secondarily

Important commit:

- `b119ccd1da8845be36b46a9aece8489b1e11f932`
- **Use tenant branding on staff invite landing**

---

## 8. Owner/Admin access and invites

Primary UI:

- `admin-access.html`
- `admin-invite.html`

Core ideas:

- individual accounts, no shared passwords
- Owner
- Admin
- pending / active / revoked
- email-first invitation
- secure shareable link
- invite expiry
- invite revocation/deletion
- wrong-account detection
- Owner approval
- equal Owner governance

Important RPCs include:

- `create_email_access_invite`
- `approve_email_owner_invite`
- `create_shareable_access_invite`
- `approve_shareable_owner_invite`
- `get_access_invite`
- `claim_access_invite`
- `prepare_email_invite_token`
- `approve_pending_access`

The historical ambiguous `target_user_id` SQL bug in Owner promotion/removal was fixed using unambiguous local variables/aliases.

### Equal Owner model

Once a gym has multiple active Owners, Owner-level governance uses the approval model. Do not introduce a hidden primary-owner privilege.

### Invite sending

Edge Function:

- slug: `send-access-invite`
- status: ACTIVE at this handover
- version: **8**
- JWT verification: enabled

The Edge Function:

1. validates the requesting Owner
2. loads the invite
3. prepares a secure invite token
4. loads sender profile
5. loads gym communication settings
6. loads the gym `access_invite` email template
7. passes gym-specific metadata into the Auth email request
8. records send state

The Admin Access UI includes send/retry behaviour and a HybridOne-styled toast instead of the old browser alert for successful sends.

---

## 9. Staff accounts and Access Levels

The user explicitly requested **levels**, not scattered per-person permission presets.

The product model is now:

**Staff/Coach account -> exactly one Access Level -> permission checklist**

Primary UI:

- `staff-permissions.html`
- `admin-operations.html`

Database:

- `staff_access_levels`
- `staff_access.access_level_id`

Current seeded levels per gym:

- Coach / PT
- Reception
- Manager
- Manager 2

Hybrid Hub currently has:

- 1 active Coach/Staff assignment on Coach / PT
- 1 active Staff assignment on Reception
- Manager and Manager 2 available but unassigned at the checkpoint

### Owner control

Only an Owner can:

- create an Access Level
- rename it
- change its checkbox permissions
- delete an unused level

Admins and Staff/Coach with `manage_staff` may assign existing levels but may not redefine the levels.

### Example intent

Manager:

- broad operational/admin access
- no staff/access changes

Manager 2:

- broad operational/admin access
- includes staff/access changes

These are examples, not hard-coded product roles. The Owner can change them.

### Propagation

Updating a level's permissions updates the stored permission object of everyone assigned to that level through a database trigger.

### Mandatory level

Supported staff provisioning now requires an Access Level.

Relevant backend:

- `assign_staff_access_level`
- `provision_staff_membership_with_level`
- `private.has_gym_staff_permission`
- permission propagation trigger
- `admin-create-staff-with-level` Edge Function

`staff_access.access_level_id` is NOT NULL.

At the latest check there were **0 active Staff/Coach accounts without a level**.

### Remaining work

Do a full permission enforcement sweep across every admin page and server action.

Several older areas still use historical Owner/Admin or `full_access` checks. The levels UI is real and persists permissions, but every individual action must be reviewed so that each checkbox has the intended practical effect.

This is a high-priority hardening task before real external rollout.

---

## 10. Communications area

Communications is now its own page, not an inline Settings section.

Primary page:

- `communications.html`

Navigation:

- Communications appears in the main admin menu
- Reporting appears below Communications and above View as

Current tabs:

### Transactional

Functional editor for gym communication identity and access-invite template.

Gym can control:

- email brand name
- From email preference
- Reply-to email
- brand colour
- logo URL
- footer
- subject
- preheader
- heading
- body
- button text

Protected variables:

- `{{gym_name}}`
- `{{invited_by}}`
- `{{role}}`

### Marketing

Visible foundation/roadmap only.

Planned:

- campaigns
- audiences
- scheduling
- delivery/open/click/bounce metrics
- unsubscribe/consent

Marketing should share gym branding/audience infrastructure but use a separate sending stream from auth/transactional messages.

### Database

- `gym_communication_settings`
- `gym_email_templates`

RLS limits gym settings/templates appropriately.

At the latest database check, Hybrid Hub and Puffin Performance had **no saved communication-setting rows yet**, so the page uses UI defaults until the gym saves them.

Default managed sender shown by the UI:

```
noreply@hybridone.co.uk
```

Reply-to is optional.

Custom gym-owned From domains must be verified before activation.

---

## 11. Email ownership principle

The user clarified the product rule:

**The gym owns the customer relationship. HybridOne is the engine underneath.**

If a user starts from Hybrid Hub's login, the complete journey should look and feel like Hybrid Hub:

- login
- forgotten password
- reset email
- reset page
- confirmation
- magic/sign-in link
- staff/admin invitation
- welcome/onboarding

The same person can use another gym's separate login and receive that gym's version.

Do not infer gym from email.

### Desired auth email architecture

```
gym login / redirect context
-> Supabase Auth generates secure auth token
-> Send Email Hook / HybridOne email service resolves gym
-> load gym sender + template + brand
-> Resend sends
-> branded gym return flow
```

This is the intended next step.

---

## 12. Resend / Supabase email state

Resend domain:

- `hybridone.co.uk`
- verified

Supabase custom SMTP has been configured to use Resend and real invitation email delivery was observed.

Repository template source:

- `supabase-email-invite-template.html`
- `supabase-email-magic-link-template.html`

The invite Edge Function already reads gym-level Communications settings and template data.

### Limitation that remains

Supabase SMTP/Auth sender configuration is still project-level.

Therefore storing a gym-specific From address does **not yet** mean Supabase will genuinely send all Auth email From headers from that gym address.

True gym-owned sender addresses require the Send Email Hook/direct Resend layer or equivalent.

Also verify the actual hosted Supabase Auth template configuration before assuming the repo HTML is active.

---

## 13. Egress incident and protection

On 22 September the Supabase dashboard showed approximately:

- 5 GB Free included egress
- about 15.06 GB used
- about 10.06 GB over the free quota

Evidence from `pg_stat_statements` showed roughly **16.9 million authenticated PostgREST request initialisations**, while normal successful application query counts were only in the low thousands.

The live counter later remained flat over repeated samples.

Conclusion:

- this was a request storm/regression
- it was not normal HybridOne usage
- the exact historical client line could not be proven after the fact
- timing aligned with heavy admin shell/navigation work

### Protection deployed

`supabase-request-guard.js`:

- wraps browser `fetch`
- protects this Supabase project's `/rest/v1/` and `/functions/v1/`
- >100 protected requests within 10 seconds trips the guard
- blocks protected requests for 60 seconds
- returns synthetic 429
- stores a session flag
- logs an error
- emits a browser event
- displays a visible warning

Social polling:

- changed from 30 seconds to 5 minutes
- still refreshes on relevant user activity/focus
- changed to exact `hybrid-gym-id` membership lookup

Production egress-protection commit:

- `0ebbf78abdaf9ed6dbc0a6e8aba30321638d7f21`

Do not reset historical Postgres statement statistics casually because they preserve evidence of the incident.

### Scale-hardening recommendation

Next architecture should introduce a shared data/context layer:

```
session
-> gym context
-> permissions
-> shared Supabase client
-> request deduplication/cache
```

Add low-overhead observability for calls/day, calls/user and sudden request spikes. Do not create a telemetry API request for every API request.

---

## 14. Production promotion history

Important recent commits:

- `0ebbf78a` - production egress circuit breaker
- `8a0b71f0` - reconciled dev with production egress history
- `b119ccd1` - tenant branding on staff invite landing
- `4c34c6e4` - merged reviewed dev into production
- `6dc85e66` - gym logins route into admin shell
- `d34e96d6` - Vercel production builds the same `_site` output as dev

The user explicitly confirmed the final production parity fix worked.

Do not roll production back to the earlier raw-source Vercel configuration.

---

## 15. Hybrid Hub pilot status

Hybrid Hub is the principal test tenant.

It is currently safe to use as a real-looking production demonstration because it is not yet an operational customer gym.

Current production and dev should start from the same source/build baseline after an intentional promotion.

The user wants to invite trusted people into **production Hybrid Hub** for a look around rather than sending them to the dev preview.

Owner can use:

- production Hybrid Hub login
- Staff management / Admin Access
- Admin invitation

Remember: Admin access is real administrative access to the pilot data. Access Levels are the better model for restricted staff access.

---

## 16. Main owner/admin product areas

Main navigation currently includes:

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

Owner/Admin access/governance remains inside Staff management.

Do not recreate pages that already exist without inspecting the current code.

---

## 17. Workouts

Product rule:

**One workout is a multi-activity session, not one exercise.**

Examples:

- Legs Day
- Back & Chest
- Arms
- Cardio

Direction includes:

- multiple exercises/blocks
- PT/staff push to an individual member
- optional gym WOD soft-push
- member completion/progress

Primary builder:

- `workout-builder.html`

Monday still tracks this work. Do not mark complete without checking the actual current UX and member flow.

---

## 18. Classes and scheduling

Key files:

- `classes.html`
- `class-setup.html`
- `scheduling-engine.js`
- `calendar-mobile.js`
- `calendar-views.js`
- `session-manager.js`
- `class-admin-enhancements.js`
- `class-admin-live-refresh.js`

Existing scheduling/conflict logic covers combinations of:

- staff capability
- working hours
- staff clashes
- resource availability
- resource clashes
- capacity

Do not create a second scheduling engine if existing logic/RPCs already solve the problem.

Class drop-in pricing and membership-aware booking remain in active/testing roadmap state.

---

## 19. Member experience

Primary files include:

- `member.html`
- `member-preview.html`
- `member-experience.js`
- `member-experience.css`
- `member-coach.js`
- `member-coach.css`

Member direction:

- training-first Home
- class booking
- workouts
- PBs
- PT
- membership
- profile/account
- integrations
- social/community
- access

Do not turn Member Home into only a commercial class-sales screen.

---

## 20. Community/social

Primary files:

- `social.html`
- `social-enhancements.js`
- `social-nav.js`
- `social-notifications.js`
- `community.html`

Capabilities include:

- posts
- comments/replies
- reactions
- edit/delete ownership
- admin participation
- member-home summaries
- notification work

The social polling reduction described in the egress section must remain.

---

## 21. Monday board state

Board:

**HybridOne Development**

ID:

`5104590878`

Workspace:

**Development Projects**

The board is the operational roadmap. Keep it synchronised with actual implementation rather than using it as aspirational documentation.

This handover and README are the technical source of truth. Monday tracks delivery state.

Key new/updated areas that must be represented in Monday:

- production/dev build parity
- Supabase egress protection
- Communications centre
- gym-owned auth email delivery
- Staff Access Levels
- full permission enforcement sweep
- Hybrid Hub pilot/auth hardening

---

## 22. Security rules

Always preserve:

- no service-role keys in browser/repo
- publishable frontend credentials only
- RLS on exposed tenant data
- explicit gym scoping
- server-side permission checks for sensitive operations
- pending access restricted
- Owner/Admin governance enforced in database as well as UI
- social ownership rules
- no weakening RLS for convenience
- narrow RPCs/views preferred to broad table grants

Security-definer functions must perform their own role/permission checks.

---

## 23. Smoke tests and regression protection

Primary:

- `scripts/smoke_test.py`

Built-site testing:

```
python3 scripts/build_site.py
python3 scripts/smoke_test.py _site
```

Important protected contracts now include:

- JavaScript syntax
- request guard loading
- explicit gym context
- invite flows
- HybridOne casing
- Communications page contract
- staff Access Levels contract
- login entering admin shell
- critical shared-rendering hashes

Do not weaken the suite to make a deployment green.

If a reviewed visual/shared-shell file changes intentionally, update its expected hash only after checking the impact.

---

## 24. Known remaining work

Highest priority:

### A. Gym-owned Auth emails

Implement and test the Send Email Hook/direct Resend layer so:

- password resets
- confirmations
- magic links
- staff/admin invites
- welcome emails

all inherit the gym login context and genuinely use the configured sender identity.

### B. Granular Access Level enforcement sweep

Map every permission checkbox to:

- navigation visibility where appropriate
- page-level access
- action/button availability
- server/RPC permission checks

Do not rely only on client-side hiding.

### C. Auth test matrix

Test in real browsers/incognito:

1. Hybrid Hub Owner login
2. Puffin Performance login
3. same account in different gym routes
4. sign out/switch gym
5. Admin invite in fresh incognito
6. wrong account already signed in
7. existing account accepts invite
8. new account accepts invite
9. password reset
10. email confirmation
11. magic/sign-in link
12. Owner invite with one Owner
13. Owner invite with multiple Owners
14. expired/revoked invite
15. refresh/back on mobile

### D. Egress/data architecture

Build shared client/context/deduplication + observability before significant scale.

### E. External trial readiness

Before a true customer rollout, re-test:

- tenant isolation
- Owner/Admin governance
- Access Levels
- memberships
- booking/drop-in behaviour
- workouts
- staff flow
- member flow
- reporting
- transactional email
- mobile

---

## 25. Parked/non-priority areas

Gym Layout remains parked unless explicitly reopened.

Payment-provider collection should not become a rollout dependency until provider flows are fully tested.

Marketing campaigns are a future Communications extension, not the current auth-delivery priority.

---

## 26. How the next chat should start

The next chat should not rebuild or redesign the project.

Start in this order:

1. read this file
2. fetch latest `main` and `dev`
3. confirm whether they are aligned
4. inspect the current Vercel `vercel.json`
5. confirm production still builds `_site`
6. inspect Monday board `5104590878`
7. decide the next single workstream with the user

If continuing the most likely current work, start with:

**gym-owned auth email delivery + end-to-end auth testing**

or, if the user chooses staff security:

**granular Access Level permission enforcement sweep**

Do not reopen production/dev visual parity unless there is new evidence of a mismatch. The user confirmed the `d34e96d6` fix worked.

---

## 27. 22 September continuation checkpoint

Work completed after the original documentation refresh:

- `admin-access-guard.js` now binds pending Owner/Admin lookup to the explicit query/session gym context instead of first active membership selection.
- `member.html`, `integrations.html` and `social.html` no longer select the first active gym membership. Each requires `sessionStorage['hybrid-gym-id']` and queries that exact `gym_id`.
- smoke protection now fails if those ambiguous tenant selectors return.
- both dedicated gym login pages now support gym-bound password reset and passwordless magic-link requests.
- new `auth-return.html` handles secure Auth return/recovery, preserves the explicit gym context, and routes only after checking that user's membership in that exact gym.
- public member signup confirmation now includes the actual `gym_id` returned by `get_public_gym_join_options`.
- new version-controlled Send Email Hook source exists at `supabase/functions/send-auth-email/index.ts`.
- the hook resolves gym branding from secure access-invite context, exact `user_id + gym_id` membership, or validated public-join signup context. It never derives gym from the recipient email.
- the hook loads `gym_communication_settings` and `gym_email_templates`, falls back to `noreply@hybridone.co.uk`, uses Resend with idempotency keys, and verifies Supabase Standard Webhook signatures.
- `scripts/email_hook_smoke.py` is now part of CI and protects the hook's tenant/security contracts.
- Resend `hybridone.co.uk` was rechecked: verified, sending enabled, EU West, open/click tracking disabled.
- the GitHub Pages dev deployment built successfully and its deployed artifact was inspected to confirm the new login/reset/magic/signup context code is present.

Current branch state at this checkpoint:

- `main` remains on the previous production/documentation checkpoint.
- `dev` is ahead with the tenant hardening and Auth-email groundwork.
- do not merge/promote these changes to `main` until the Auth flows have been exercised in the browser test matrix.

Important activation boundary:

- the `send-auth-email` source is **not yet active as the Supabase Auth Send Email Hook**.
- an attempted deployment through the connected tooling was blocked before changing Supabase.
- do not enable the Auth hook until both `RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET` are securely present in the Edge Function environment and the function has been compiled/deployed.
- activating the hook without those secrets would break Auth email delivery.
- the existing project-wide SMTP path therefore remains the live Auth-email sender for now.

Next concrete Auth steps:

1. securely provision the Edge Function Resend API key and Send Email Hook signing secret
2. deploy `send-auth-email` with JWT verification disabled only because the function validates the Standard Webhook signature itself
3. configure Supabase Auth Send Email Hook to that endpoint
4. run reset, magic link, member confirmation and Admin/Owner invite tests for Hybrid Hub
5. repeat the same tests through Puffin Performance to prove the same email account can remain tenant-correct
6. verify wrong-account, expired/revoked invite and multi-Owner approval cases
7. only then promote reviewed `dev` to `main`

---

## 28. Fast handover summary

If you only read one section, read this:

- HybridOne is a multi-tenant hybrid-gym SaaS.
- Hybrid Hub is the main pilot/test tenant, not a live working gym.
- The login URL determines gym context. Email never determines gym.
- Owner/Admin production login enters `admin.html`.
- Dev and production must both run `scripts/build_site.py` and serve `_site`.
- The earlier production ugliness was caused by Vercel serving raw source while dev served built output. This is fixed.
- HybridOne casing is protected. Gym branding is primary in gym-facing flows.
- Staff permissions now use Owner-created Access Levels with checkboxes and mandatory assignment in the supported staff-creation flow.
- Communications is a standalone page with transactional email branding/template controls.
- Default managed From preference is `noreply@hybridone.co.uk`; reply-to is optional.
- True per-gym From headers for all Auth emails still need the Send Email Hook/direct Resend architecture.
- `send-access-invite` is active and reads gym communication/template metadata.
- Supabase egress had a historic request storm; browser circuit breaker + polling reduction are deployed.
- Next priorities are gym-owned Auth email delivery, auth test matrix, and granular permission enforcement.
- Monday board ID is `5104590878`.
- Inspect current code before changing anything and verify deployed behaviour before claiming success.
