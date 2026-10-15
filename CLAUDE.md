# HybridOne / HybridOS: working rules for Claude

Owner (Adam) is not a developer: plain English, say what a pass or fail looks like. Full rules are in `AI_WORKING_RULES.md`; read the section you need, not the whole file.

## Start of a task (keep it cheap)
- Read `STATUS.md` (short) only. Do not read `docs/status-archive/` or the long docs unless the task needs them; search them with grep instead.
- Auth, login, routing or multi-gym work: also `AUTH_CONTEXT.md`. Auth, invites, email or permissions tests: `AUTH_TEST_MATRIX.md`. UI work: `web/UI_RULES.md` and `web/ARCHITECTURE.md`.
- Read the actual current file before editing. Do not work from memory.

## Layout
- New app: `web/` (strict TypeScript, React, Vite, TanStack Query). All Supabase calls live in `web/src/data/`. Run from `web/`: `npm run check` (typecheck, lint, tests, build); browser checks `npm run browser`.
- Root `*.html`, `*.js`, `*.css` are the old pages. Do not touch them unless the task is to move or delete one.
- Database: `supabase/migrations/` (live schema baseline plus dated migrations). Notes per change: `docs/rebuild-notes/`.

## Workflow
- One change per branch off `dev`, one PR onto `dev`. Never push to `dev` or `main`. Ask before anything touching `main`, releases, rulesets, Vercel or live Supabase.
- PR description: what and why, every file touched, anything noticed but not changed. Add a note file in `docs/rebuild-notes/`; do not edit `STATUS.md` per PR.
- Keep changes small (about 5 files); propose a plan first if bigger. No unrelated clean-ups. Never weaken a test to pass it.
- Evidence before "fixed": command run plus pass/fail counts (summarise, do not paste long logs).
- The repo is public: no secrets, tokens, personal emails or user IDs.

## Database and access
- Members get member functions only, never admin functions. SECURITY DEFINER functions callable from member pages must gate on a role or status helper.
- Every schema change is a migration file with a rollback in `supabase/rollback/`. Never loosen RLS to make a feature work. No service-role keys in frontend code.
- Hand Adam the exact SQL to run in the Supabase SQL editor; never run it against live yourself without his approval of that exact text.
- Gym comes from the shared gym context, never `.limit(1)` or a default id. Say which gym a change touches (Puffin Performance is the test gym; keep experiments off Hybrid Hub).

## Saving tokens
- Prefer grep and targeted reads over opening big files; do not read `package-lock.json`, `supabase/migrations-legacy/` or build output.
- Start a fresh session per PR. Report test results as one summary line plus failures only.
