# Production routing check: follow the new sign-in address (18 Oct 2026)

Gym touched: none (release check only).

- After the 18 October release, `/login` and `/login.html` redirect to `/sign-in`, and `/choose-gym.html` to `/choose-gym` (vercel.json). The production routing check still expected `/login` to stay at `/login` with the old page title, so it would fail on the live site.
- The check now expects `/login` and `/login.html` to end at `/sign-in` and `/choose-gym.html` at `/choose-gym`, each serving the app (title "HybridOne"). The other routes are unchanged.
- Run it from a branch or dev until the next release puts this file on main.
