# HybridOne live status

**Updated: 24 September 2026**

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
- corrected invite email has **not yet been resent and verified**
- invite acceptance has **not yet been tested**

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
