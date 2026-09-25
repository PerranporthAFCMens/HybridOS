# HybridOne live status

**Updated: 25 September 2026**

This file records the latest verified operational checkpoint. For machine-readable state see [PROJECT_STATE.json](./PROJECT_STATE.json).

## Release status

**PRODUCTION_HOLD: ACTIVE**

**Production promotion allowed: NO**

Reason: the Auth and invite browser matrix is not complete.

Do not merge/promote dev to main just because smoke checks are green.

## Verified branch/deployment checkpoint

Production:

- `main`: `424bfb9ec7f0fcf36b7b276e16a0385bb0b3a961`
- Vercel production source SHA: `424bfb9ec7f0fcf36b7b276e16a0385bb0b3a961`
- Vercel state: READY
- Production remains on the deliberate Auth hold

Latest verified dev application checkpoint before this control-layer documentation commit:

- `82c0978b48b58ba70bd2840e70ff04b25bc05ae9`
- Smoke run: `36065655123` -> success
- Pages run: `36065671940` -> success
- Pages checkout log confirmed exact dev SHA: `82c0978b48b58ba70bd2840e70ff04b25bc05ae9`

Branch relationship at this checkpoint:

- diverged
- dev ahead of main: 42 commits
- dev behind main: 1 commit
- merge base: `b7d83243e9248a64978677efec91c4f9d83c1052`

Never blindly fast-forward or overwrite one branch with the other.

## Auth/email status

Live:

- Supabase Send Email Hook is enabled
- `send-auth-email` v5 ACTIVE
- `send-access-invite` v11 ACTIVE
- Hybrid Hub password-reset email delivered with correct Hybrid Hub sender, subject and production return URL
- Puffin Performance magic-link email delivered with correct Puffin sender, subject and production return URL
- browser matrix passed cross-gym login isolation
- browser matrix passed Hybrid Hub and Puffin logins using the same Auth account
- browser matrix passed iPhone-style admin navigation

Not yet complete:

- final password-reset link consumption/browser password update
- Puffin password-reset flow
- Hybrid Hub magic-link flow
- member signup confirmation
- full invite acceptance matrix
- wrong-account invite runtime
- expired/revoked invite runtime
- single-Owner invite runtime
- multi-Owner invite runtime
- refresh/back mobile
- final Staff & Resources mobile browser check

## Current invite checkpoint

An Admin invite email was sent for the test flow and the backend invite is open.

The first email was correctly branded but displayed literal `{{invited_by}}` and `{{role}}` placeholders.

Fix status:

- placeholder-resolution fix deployed to `send-auth-email` v5
- smoke checks passed
- corrected invite email has been resent and verified successfully
- the open-invite **Resend email** UI and resend action have now passed a live dev browser test; invite acceptance remains tracked separately

Dev UI now contains a **Resend email** action for an already-sent open email invite.

Production does not contain that UI change because production is still held.

## Temporary test infrastructure

The following old test Edge Functions are intentionally inert and protected with `verify_jwt=true`:

- `hybridone-auth-secret-check`
- `hybridone-email-auth-test-harness`
- `hybridone-email-auth-retest-harness`
- `hybridone-email-auth-url-retest-harness`

They must not be treated as active product functionality.

Disposable Auth test users used by automated email tests were removed after the runs.

## Database/Auth security notes

Existing security-adviser work remains separate from the current Auth release gate.

Do not mass-revoke SECURITY DEFINER functions. Classify each function first as:

- intentionally public
- authenticated client RPC
- privileged-only

Leaked-password protection was previously reported disabled and remains a separate security hardening item.

## Next action

Resume at [AUTH_TEST_MATRIX.md](./AUTH_TEST_MATRIX.md), starting with the corrected Admin invite resend and acceptance flow.

Production must remain held until the release-gate rows are complete and browser-verified.


## Public Pages runtime verification

A post-deployment public-runtime check is being added at this checkpoint.

The Pages workflow will not complete green unless the public deployment:

1. exposes a `deployment.json` manifest matching the exact checked-out `dev` SHA
2. serves the Hybrid Hub-specific login content at `hybrid-hub-login.html`
3. serves the Puffin Performance-specific login content at `puffin-performance-login.html`
4. retains the explicit query-bound gym-context contract on `index.html?gym_id=...`

Until the first green run completes, this capability is **pending verification**.


## Dev runtime verification workflow

Because the Pages deployment workflow is triggered by `workflow_run`, GitHub currently loads that workflow definition from the default branch. Changes to `.github/workflows/pages.yml` on `dev` therefore do not change the running Pages workflow until they reach `main`.

To keep production frozen while still verifying dev correctly, runtime verification now runs independently from:

`.github/workflows/dev-runtime.yml`

On every `dev` push it waits for the public Pages site to expose the matching `deployment.json` SHA, then checks the Hybrid Hub and Puffin login pages. A green runtime-verification workflow is the authoritative proof that the public dev site matches the dev commit.


## Public dev runtime verification result

**PASS** on 24 September 2026.

Evidence:

- dev runtime run: `36066958023`
- verified deployed SHA: `b60aea0ace4195d1f236f8d2d2bc7988870c5683`
- Pages deployment run: `36066980204`
- public `deployment.json` matched the exact dev SHA
- public `hybrid-hub-login.html` served Hybrid Hub-specific content
- public `puffin-performance-login.html` served Puffin Performance-specific content
- both query-bound `index.html?gym_id=...` routes retained the explicit gym-context contract

The previous limitation around independently proving the public GitHub Pages deployment is therefore resolved through GitHub Actions.


## Resend email UI verification

**PASS** on 25 September 2026.

Evidence:

- GitHub browser run: `36119425104`, second attempt successful
- fresh Hybrid Hub Admin email invite created and sent
- public dev Admin access opened in an authenticated Hybrid Hub Owner browser session
- the open invite row displayed **Resend email**
- clicking **Resend email** completed successfully and showed the invite-sent confirmation
- database row remained `open` and `email_sent_at` updated after the resend
- both initial send and resend were delivered by Resend
- resent email used the corrected template with resolved inviter and role placeholders

The fresh test invite is intentionally left open so the same button remains visible for manual inspection. Temporary probe permissions were removed and the probe Edge Function was made inert after the test.


## Protected login routing fix

**PASS** on 25 September 2026.

The previous bug was that protected admin/staff pages redirected unauthenticated users to bare `./index.html`, which discarded the requested `gym_id` and produced the generic HybridOne login warning.

The dev routing contract now:

- sends Hybrid Hub protected pages to `hybrid-hub-login.html`
- sends Puffin Performance protected pages to `puffin-performance-login.html`
- carries the exact requested page in a safe `return_to` value
- preserves `gym_id`
- returns the user to the originally requested protected page after password sign-in
- preserves gym context through the mobile admin-shell handoff
- keeps sign-out gym-specific rather than returning to the generic platform login

Evidence:

- source routing fix: `8ad9d2087dc0b51977c562e1999f6ec4cbdf22b7`
- reviewed smoke baseline update: `f8bbade97815b5b19e923d63248b5c7b9cfd391e`
- protected-routing browser workflow added at `71b8c7f3162c133ea5909a379d43c2fc892019f9`
- public Pages deployment: PASS
- dev runtime verification: PASS
- protected routing browser run `36125403099`: PASS

The browser test used a fresh mobile Chromium context against the public GitHub Pages deployment, so this is runtime evidence rather than source-only evidence.


## Production canonical route hotfix

**PASS** on 25 September 2026.

A recurring production bug allowed the canonical no-slash login routes to work while trailing-slash variants such as `/hybrid-hub/` could fail.

Permanent fix:

- `vercel.json` now explicitly sets `"trailingSlash": false`
- Vercel canonicalises trailing-slash requests to the no-slash route before the existing rewrite
- the same routing configuration exists on `main` and `dev`
- permanent workflow `.github/workflows/production-routing.yml` verifies the live custom domain after production routing changes

Production hotfix SHA:

`dbe7528b83687df73a2ef2b289ae44390205ed11`

Vercel production state:

`READY`

Production routing run `36149543418` passed after deployment and verified:

- `/hybrid-hub`
- `/hybrid-hub/` -> canonical `/hybrid-hub`
- `/puffin-performance`
- `/puffin-performance/` -> canonical `/puffin-performance`
- `/app`
- `/app/` -> canonical `/app`

The general Auth production hold remains in place for dev-to-main promotion. This was a narrow production routing hotfix, not a full dev promotion.


## Public DNS/TLS diagnostic

**PASS** on 25 September 2026.

An external GitHub-hosted runner checked the public DNS and TLS state after a Windows Chrome client reported `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`.

Results:

- apex A: `hybridone.co.uk -> 216.198.79.1`
- `www.hybridone.co.uk` CNAME: `hybridone.co.uk`
- Google Public DNS and Cloudflare DNS returned the same records
- no public AAAA record exists for apex or www
- IPv4 TLS negotiation succeeded with TLS 1.3
- `www.hybridone.co.uk` certificate is valid and matches the hostname
- certificate issuer: Let's Encrypt
- certificate validity: 22 Sep 2026 to 21 Dec 2026
- HTTPS returned `200` from Vercel with HSTS enabled

Therefore the observed browser error was not reproducible from the public internet and is consistent with client/network DNS cache, SSL state, HTTPS interception or another local path issue rather than current Vercel DNS/TLS configuration.
