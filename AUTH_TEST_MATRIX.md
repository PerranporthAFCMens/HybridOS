# HybridOne Auth test matrix

**Updated: 26 September 2026**

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
| 4 | Sign out and sign back in through universal login | NOT TESTED | Sign-out code routes to universal login, but complete sign-out/re-login browser journey remains to be exercised. |
| 5 | Password reset from Hybrid Hub | PASS | Full browser link consumption, new password and login passed in run `36071752904`. |
| 6 | Password reset from Puffin Performance | PASS | Full browser link consumption, new password and login passed in run `36071752904`. |
| 7 | Magic-link sign-in from each gym | PASS | Hub and Puffin full browser magic-link journeys passed in run `36071752904`. |
| 8 | Member signup confirmation | PARTIAL | Product decision locked 26 Sep: self-service member signup must require email confirmation before access. Current live Auth mode still returns an immediate session, so Supabase Email confirmation must be enabled and the full confirmation-link journey browser-tested before PASS. |
| 9 | Admin invite in fresh incognito | PASS | Fresh Playwright browser context consumed the Hybrid Hub Admin magic link and activated Admin access. Run `36069661356`. |
| 10 | Existing account accepting invite | PARTIAL | Existing-account Admin acceptance passed in browser run `36069661356`; keep this partial until the acceptance fixture is repeatable rather than tied to the one claimed invite. |
| 11 | New account accepting invite | PARTIAL | Isolated live backend run `36071266688` created an invite before the Auth account existed, then created the account and claimed active Admin access. Fresh browser Create account/password setup remains to be exercised. |
| 12 | Wrong account already signed in | PARTIAL | Live claim denial passed in isolated run `36071266688` and the current invite page contains explicit account-mismatch handling. Browser exercise of the mismatch/switch-account UI remains. |
| 13 | Expired and revoked invite | PASS | Isolated live run `36071266688` verified revoked and expired invites both fail to claim. |
| 14 | Owner invite with one active Owner | PASS | Isolated live run `36071266688` verified 1/1 approval, shareable token and successful active Owner claim. |
| 15 | Owner invite with multiple active Owners | PASS | Isolated live run `36071266688` verified 1/2 blocks sharing, second Owner approval changes to 2/2/open, then successful active Owner claim. |
| 16 | Refresh/back on mobile | NOT TESTED | Verify selected context survives expected navigation without loops/fallback. |
| 17 | iPhone/mobile Admin navigation | PASS | Existing mobile navigation browser evidence plus current 390px authenticated surface audit. |
| 18 | Staff & Resources mobile layout | PASS | Current authenticated 390px audit loaded Staff/Resources without horizontal overflow. Run `36199919230`. |

## Additional invariants

| Invariant | Status | Evidence |
|---|---|---|
| Universal login loads all active memberships, not first membership | PASS | Two gyms appeared in chooser; account menu loads all active memberships. |
| Multi-gym user can switch after login | PASS | Desktop and mobile account-menu switch passed; desktop sidebar switch also passed. Run `36199919230`. |
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
