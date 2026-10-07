# HybridOne web app architecture

The new app described in `REBUILD_PLAN.md`. TypeScript (strict), React, Vite, TanStack Query, Supabase. It is built to `_site/next/` by `scripts/build_site.py` and uses hash routing (`/next/#/today`), so it runs on GitHub Pages (dev) and Vercel (live) without rewrites. The old pages keep working until each screen is moved and its old page deleted.

## Folder layout

| Folder | What lives there | May import |
| --- | --- | --- |
| `src/data/` | The only code that talks to Supabase: the client, generated `database.types.ts`, one file per area (`memberships.ts`, `auth.ts`, ...) returning plain typed objects | nothing app-level |
| `src/auth/` | The one owner of sign-in and gym context (`AuthProvider`), pure access rules (`access.ts`), selected-gym storage | `data/` |
| `src/shell/` | Sidebar and page frame (`Shell`), and `legacy.ts` (links into old pages not yet moved) | `auth/`, `ui/` |
| `src/today/` | The Today screen: `Today.tsx`, `useToday.ts` (queries), `calc.ts` (pure rules, unit tested), `MemberTrend.tsx` | `auth/`, `ui/`, `data/` |
| `src/ui/` | Brand tokens (`tokens.css`) and shared components (Button, Card, ...) | nothing |
| `src/app/` | Router and the sign-in / gym gate | everything |
| `tests/` | Vitest unit and component tests | |
| `browser/` | Playwright browser checks (phone 390px and desktop 1280px) run in CI. `today.mjs` signs in with a fake session and mocks Supabase at the network layer | |

## Rules

- Strict TypeScript. `any`, `@ts-ignore` and non-null `!` fail lint.
- Screens never import `data/client.ts` or call Supabase. Add a typed function in `src/data/<area>.ts` and call it through TanStack Query.
- Nobody except `AuthProvider` looks up who the user is or which gym is selected. Screens call `useReadyAuth()`.
- Person first: session, then active memberships, then one selected gym that must match an active membership. Never infer a gym from email, take the first row, or use last-used gym as permission. Newest membership row for the selected gym governs (`auth/access.ts`).
- Shared look lives in `ui/`. No copy-pasted screens; build it once and reuse.
- A screen is moved fully, then its old page is deleted.

## Look

Colours, fonts and radii come from the shared brand layer `assets/brand/brand.css` (the `--hybrid-*` variables, Geist fonts), imported once in `index.html` and bundled by Vite. `ui/tokens.css` only adds app-level values. Do not hard-code brand colours in components.

## Roles

Only owners and admins use this Admin shell. Staff, coaches and members are sent to their own (old) app by `homeFor()` in `auth/access.ts` until those apps move.

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
