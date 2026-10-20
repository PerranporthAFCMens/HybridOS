# Auth journey check: wait for the gym name on the reset and magic-link page (20 October 2026)

The password-reset and magic-link page shows the plain name "HybridOne" until it has loaded the gym's name (`web/src/auth/AuthReturn.tsx`, `name = brandQ.data?.name ?? 'HybridOne'`). The auth journey check read that name the instant the page heading appeared, so it sometimes caught "HybridOne" instead of "Hybrid Hub" and failed (dev runs after #361 and #367; passed on re-run after #366).

Fix: the check now waits up to 20 seconds for the name to become the expected gym name, in both the reset and magic-link modes. It still fails if the name never becomes right. The page itself is unchanged.

Gym touched: none (CI check only; uses the disposable test account).
