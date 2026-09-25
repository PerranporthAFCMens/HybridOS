# HybridOne Auth and gym context

**Updated: 26 September 2026**

This is the authoritative product and engineering contract for sign-in and gym selection.

## Core model

> **Authenticate the person first. Then select an active gym context.**

A HybridOne account is a person-level Supabase Auth identity. The email address does not identify a gym.

After authentication, HybridOne loads **all active gym memberships** for that user.

- **No active gyms:** do not enter a gym. Show an access message.
- **One active gym:** select it automatically and continue.
- **Two or more active gyms:** show **Choose a gym**.
- **Already signed in:** a multi-gym user can always use **Switch gym** to return to the chooser.

Never restore first-membership inference such as `.limit(1)` as the tenant-selection mechanism.

## Current gym context

The selected gym is a temporary working context:

`sessionStorage['hybrid-gym-id']`

The last successfully selected gym may be remembered only as a convenience hint:

`localStorage['hybrid-last-gym-id']`

The last-used value is never permission. Every entry still requires an active membership.

## Role is per gym

The same Auth identity may have different roles in different gyms.

After gym selection:

- Owner/Admin -> Admin experience
- Staff/Coach -> Staff experience
- Member -> Member experience

Switching gyms must re-evaluate the role for the newly selected gym.

## Universal login

Development canonical entry:

`https://perranporthafcmens.github.io/HybridOS/login.html`

Development chooser:

`https://perranporthafcmens.github.io/HybridOS/choose-gym.html`

Gym-specific links are optional **hints** into the same universal login, not separate authentication systems:

- Hybrid Hub: `https://perranporthafcmens.github.io/HybridOS/login.html?gym_id=242f57c2-6e37-4977-b3c5-1c87de7d0b98`
- Puffin Performance: `https://perranporthafcmens.github.io/HybridOS/login.html?gym_id=aec16956-3793-4543-873b-4412646ca1eb`

A gym hint is accepted only if the authenticated account has active access to that gym. It must never silently substitute another gym.

## Switch gym

For a multi-gym account, **Switch gym** must be available after login.

Current UI contract:

- desktop: account menu plus visible current-gym/sidebar control where that shell has one
- mobile: account menu
- chooser changes `hybrid-gym-id`, remembers last-used gym, and routes according to the role in that gym

Browser evidence: workflow run `36199919230` passed Hub -> Puffin -> Hub on both desktop and mobile.

## Safe return routing

Protected pages may send an unauthenticated user to the universal login with:

- optional `gym_id` hint
- same-origin `return_to`

After sign-in, the return path is used only when it remains inside the HybridOne app and is compatible with the selected gym context.

Permanent regression workflow:

`.github/workflows/protected-routing-browser.yml`

## Future multi-site

Organisation and site hierarchy is deliberately **not implemented yet**.

The current model is designed not to block it:

`person -> memberships/access -> organisation/site context later -> gym/site experience`

Do not collapse authentication, organisation, gym and site into one identifier.

## Security invariants

- never infer gym from email
- never grant access because a gym was present in a URL
- never use last-used gym as proof of membership
- never silently fall back into a different gym
- re-check active membership for selected gym
- keep RLS and server-side permission checks authoritative
- route hints improve convenience only
