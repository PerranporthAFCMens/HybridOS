# HybridOne environment map

**Updated: 27 September 2026**

Operational source of truth for routes, IDs and deployment topology.

## Repository

Repository:

`PerranporthAFCMens/HybridOS`

Branches:

- `dev`: development source
- `main`: production source

Current verified heads:

- dev: `fdc5cffd32e7555c79e891e22ffb6196a15c4288`
- main: `dbe7528b83687df73a2ef2b289ae44390205ed11`

Relationship:

- diverged
- dev ahead 97
- dev behind 4
- merge base `b7d83243e9248a64978677efec91c4f9d83c1052`

Production promotion: **HELD**

## Production

Origin:

`https://www.hybridone.co.uk`

Current production entry points remain the pre-universal-login implementation:

- Hybrid Hub: `https://www.hybridone.co.uk/hybrid-hub`
- Puffin Performance: `https://www.hybridone.co.uk/puffin-performance`

Do not give `/index.html` as a production login URL.

Vercel:

- project ID: `prj_9DRBM2eBpXpXngPTCawtIwYID6rc`
- team ID: `team_p7v1ius4XrtikQ0awFGWP4sF`
- build command: `python3 scripts/build_site.py`
- output: `_site`
- deployed source: `dbe7528b83687df73a2ef2b289ae44390205ed11`
- state: READY

## Development

Origin:

`https://perranporthafcmens.github.io/HybridOS/`

Universal login:

`https://perranporthafcmens.github.io/HybridOS/login.html`

Gym chooser:

`https://perranporthafcmens.github.io/HybridOS/choose-gym.html`

Convenience gym hints into the same universal login:

- Hybrid Hub: `https://perranporthafcmens.github.io/HybridOS/login.html?gym_id=242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `https://perranporthafcmens.github.io/HybridOS/login.html?gym_id=aec16956-3793-4543-873b-4412646ca1eb`

Bare dev app entry:

`https://perranporthafcmens.github.io/HybridOS/index.html`

At the current checkpoint, bare `index.html` immediately hands off to `login.html` unless the page is being used as the embedded Admin dashboard or has explicit gym/invite context.

Latest public dev verification:

- source: `fdc5cffd32e7555c79e891e22ffb6196a15c4288`
- smoke: `36309330446` -> PASS
- runtime: `36309330458` -> PASS

## Auth context

Read [AUTH_CONTEXT.md](./AUTH_CONTEXT.md).

Invariant:

> **Authenticate the person first. Then select an active gym context.**

Current gym:

`sessionStorage['hybrid-gym-id']`

Last-used hint:

`localStorage['hybrid-last-gym-id']`

Known gym IDs:

- Hybrid Hub: `242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `aec16956-3793-4543-873b-4412646ca1eb`

## Supabase

Project:

`mzgnhmeydhhpzgxlgudh`

Auth email hook:

`https://mzgnhmeydhhpzgxlgudh.supabase.co/functions/v1/send-auth-email`

Known live functions:

- `send-auth-email` v5
- `send-access-invite` v11

## Build contract

Both dev and production use:

```
source
-> python3 scripts/build_site.py
-> _site
```

Never diagnose deployed UI only from raw source.
