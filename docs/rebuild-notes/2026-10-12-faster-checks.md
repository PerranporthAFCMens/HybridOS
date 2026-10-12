# Faster checks (12 October 2026)

**Why.** The auth journey took 10 minutes 40 seconds on the merge of #254. Timing every step of the last three runs
showed the cause: "Install Playwright Chromium" took 6 min 7 s, 22 s and 3 min on three runs of the same step (the
system-package download is slow on some runs). The login tests themselves take about a minute; the real test emails
take 2 min 14 s every time.

**Also.** The three older browser checks (auth journey, membership personas, protected routing) test the original
pages but started after every merge that touched any `.css`, `.js` or `.html` file, including the new app's styling
under `web/`. Six merges in a row on 12 October each started all three.

**Changes (three workflow files, nothing else).**
1. Each of the three has `'!web/**'` as the last item of its `push` `paths`. A change that touches only `web/` no
   longer starts them; the new app has its own checks (`web-checks`, `web-days`). Any other listed file still does.
2. The browser install step is capped at 180 seconds a try, with up to three tries (as `web-checks` already does).

**Not changed.** Every test and assertion, the emails, the secrets and permissions, the release workflow, and the
invite checks. No check was removed.

**Release gate.** The rule in `AI_WORKING_RULES.md` section 5 still holds: the four required checks must start from
the release commit's own push. Workflow files are not under `web/`, so the "comment-only line in the Auth journey and
protected routing workflow files" step still triggers them. A release candidate that only changes `web/` needs that
line, exactly as before.
