# HybridOne environment map

**Updated: 26 September 2026**

Operational source of truth for routes, IDs and deployment topology. Read this before giving a URL or changing Auth/routing.

## Repository

- Repository: `PerranporthAFCMens/HybridOS`
- `dev`: development source
- `main`: production source
- Production promotion: **held**

Verified application checkpoint:

- production main: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- verified dev application: `6a14cfed829f01eace2ad094dd14e1dd08b27120`
- relationship at the checkpoint: diverged, dev ahead 89 / behind 4
- merge base: `b7d83243e9248a64978677efec91c4f9d83c1052`

## Production

Origin:

`https://www.hybridone.co.uk`

Current production entry points remain the pre-universal-login implementation until the release gate is cleared:

- Hybrid Hub: `https://www.hybridone.co.uk/hybrid-hub`
- Puffin Performance: `https://www.hybridone.co.uk/puffin-performance`

Do not give `/index.html` as a user login URL.

Vercel:

- project ID: `prj_9DRBM2eBpXpXngPTCawtIwYID6rc`
- team ID: `team_p7v1ius4XrtikQ0awFGWP4sF`
- build: `python3 scripts/build_site.py`
- output: `_site`
- current deployment source: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- current state: READY

## Development

Origin:

`https://perranporthafcmens.github.io/HybridOS/`

Canonical universal login:

`https://perranporthafcmens.github.io/HybridOS/login.html`

Gym chooser:

`https://perranporthafcmens.github.io/HybridOS/choose-gym.html`

Convenience gym links into that same login:

- Hybrid Hub: `https://perranporthafcmens.github.io/HybridOS/login.html?gym_id=242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `https://perranporthafcmens.github.io/HybridOS/login.html?gym_id=aec16956-3793-4543-873b-4412646ca1eb`

Public dev runtime verification:

- run `36199919264`
- source `6a14cfed829f01eace2ad094dd14e1dd08b27120`
- result: PASS

Multi-gym authenticated browser audit:

- run `36199919230`
- source `6a14cfed829f01eace2ad094dd14e1dd08b27120`
- result: PASS on desktop and mobile

Protected-routing browser:

- run `36199700825`
- result: PASS

## Auth context

Read [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

The authoritative invariant is:

> **Authenticate the person first. Then select an active gym context.**

Selected gym:

`sessionStorage['hybrid-gym-id']`

Last-used convenience hint:

`localStorage['hybrid-last-gym-id']`

Known gym IDs:

- Hybrid Hub: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `aec16956-3793-4543-873b-4412646ca1eb`

## Supabase

Project:

`mzgnhmeydhhpzgxlgudh`

Send Email Hook:

`https://mzgnhmeydhhpzgxlgudh.supabase.co/functions/v1/send-auth-email`

Live email/Auth functions at this checkpoint:

- `send-auth-email` v5, ACTIVE, signed webhook verification
- `send-access-invite` v11, ACTIVE, JWT verification enabled

## Build contract

Both environments must serve the built output:

```
source
-> python3 scripts/build_site.py
-> _site
```

Never diagnose deployed UI only from raw source.

## Public runtime authority

The authoritative dev runtime workflow is:

`.github/workflows/dev-runtime.yml`

It waits for `deployment.json` to match the exact dev SHA and checks the public login/chooser contract.

Workflow metadata alone is not proof of what GitHub Pages is serving.
