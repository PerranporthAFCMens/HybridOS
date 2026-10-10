# HybridOne web app architecture

The new app described in `REBUILD_PLAN.md`. TypeScript (strict), React, Vite, TanStack Query, Supabase. It is built to `_site/next/` by `scripts/build_site.py` and uses normal routing with clean addresses (`/today`, `/join/<gym>`). The `next` folder is only where the files sit. On Vercel (live) rewrites in `vercel.json` hand each app address to the app; on the GitHub Pages dev preview (a sub-path, `/HybridOS/`) the build also writes `404.html` as a copy of the app page, which does the same job. `VITE_SITE_ROOT` says where the site lives (set by `scripts/build_site.py`); use `siteUrl()` / `BASENAME` from `src/app/site.ts`, never a relative `../` path. A new screen needs its address added to the rewrite list in `vercel.json`. The old pages keep working until each screen is moved and its old page deleted.

## Folder layout

| Folder | What lives there | May import |
| --- | --- | --- |
| `src/data/` | The only code that talks to Supabase: the client, generated `database.types.ts`, one file per area (`memberships.ts`, `auth.ts`, ...) returning plain typed objects | nothing app-level |
| `src/auth/` | The one owner of sign-in and gym context (`AuthProvider`), pure access rules (`access.ts`), selected-gym storage | `data/` |
| `src/shell/` | Sidebar and page frame (`Shell`), and `legacy.ts` (links into old pages not yet moved) | `auth/`, `ui/` |
| `src/members/` | The Members screen: `Members.tsx` (directory), `MemberRecord.tsx` (record and writes), `useMembers.ts` (queries and mutations), `calc.ts` (pure rules, unit tested) | `auth/`, `ui/`, `data/` |
| `src/today/` | The Today screen: `Today.tsx`, `useToday.ts` (queries), `calc.ts` (pure rules, unit tested), `MemberTrend.tsx` | `auth/`, `ui/`, `data/` |
| `src/member/` | The member app (`#/m/*`, own bottom-tab shell `MemberShell`): Today, Classes, Pt, Me (account changes), `Membership.tsx` (pause, change plan, cancel), `useMember.ts` (shared member data), `calc.ts` | `auth/`, `ui/`, `data/`, `train/`, `membership/` |
| `src/train/` | Member workout logging: `Player.tsx` (save each exercise, swap, skip or remove), `Pbs.tsx`, `calc.ts` (sets, reps then weight, left/right), `pb.ts` (personal-best rules), `activities.ts` (exercise name list and tracking guess) | `data/`, `ui/` |
| `src/membership/` | Owner side of membership rules: `Rules.tsx`, `Requests.tsx`, `calc.ts` (form, validation, how the database's options are read) | `auth/`, `ui/`, `data/` |
| `src/builder/` | The report builder: sentence, chart, date periods, compare, starters, print | `data/`, `ui/`, `charts/` |
| `src/ui/` | Brand tokens (`tokens.css`) and shared components (Button, Card, Modal, and the form boxes in `Field.tsx`). The only place a raw `<input>`/`<select>` may appear. | nothing |
| `src/app/` | Router and the sign-in / gym gate | everything |
| `tests/` | Vitest unit and component tests | |
| `browser/` | Playwright browser checks (phone 390px and desktop 1280px) run in CI. `audit.mjs` is the generic layout audit; `today.mjs` and `members.mjs` sign in with a fake session (`mock.mjs`) and mock Supabase at the network layer; `members.mjs` also asserts the exact request of every write | |

## Rules

- Strict TypeScript. `any`, `@ts-ignore` and non-null `!` fail lint.
- Screens never import `data/client.ts` or call Supabase. Add a typed function in `src/data/<area>.ts` and call it through TanStack Query.
- Nobody except `AuthProvider` looks up who the user is or which gym is selected. Screens call `useReadyAuth()`.
- Person first: session, then active memberships, then one selected gym that must match an active membership. Never infer a gym from email, take the first row, or use last-used gym as permission. Newest membership row for the selected gym governs (`auth/access.ts`).
- Shared look lives in `ui/`. No copy-pasted screens; build it once and reuse.
- A screen is moved fully, then its old page is deleted.

## UI rules

Layout and control rules, and the checklist for adding a screen, are in [UI_RULES.md](./UI_RULES.md). `browser/audit.mjs` checks every screen and pop-up at 320, 390 and 1280px; a new screen must be added to it.

## Look

Colours, fonts and radii come from the shared brand layer `assets/brand/brand.css` (the `--hybrid-*` variables, Geist fonts), imported once in `index.html` and bundled by Vite. `ui/tokens.css` only adds app-level values. Do not hard-code brand colours in components.

## Roles

Only owners and admins use this Admin shell. Staff, coaches and members are sent to their own (old) app by `homeFor()` in `auth/access.ts` until those apps move. The member app routes (`/m/*`) open for anyone signed in to a gym, so owners and admins preview them from the sidebar ("Preview as member"); a team login can be given a membership from Members and then uses it like any member.

## Serving rules that bit us

- **Vercel runs with `trailingSlash: false`**, so `/next/` is redirected to `/next`. `index.html` therefore sets `<base href=".../next/">` in an inline script before anything loads, otherwise every relative file path resolves one folder too high and the screen is blank. GitHub Pages (dev) keeps the slash, so dev never shows this. `browser/back.mjs` serves the page at `/next` without the slash and fails without the fix.
- `admin.html` opens the new app only when the browser has opted in (`?next=1`, turned off with `?next=0`) because the Auth journey check drives the old admin frame.
- Pages in `web/` that need a page outside `/next/` use `../` links, which work with or without the slash.
- Browser checks run from one list (`npm run browser`); a new check file must be added to the `browser` script in `package.json`. The layout audit skips the admin-only menu wait on `#/m/` screens.

## Commands (run in `web/`)

- `npm run check`: type check, lint, unit tests, build (what CI runs, plus the browser check)
- `npm run dev`: local dev server
- `npm run build`: writes `../_site/next/`
- Regenerate `src/data/database.types.ts` with the Supabase `generate_typescript_types` tool after any schema change.

## Adding a screen

1. Add typed query functions in `src/data/<area>.ts`.
2. Create a folder `src/<screen>/` with the screen component, a `use<Screen>.ts` query hook and a `calc.ts` for any rules (unit tested), using `useReadyAuth()` and `ui/` components.
3. Add a `<Route>` in `src/app/App.tsx` and a `NavLink` in `shell/Shell.tsx`.
4. Add a unit test; extend `browser/` if it needs a signed-in check.
5. Delete the old page and its build-script entries in the same PR.
