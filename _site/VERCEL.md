# HybridOne Vercel handover

**Updated: 26 September 2026**

## Production project

- Vercel project: **hybrid-one**
- domain: `https://www.hybridone.co.uk`
- source branch: `main`
- current source SHA: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- state: READY

Development remains on `dev`; Vercel Git deployment for dev is disabled.

## Build contract

```json
{
  "buildCommand": "python3 scripts/build_site.py",
  "outputDirectory": "_site"
}
```

Pipeline:

```
repository source
-> scripts/build_site.py
-> _site
-> Vercel serves _site
```

Do not return production to raw-source serving.

## Current production routes

Production is still on the pre-universal-login release while the Auth release gate is active.

User-facing current production shortcuts:

- `/hybrid-hub`
- `/puffin-performance`

`trailingSlash: false` is part of the production routing contract.

Production routing workflow:

`.github/workflows/production-routing.yml`

Last recorded pass:

`36149543418`

Do not give `/index.html` as a user login route.

## Verified dev candidate route model

The dev candidate moves to one login system:

- `/login` -> `login.html`
- `/choose-gym` -> `choose-gym.html`
- `/hybrid-hub` -> universal login with Hybrid Hub gym hint
- `/puffin-performance` -> universal login with Puffin gym hint
- `/app` -> universal login

The gym-specific routes are convenience hints only. Authentication is person-first and membership validation remains authoritative.

See [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

## Promotion rule

Production is held.

Do not copy the dev `vercel.json` route candidate to production in isolation. Release it with the matching universal-login files/context code and browser-test the real production domain afterwards.

## Verification checklist

1. compare main/dev
2. reconcile branch-only production changes intentionally
3. build `_site`
4. run smoke/UI/Auth checks
5. deploy the intended main SHA
6. verify Vercel is READY on that SHA
7. verify root sales page
8. verify `/login`
9. verify one-gym direct entry
10. verify multi-gym chooser/switch
11. verify mobile
12. only then update the release gate
