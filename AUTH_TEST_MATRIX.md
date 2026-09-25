# HybridOne Auth test matrix

**Release gate for the current Auth/tenant work.**

Status meanings:

- **PASS**: runtime/browser or delivery evidence exists for the stated scope
- **PARTIAL**: part of the journey passed, but the whole scenario is not verified
- **NOT TESTED**: no current runtime evidence
- **BLOCKED**: cannot proceed until a named dependency is resolved

| # | Scenario | Status | Current evidence / next requirement |
|---:|---|---|---|
| 1 | Hybrid Hub Owner login | PASS | Automated browser login passed with explicit Hybrid Hub context. |
| 2 | Puffin Performance login | PASS | Automated browser login passed with explicit Puffin context. |
| 3 | Same Auth account enters each gym independently | PASS | Browser matrix confirmed route-bound context for both gyms. |
| 4 | Sign out and return through correct gym login | NOT TESTED | Must browser-test both gym entry routes after sign-out. |
| 5 | Password reset from Hybrid Hub | PARTIAL | Branded reset email and correct production return URL passed. Final link consumption and password update still need browser verification. |
| 6 | Password reset from Puffin Performance | NOT TESTED | Run full Puffin reset journey. |
| 7 | Magic-link sign-in from each gym | PARTIAL | Puffin email branding/return URL passed. Hybrid Hub magic link and actual link consumption still need browser verification. |
| 8 | Member signup confirmation | NOT TESTED | Test confirmation email, gym branding, return route and membership result. |
| 9 | Admin invite in fresh incognito | PARTIAL | Corrected invite and resend delivery passed, and resend UI passed in a live dev Owner browser. Fresh incognito acceptance is still required. |
| 10 | Existing account accepting invite | NOT TESTED | Test invited existing Auth account through acceptance to active Admin membership. |
| 11 | New account accepting invite | NOT TESTED | Test invited new account through password/setup and active Admin membership. |
| 12 | Wrong account already signed in | NOT TESTED | UI contains mismatch handling, but runtime behaviour still needs verification. |
| 13 | Expired and revoked invite | NOT TESTED | Verify both are rejected and cannot activate access. |
| 14 | Owner invite with one active Owner | NOT TESTED | Verify immediate one-Owner approval rule and successful acceptance. |
| 15 | Owner invite with multiple active Owners | NOT TESTED | Hybrid Hub has multiple Owners. Verify all required approvals before send/claim. |
| 16 | Refresh/back on mobile | NOT TESTED | Verify Auth/admin context survives expected navigation without cross-gym fallback or loops. |
| 17 | iPhone admin drawer | PASS | Automated mobile browser test passed the top-level mobile admin handoff/menu. |
| 18 | Staff & Resources mobile layout | PARTIAL | Code and smoke protection exist; final current-browser layout check still required. |

## Additional invariant checks

| Invariant | Status | Evidence |
|---|---|---|
| Hybrid Hub-only user cannot silently fall back into another gym | PASS | Automated wrong-gym browser test rejected access and did not substitute a membership. |
| Hybrid Hub reset email branding | PASS | Sender `Hybrid Hub <noreply@hybridone.co.uk>`, gym-specific subject and correct `gym_id` return URL verified in Resend. |
| Puffin magic-link branding | PASS | Sender `Puffin Performance <noreply@hybridone.co.uk>`, gym-specific subject and correct `gym_id` return URL verified in Resend. |
| Admin invite placeholder resolution | PASS | Corrected resent invite was inspected in Resend; inviter and role placeholders resolved correctly. |
| Open email invite can be resent from dev UI | PASS | Authenticated dev browser test showed **Resend email**, clicked it successfully, and verified delivery. Run `36119425104`. |

## Release gate

Do **not** remove the production hold until:

1. all scenarios that can grant, recover or switch access are PASS
2. no known cross-gym fallback exists
3. temporary test infrastructure is cleaned/inert
4. latest dev smoke is green
5. exact dev Pages checkout SHA is verified from job logs
6. the candidate production build is browser-tested after promotion
