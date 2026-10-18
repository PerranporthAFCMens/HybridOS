# Auth journey check: accept the trailing slash on the dev preview (18 Oct 2026)

Gym touched: none (release check only; the disposable test account uses Hybrid Hub and Puffin Performance).

- Problem: on the GitHub Pages dev preview, the old page hands an extension-less address to the app with a trailing slash, so "Switch gym" lands on `/choose-gym/?switch=1`. The check only accepted `/choose-gym`, so it timed out.
- Fix: the check's address tests for `/choose-gym` and `/sign-in` now accept an optional trailing slash. Every assertion about what is on the page is unchanged.
- Two comment-only lines (Auth journey, protected routing) so the required checks start from the release commit.
