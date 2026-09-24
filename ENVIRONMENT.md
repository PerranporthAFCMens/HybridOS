# HybridOne environment map

**Operational source of truth for routes, IDs and deployment topology.**

Read this before giving a URL, changing Auth, changing deployment configuration or debugging tenant routing.

## Repository and branches

- Repository: `PerranporthAFCMens/HybridOS`
- `dev`: development source
- `main`: production source
- Production promotion is currently **held**. See [STATUS.md](./STATUS.md).

## Production

Public origin:

`https://www.hybridone.co.uk`

Approved production login routes:

- Hybrid Hub: `https://www.hybridone.co.uk/hybrid-hub`
- Puffin Performance: `https://www.hybridone.co.uk/puffin-performance`

Vercel:

- Project ID: `prj_9DRBM2eBpXpXngPTCawtIwYID6rc`
- Team ID: `team_p7v1ius4XrtikQ0awFGWP4sF`
- Production source: `main`
- Build command: `python3 scripts/build_site.py`
- Output directory: `_site`

## Development

GitHub Pages origin:

`https://perranporthafcmens.github.io/HybridOS/`

**Approved dev login URLs until the dedicated aliases are re-browser-verified:**

Hybrid Hub:

`https://perranporthafcmens.github.io/HybridOS/index.html?gym_id=242f57c2-6e37-4977-b3c5-1c87de7d0b98`

Puffin Performance:

`https://perranporthafcmens.github.io/HybridOS/index.html?gym_id=aec16956-3793-4543-873b-4412646ca1eb`

Source files `hybrid-hub-login.html` and `puffin-performance-login.html` exist, but **do not give those aliases to a user until they have been browser-verified on the deployed Pages site**. A user observed the Hybrid Hub alias landing on the generic login on iPhone on 24 September 2026.

### GitHub Pages metadata warning

The Pages workflow is triggered by `workflow_run`, so its run metadata may show the `main` SHA even when the job checked out `dev`.

**Never use the Pages run `head_sha` as proof of deployed dev code.**

To verify dev deployment, inspect the job log for:

`Checkout dev`

and the exact output of:

`git log -1 --format=%H`

## Supabase

Project:

`mzgnhmeydhhpzgxlgudh`

Known gym IDs:

- Hybrid Hub: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `aec16956-3793-4543-873b-4412646ca1eb`

Tenant invariant:

> **The login route decides the gym. The email address does not.**

Browser gym context:

`sessionStorage['hybrid-gym-id']`

Do not reintroduce first-active-gym inference, email-to-gym inference, `.limit(1)` tenant selection or a generic gym picker as the primary login flow.

## Auth and email

Supabase Send Email Hook endpoint:

`https://mzgnhmeydhhpzgxlgudh.supabase.co/functions/v1/send-auth-email`

Current live functions at the control-layer checkpoint:

- `send-auth-email` v5, ACTIVE, `verify_jwt=false`
- `send-access-invite` v11, ACTIVE, `verify_jwt=true`

`send-auth-email` uses signed Supabase webhook verification rather than Supabase JWT verification.

Required Edge Function secrets are configured:

- `RESEND_API_KEY`
- `SEND_EMAIL_HOOK_SECRET`

Never print secret values into repository files, logs or user-facing messages.

## Build contract

Both dev and production must serve:

```
source
-> python3 scripts/build_site.py
-> _site
```

Never diagnose a deployed UI only from raw source. Inspect the generated site and then the deployed runtime.


## Automatic public runtime verification

Every successful dev Pages deployment now performs a post-deploy check against the **public GitHub Pages site**.

It verifies:

- `deployment.json` reports the exact checked-out `dev` SHA
- the public Hybrid Hub login file serves Hybrid Hub content, not the generic platform login
- the public Puffin Performance login file serves Puffin content
- the query-bound generic login still contains the explicit `gym_id` context contract

Files:

- `scripts/runtime_pages_check.py`
- `.github/workflows/pages.yml`

A green Pages workflow is therefore runtime evidence, not just build evidence.
