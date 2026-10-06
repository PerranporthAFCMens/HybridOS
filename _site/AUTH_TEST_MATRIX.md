# HybridOne Auth test matrix

**Updated: 28 September 2026**

Release gate for Auth, access and gym-context work.

Status meanings:

- **PASS**: current runtime/browser/delivery evidence exists
- **PARTIAL**: meaningful evidence exists, but the whole scenario is not complete
- **NOT TESTED**: no current runtime evidence
- **BLOCKED**: named dependency prevents the test

| # | Scenario | Status | Current evidence / next requirement |
|---:|---|---|---|
| 1 | Hybrid Hub Owner login | PASS | Universal-login browser audit entered Hybrid Hub successfully. Run `36199919230`. |
| 2 | Puffin Performance login | PASS | Same Auth account selected Puffin Performance successfully. Run `36199919230`. |
| 3 | Same Auth account can access multiple gyms without cross-gym fallback | PASS | Two-gym chooser and explicit Hub -> Puffin -> Hub switching passed on desktop and mobile. |
| 4 | Sign out and sign back in through universal login | PASS | Exact-SHA browser run `36311299027` switched gyms, refreshed, signed out, verified `hybrid-gym-id` was cleared, signed back in and returned to the two-gym chooser. |
| 5 | Password reset from Hybrid Hub | PASS | Full browser link consumption, new password and login passed in run `36071752904`. |
| 6 | Password reset from Puffin Performance | PASS | Full browser link consumption, new password and login passed in run `36071752904`. |
| 7 | Magic-link sign-in from each gym | PASS | Hub and Puffin full browser magic-link journeys passed in run `36071752904`. |
| 8 | Member signup confirmation | PARTIAL | Product decision locked 26 Sep. Source now handles the no-session confirmation state, but live probe in run `36311299027` still returned an active session with the email already confirmed at creation. Supabase Email confirmation must still be enabled and the confirmation-link journey browser-tested before PASS. |
| 9 | Admin invite in fresh incognito | PASS | Fresh Playwright browser context consumed the Hybrid Hub Admin magic link and activated Admin access. Run `36069661356`. |
| 10 | Existing account accepting invite | PASS | Repeatable isolated browser fixture accepted an existing-account invite in run `36465324428`. |
| 11 | New account accepting invite | PASS | Fresh browser **Create account** / password setup and invite claim passed in repeatable isolated run `36465324428`. |
| 12 | Wrong account already signed in | PASS | Wrong-account mismatch and **Switch account** recovery passed in repeatable browser run `36465324428`. |
| 13 | Expired and revoked invite | PASS | Isolated live run `36071266688` verified revoked and expired invites both fail to claim. |
| 14 | Owner invite with one active Owner | PASS | Isolated live run `36071266688` verified 1/1 approval, shareable token and successful active Owner claim. |
| 15 | Owner invite with multiple active Owners | PASS | Isolated live run `36071266688` verified 1/2 blocks sharing, second Owner approval changes to 2/2/open, then successful active Owner claim. |
| 16 | Refresh/back on mobile | PASS | Exact-SHA browser run `36311299027` verified Puffin context survives mobile refresh and back navigation without falling into login/chooser loops. |
| 17 | iPhone/mobile Admin navigation | PASS | Existing mobile navigation browser evidence plus current 390px authenticated surface audit. |
| 18 | Staff & Resources mobile layout | PASS | Current authenticated 390px audit loaded Staff/Resources without horizontal overflow. Run `36199919230`. |

## Additional invariants

| Invariant | Status | Evidence |
|---|---|---|
| Universal login loads all active memberships, not first membership | PASS | Two gyms appeared in chooser; account menu loads all active memberships. |
| Multi-gym user can switch after login | PASS | Exact current-fix browser step in run `36466232127` passed visible persistent sidebar switching on desktop/mobile plus Hub -> Puffin -> Hub context changes. |
| Role changes correctly when the same person has different roles in different gyms | PARTIAL | Routing is role-aware in source, but the current disposable two-gym browser fixture is Admin in both gyms. A different-role-per-gym browser fixture is still required. |
| Gym route hint cannot grant access | PASS | Login checks the hinted gym against active memberships before entering it. Protected-route browser guard remains green. |
| Hybrid Hub-only user cannot silently fall back into another gym | PASS | Earlier cross-gym isolation browser test plus explicit-current-context model. |
| Hybrid Hub reset email branding | PASS | Branded delivery and return route verified. |
| Puffin magic-link branding | PASS | Branded delivery and return route verified. |
| Admin invite placeholder resolution | PASS | Resent invite inspected with inviter/role resolved. |
| Open email invite can be resent from dev UI | PASS | Browser run `36119425104` plus delivered resend. |
| Temporary universal-login audit user cleaned | PASS | Workflow cleanup passed and `auth.users` query returned no `delivered@resend.dev` user. |
| Isolated invite-edge fixture cleaned | PASS | Run `36071266688` completed its cleanup step and removed the isolated invite test data. |

## Release gate

Do **not** remove the production hold until:

1. all remaining access-grant and recovery scenarios needed for release are PASS
2. no known cross-gym fallback exists
3. temporary test infrastructure is removed or inert
4. latest candidate smoke/runtime checks are green
5. main/dev are reconciled intentionally
6. the actual production build is browser-tested after promotion


## Latest dev runtime checkpoint

Verified current dev source:

`0654b4a085d463eaaaccd241caf741015e0ac871`

Latest current-head green checks:

- smoke `36467112929`
- public dev runtime `36467112883`
- picker/multi-gym browser step `36466232127` -> PASS on `25ad1f57...`
- repeatable invite browser matrix `36465324428` -> PASS

The Auth journey gate verifies the exact public dev revision before exercising desktop/mobile chooser, switching, refresh/back and sign-out/re-login. The runtime guard still confirms that bare `index.html` hands off to the universal login while embedded/gym/invite contexts remain available.


## 28 September gym-picker resolution

**Gym picker / Switch gym visibility:** **PASS / CLOSED**

- fix commit: `3ee9028a...`
- authenticated browser evidence: run `36466232127` on `25ad1f57...`
- visible persistent shell switch: PASS desktop + mobile
- Hub -> Puffin -> Hub: PASS
- current dev `0654b4a0...` has not changed the picker runtime since that proof

The separate same-user **different-role-per-gym** fixture remains PARTIAL and is the next multi-gym Auth gate.
