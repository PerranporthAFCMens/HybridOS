# Fix the dev runtime check for the old login address (20 October 2026)

PR #361 changed `scripts/runtime_pages_check.py` to expect the text `"sign-in/"` (with an opening quote) in the dev-site `login.html` stub. On the dev site the stub redirects to `"/HybridOS/sign-in/"`, so the quote is never directly in front of `sign-in/` and the check could never pass. Every dev gate that runs this script (dev preview, dev runtime, protected routing, auth journey, personas, invite edge matrix) failed on it.

Fix: expect `sign-in/"` instead. No check removed or loosened beyond dropping the impossible opening quote; the stub marker text and the forbidden old-page text are still checked.

Gym touched: none (CI script only).
