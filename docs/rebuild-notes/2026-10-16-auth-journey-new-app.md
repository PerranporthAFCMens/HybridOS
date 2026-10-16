# Auth journey check: rewritten for the new app

Gym: the check signs in a disposable test account that belongs to Hybrid Hub and Puffin Performance; it changes nothing else.

## Why
Since owners and admins land in the new app (`/today`, change bb3d5a6) the "HybridOne Auth journey browser" check was red on every merge to dev. It was still looking for the old admin page's account chip and sidebar switch, which the new app does not have.

## What it checks now (desktop and mobile)
Sign in, choose a gym, land in the new app showing that gym, the signed-in name and an owner/admin role, switch gym both ways, refresh keeps the gym, no gym falls back to the chooser, back navigation stays signed in with the same gym, sign out returns to login, signing in again works.

## Dropped
The old-page assertions on classes.html, staff.html and member.html (scoped helper requests, old sidebar). Those pages are being replaced; the new app has its own checks in `web/`.

## Not changed
The reset, magic-link, one-gym and sign-up steps further down the workflow.

## Follow-up (first run on dev)
The first real run got through sign-in, the gym chooser and the gym name, then failed because the account name loads after the page (and the test account may show its email name, "delivered"). The check now waits for the name and accepts either.
