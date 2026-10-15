# Quick join skipped the sign-before-paying screen (found 15 October 2026, on the live site)

**What the owner saw:** on the live join link the terms and waiver were not shown before paying; they appeared afterwards on the checklist, although Puffin Performance is set to "sign before paying".

**Cause:** the database lets only a signed-in person read a gym's signup documents (`get_public_gym_signup_documents` is revoked from the anonymous role). Quick join asked for them on the first screen, while still signed out, was refused, and then treated the gym as having no documents, so the signing screen was never added. The same fault was on the dev site; it was not noticed because the browser check's pretend database handed the documents to anyone, signed in or not.

**Fix (web only, no database change):** ask for the documents only once signed in (as the full join already does), and until then take a gym set to sign first to have some, so the step count does not change after sign-in. If they cannot be read after sign-in, or there are none, the screen is left out. The browser check's pretend database now refuses the documents to a signed-out caller exactly as the real one does, and a new check says they are never asked for while signed out. I confirmed the check fails on the old code (the signing screen never appears) and passes on the new.

**Files:** `web/src/join/QuickJoin.tsx`, `web/browser/quick-join.mjs`, this note.
**Not changed:** `get_public_gym_signup_documents` stays signed-in only. Making it public would be a database permission change and is the owner's decision.
**Live:** needs a new release to reach the live site (this PR only fixes `dev`).
