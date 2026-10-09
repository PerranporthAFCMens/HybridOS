# Faster browser checks

The browser step of "HybridOne web app checks" took about 6.5 minutes. Timing each file showed `browser/audit.mjs` (the layout audit) took ~290 of ~410 seconds locally. After opening each screen it waited up to 15 seconds for the admin menu's name to appear, which never exists on member app screens, so the six member screens at three sizes burned ~270 seconds doing nothing. The wait is now skipped on `#/m/` screens.

Result: audit 291s -> 20s with the same 99 checks; the whole `npm run browser` chain ~410s -> ~130s locally. No test was removed or loosened and no workflow changed.

Not needed after this: splitting the checks into parallel jobs. The other 24 files total about two minutes, so extra jobs would cost about as much in setup as they save. Revisit if the chain grows past ~4 minutes.
