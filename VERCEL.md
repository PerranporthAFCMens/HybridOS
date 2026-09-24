# HybridOne Vercel handover

**Updated: 24 September 2026**

This file documents the production deployment contract for HybridOne.

## Production

Project:

- Vercel project: **hybrid-one**
- primary domain: https://www.hybridone.co.uk
- Hybrid Hub login: https://www.hybridone.co.uk/hybrid-hub
- Puffin Performance login: https://www.hybridone.co.uk/puffin-performance

Production source branch:

- `main`

Development source branch:

- `dev`
- Vercel Git deployment for dev is deliberately disabled

## Critical build contract

Vercel must build the exact same generated site shape as the GitHub Pages dev preview.

Current `vercel.json` contract:

```json
{
  "buildCommand": "python3 scripts/build_site.py",
  "outputDirectory": "_site"
}
```

Pipeline:

```
repository source
-> python3 scripts/build_site.py
-> _site
-> Vercel serves _site
```

The build script injects/normalises shared CSS/runtime, admin-shell behaviour, tenant branding, navigation, diagnostics and cache-busted asset URLs.

### Why this matters

On 22 September 2026, dev looked correct while production looked substantially different even after source branches had been copied.

Root cause:

- GitHub Pages dev preview served transformed `_site`
- Vercel production served raw repository files

The fix was:

- `d34e96d6f9c0d5a5807a86cc0632ec091c6e9245`
- **Build production from the same site output as dev**

The user confirmed this fixed the production/dev visual mismatch.

**Do not remove `buildCommand` or `outputDirectory` unless the replacement is proven against the same built-site output and smoke suite.**

## Asset versioning

`scripts/build_site.py` uses:

1. `VERCEL_GIT_COMMIT_SHA` on Vercel
2. `GITHUB_SHA` in GitHub Actions
3. `dev` only as a fallback

This is required for reliable cache-busting.

## Production routes

Current rewrites:

- `/` -> `/landing.html`
- `/hybrid-hub` -> `/hybrid-hub-login.html`
- `/puffin-performance` -> `/puffin-performance-login.html`
- `/app` -> `/index.html`

Owner/Admin gym login should enter the polished admin shell:

```
admin.html?gym_id=<gym-id>
```

Do not route Owner/Admin login directly into the old top-level dashboard.

## Latest verified production checkpoint before docs refresh

Functional main head:

- `784bac0c253479265728381f34fab816baf4507c`
- **Fix Staff and Resources mobile layout**

Checks on 24 September 2026:

- GitHub smoke: success
- Vercel commit status: success
- Vercel deployment target attached to commit status
- hourly production workflow: success

Important nuance:

The hourly production workflow currently reports success while **skipping promotion**, because main and dev intentionally diverge.

The workflow logic is correct:

- if main == dev -> no-op
- if main is not an ancestor of dev -> skip
- otherwise -> fast-forward main to dev

Therefore a green hourly workflow does **not** prove that dev was promoted.

## Dev preview

GitHub Pages is the development preview.

Flow:

```
dev push
-> .github/workflows/hybrid-smoke.yml
-> python3 scripts/build_site.py
-> python3 scripts/smoke_test.py _site
-> Auth email hook smoke
-> .github/workflows/pages.yml
-> GitHub Pages
```

The Pages workflow checks out `dev`, builds `_site`, smoke-tests it again, then uploads/deploys the generated artifact.

## Current branch divergence

Functional checkpoints immediately before the 24 September docs refresh:

- main: `784bac0...`
- dev: `e82bf510...`

Both contain the latest Staff & Resources mobile-layout fix, but the histories still diverge.

Main includes production iPhone/mobile navigation history.

Dev includes additional tenant/Auth hardening:

- explicit gym-bound pending access
- explicit gym context on member-facing flows
- gym-bound password reset and magic links
- `auth-return.html`
- tenant-aware `send-auth-email` source
- Auth email hook CI checks

Do not blindly replace main with dev or dev with main.

## Verification checklist for any production promotion

1. Compare main and dev.
2. Reconcile branch-only fixes intentionally.
3. Run `python3 scripts/build_site.py`.
4. Run `python3 scripts/smoke_test.py _site`.
5. Run `python3 scripts/email_hook_smoke.py` when Auth-email source is present.
6. Confirm GitHub smoke success.
7. Confirm Vercel status is success on the intended main commit.
8. Open the real production site in a browser/incognito session.
9. Check Hybrid Hub login, desktop shell and mobile nav.
10. Do not call the release fixed solely because Vercel says success.

## Vercel connector note

If the Vercel connector lacks permission for direct project inspection, GitHub's commit status context **Vercel** is still a reliable first check for the deployment generated from a commit. Use the target deployment link where available.

Do not infer that the UI is correct from deployment status alone.
