# HybridOne handover

## CURRENT HANDOVER CHECKPOINT - 28 SEPTEMBER 2026

**Read this section first, then the control layer.**

Repository: `PerranporthAFCMens/HybridOS`

Current heads:

- `dev`: `35a7a80a3b6894a776dd253c94f8b47fcefc15d6`
- `main`: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- relationship: **diverged**
- dev ahead: **127**
- dev behind: **4**
- merge base: `b7d83243e9248a64978677efec91c4f9d83c1052`

Production hold: **ACTIVE**. Do not broadly merge dev into main.

### Exact current-head evidence

- smoke run `36460766581` -> PASS
- public dev runtime run `36460766735` -> PASS

Latest full universal Auth/multi-gym browser pass:

- run `36311647499` -> PASS
- SHA `9039ed4b20017580be0eb0c17034497d3cc6733b`

That full browser pass is older than the 28 Sep member-view/navigation changes.

### FIRST ISSUE FOR NEXT CHAT - GYM PICKER NOT SHOWING

The user reports:

> the gym selection picker / Switch gym control is not showing in the core app.

This is **not closed**.

Intended model:

`email + password -> authenticate person -> active memberships -> one gym direct / multiple gyms choose -> role resolved per selected gym`

Expected files/components:

- `login.html` universal login
- `choose-gym.html` chooser
- `gym-context.js` current gym context helpers
- `account-menu.js` loads all active memberships and should render **Switch gym** when `allMemberships.length > 1`
- active context: `sessionStorage['hybrid-gym-id']`
- last-used hint only: `localStorage['hybrid-last-gym-id']`

Previous browser evidence `36199919230` verified switching on an older revision, but current user observation overrides any assumption that this remains good.

**Next chat should reproduce the picker issue on current dev before changing architecture.** Check actual active gym memberships for the test/user account, top-level versus embedded account-menu placement, CSS visibility, and whether a persistent shared-shell gym selector is required.

### Recent 28 Sep work

Latest commits:

- `f80dbe5a...` Separate member settings from authenticated member view
- `f0665dc2...` Update smoke checks for authenticated member view
- `35a7a80a...` Align member-view smoke assertion with nav structure

Current smoke/runtime are green after those changes.

### Universal Auth model remains authoritative

Read `AUTH_CONTEXT.md`.

Core rule:

> **Authenticate the person first. Then select an active gym context.**

Never restore email-to-gym inference, first-membership `.limit(1)` tenant selection, last-gym-as-permission, or silent cross-gym fallback.

### Other release-gate items still open

- repeatable fresh new-account invite Create account browser journey
- repeatable existing-account invite acceptance fixture
- wrong-account mismatch/switch-account browser UI
- same-user different-role-per-gym browser fixture
- enable Supabase member email confirmation and browser-test the confirmation-link journey
- current gym picker visibility regression above

### UI consistency

The shared UI contract remains in force. The app-wide consistency work is not a redesign. `app-consistency.css` is the canonical final shared visual layer. However, the current picker visibility report now counts as a **shared-shell consistency issue**.

### Production

Production remains at:

`https://www.hybridone.co.uk`

source:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Do not assume dev universal-login behaviour is live in production.

---

**Updated: 27 September 2026**

This is architecture/background. Volatile truth is in the control layer and must be read first.

## Mandatory read order

1. [PROJECT_STATE.json](./PROJECT_STATE.json)
2. [PROJECT_CONTROL.md](./PROJECT_CONTROL.md)
3. [ENVIRONMENT.md](./ENVIRONMENT.md)
4. [STATUS.md](./STATUS.md)
5. [AUTH_CONTEXT.md](./AUTH_CONTEXT.md)
6. [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md)
7. [UI_CONSISTENCY.md](./UI_CONSISTENCY.md)
8. this file
9. inspect current code and live state before changing anything

## Current checkpoint

Repository:

`PerranporthAFCMens/HybridOS`

Current development head:

`cbee25179d8b6ce5a93c09c8937b3194c62da974`

Verified application checkpoint includes persistent Admin shell account menu plus exact-SHA universal Auth browser coverage.

Current production main:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

The branches are intentionally diverged:

- dev ahead 115 at the application checkpoint
- dev behind 4
- merge base `b7d83243e9248a64978677efec91c4f9d83c1052`

**Do not blindly merge, fast-forward or overwrite.**

Production hold remains active.

## Latest verification

At `fdc5cffd32e7555c79e891e22ffb6196a15c4288`:

- smoke run `36311298789` -> PASS
- public dev runtime run `36311298820` -> PASS
- Auth journey browser run `36311299027` -> PASS

Earlier authenticated browser evidence still relevant to the current model:

- protected routing `36199700825` -> PASS
- multi-gym + whole-app audit `36199919230` -> PASS

## Product

HybridOne is the operating system for hybrid gyms.

It includes:

- memberships/members
- classes and scheduling
- workouts/programming
- staff and permissions
- community/social
- reporting
- communications
- member/staff/Admin experiences
- resource/access administration

HybridOne is separate from Football PA.

## Stack

- static HTML/CSS/JavaScript
- build: `scripts/build_site.py -> _site`
- GitHub Pages dev
- Vercel production
- Supabase database/Auth/Edge Functions
- Resend email

Supabase project:

`mzgnhmeydhhpzgxlgudh`

## Auth / gym context model

The current dev model is person-first:

> **Authenticate the person first. Then select an active gym context.**

Flow:

`email/password -> active memberships -> one gym direct / multiple gyms chooser -> role-specific experience`

A single Auth identity can belong to multiple gyms and have a different role in each.

Selected context:

`sessionStorage['hybrid-gym-id']`

Last-used convenience hint:

`localStorage['hybrid-last-gym-id']`

Never infer gym from:

- email
- first returned membership
- last-used gym
- URL hint alone

Every selected gym must match an active membership.

## Universal login

Dev canonical login:

`https://perranporthafcmens.github.io/HybridOS/login.html`

Dev chooser:

`https://perranporthafcmens.github.io/HybridOS/choose-gym.html`

Gym-specific links are only hints into the same login.

Latest change:

Bare `index.html` now hands off to the universal login unless it is intentionally being used as:

- embedded Admin dashboard
- explicit `gym_id` context
- access-invite context

This prevents the old tenant-less application login/dashboard behaviour.

## Multi-gym switching

Verified browser flow:

- authenticate once
- chooser appears for two active gyms
- enter Hybrid Hub
- Switch gym to Puffin Performance
- switch back to Hybrid Hub
- role/context re-evaluates per selected gym

Verified on desktop and mobile in the whole-app audit `36199919230`. Exact-SHA run `36311299027` additionally verifies persistent desktop Admin account-menu switching, refresh, sign-out/re-login, and mobile refresh/back.

Switch gym is available through shared signed-in UI.

## Multi-site future

Full organisation/site hierarchy is intentionally parked.

Do not design new code around one-user-one-gym assumptions.

The current separation is deliberate:

`person -> memberships/access -> selected gym context -> future organisation/site context`

## UI consistency

HybridOne has an app-wide visual contract.

Canonical shared layer:

`app-consistency.css`

Static guard:

`scripts/ui_consistency_check.py`

Authenticated whole-app audit:

- 21 surfaces on desktop
- 21 surfaces on mobile
- no horizontal overflow on audited surfaces
- run `36199919230`

See [UI_CONSISTENCY.md](./UI_CONSISTENCY.md).

## Auth/email state

Verified:

- Hybrid Hub password reset
- Puffin password reset
- Hybrid Hub magic link
- Puffin magic link
- universal login + multi-gym chooser
- multi-gym switching
- protected universal-login routing
- corrected Admin invite email
- resend UI/delivery
- backend invite rejection/governance cases
- fresh-browser Admin invite activation

Still release-gating:

2. fresh new-account Admin invite Create account journey
3. repeatable existing-account invite acceptance fixture
4. wrong-account mismatch/switch-account browser journey
4. same-user different-role-per-gym browser fixture
5. enable and browser-verify member email confirmation

## Member signup decision

Self-service member signup **must require email confirmation** before access continues.

The decision is documented and `join.html` now supports a no-session confirmation state. Live run `36311299027` still observed immediate confirmed signup, so the Supabase Email confirmation setting still needs enabling and the full confirmation-link journey needs browser verification.

## Production

Production origin:

`https://www.hybridone.co.uk`

Production remains on:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Production still uses the older gym-specific entry implementation.

Do not describe dev universal-login behaviour as production behaviour until an intentional release occurs.

## Deployment rule

Both environments serve built output:

```
source
-> python3 scripts/build_site.py
-> _site
```

Do not diagnose a deployed UI from raw source alone.

## Security invariants

Keep:

- RLS
- no service role in browser
- exact gym scoping
- server-side sensitive checks
- Owner governance
- no silent cross-gym fallback
- request/egress guard
- narrow SECURITY DEFINER/RPC permissions

Do not weaken security for tests.

## Immediate next work

1. complete remaining browser-level Auth matrix items
2. enable/verify member email confirmation
3. intentionally reconcile main/dev
4. promote only after release gate clears
5. browser-test exact Vercel production revision
6. remove production hold only after production evidence passes

## Definition of fixed

Do not call something fixed from source alone.

Where applicable require:

1. committed
2. built
3. smoke/CI green
4. deployed to the intended environment
5. exact revision verified
6. actual runtime/browser journey verified
