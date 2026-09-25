# HybridOne live status

**Updated: 26 September 2026**

Machine-readable state: [PROJECT_STATE.json](./PROJECT_STATE.json)

## Release state

**PRODUCTION_HOLD: ACTIVE**

Production promotion allowed: **NO**

Reason: the new universal login and multi-gym context model is verified on dev, but the remaining invite/access-grant Auth scenarios are not all complete.

## Production

- main: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- Vercel: READY
- production remains on the existing gym-specific entry implementation
- canonical trailing-slash routing hotfix remains live
- production routing workflow last known pass: `36149543418`

## Verified dev candidate

Application checkpoint:

`6a14cfed829f01eace2ad094dd14e1dd08b27120`

Verification:

- smoke / UI contract: `36199919218` -> PASS
- exact public Pages runtime: `36199919264` -> PASS
- protected universal-login routing: `36199700825` -> PASS
- authenticated multi-gym + whole-app audit: `36199919230` -> PASS

### Universal login

Verified behaviour:

1. email/password authenticates the person
2. active memberships are loaded
3. one gym enters directly
4. multiple gyms show **Choose a gym**
5. selected gym becomes current context
6. role is resolved for that gym
7. multi-gym users can **Switch gym**
8. desktop and mobile both passed Hub -> Puffin -> Hub

The old `.limit(1)` account-menu assumption is removed.

### Whole-app visual sweep

The authenticated audit captured 21 product surfaces on desktop and 21 on mobile.

All audited surfaces reported no horizontal overflow.

The shared visual contract remains enforced by:

- `app-consistency.css`
- `scripts/ui_consistency_check.py`
- [UI_CONSISTENCY.md](./UI_CONSISTENCY.md)

## Auth/email status

Browser-verified:

- Hybrid Hub password reset, including link consumption and new-password login
- Puffin Performance password reset
- Hybrid Hub magic-link sign-in
- Puffin Performance magic-link sign-in
- same Auth identity across multiple gyms
- universal chooser and switching
- corrected Admin invite email template
- open-invite **Resend email** UI and delivery

Still release-gating:

- fresh new-account invite acceptance
- wrong-account invite runtime
- expired/revoked invite runtime
- one-Owner Owner-invite runtime
- multi-Owner Owner-invite runtime
- refresh/back navigation edge case
- explicit decision on immediate-confirm member signup mode

See [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md).

## Temporary UI audit infrastructure

The final audit used a disposable two-gym Auth account.

After the PASS:

- disposable user was removed
- `hybridone-ui-audit-harness` was redeployed inert as v2
- JWT verification is enabled
- it returns HTTP 410
- temporary UI-audit workflow/script are removed in the documentation/cleanup commit

## Next release work

1. complete the remaining invite/access-grant matrix
2. reconcile main/dev intentionally, because they diverge
3. browser-test the production candidate after promotion
4. only then remove the production hold
