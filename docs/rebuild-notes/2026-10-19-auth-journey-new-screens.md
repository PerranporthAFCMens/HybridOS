# Auth journey check: last old sign-in steps moved to the new screens

Gym touched: none (checks use the Hybrid Hub and Puffin Performance test accounts, as before).

Before: three steps in `.github/workflows/auth-journey-browser.yml` still drove the old pages (`login.html`, `choose-gym.html`, the gym-branded login pages, and the old `auth-return` page elements `#heading`, `#gymBrand`, `#continueBtn`).

After: they use the new screens, the same way the first step already did.
- One-gym login: `/sign-in`, then expects the app (`/today`) and no chooser.
- Reset and magic-link journeys (live site): the link lands on `/auth-return` (via the existing redirect from `auth-return.html`), the gym name, "Choose a new password" / "Secure link verified" and Continue are checked by their visible words, then the new password is used on `/sign-in?gym_id=...` and must open the same gym at `/today`. The old per-gym login path argument is gone.
- Visual audit (manual or `[visual-audit]` only): public pages now photograph `/sign-in` and the two gym-named sign-in links; the login step uses `/sign-in` and `/choose-gym`.

Not changed: the visual audit still opens the old admin, staff and member pages after sign-in; those move with their own cutovers. The link-making edge functions still use `auth-return.html` as the return address; it reaches the new screen through the redirect, which this check now proves on each run.

Checked: workflow file parses; the four embedded scripts pass `node --check`; the new screen's words were matched against `web/browser/authreturn.mjs`. Not run end to end: this workflow only runs from dev with secrets, so its first real run is after merge.
