# Community broadcasts (2026-10-12)

Owner request: a feed where members post, comment, reply and react, plus **broadcasts** from the owners and admins that members can read, like and comment on but cannot replace or bury.

## What changed
- **Database (needs the owner's approval and SQL run before the app code goes live):** `20261012120000_community_broadcasts.sql` adds `social_posts.kind` (`post` or `broadcast`, every existing post stays `post`) and replaces two existing rules on `social_posts` (same names, same count): only an owner or admin of the gym can create a broadcast or turn a post into one. Reading, commenting, liking and deleting are unchanged. Undo: `supabase/rollback/20261012_drop_community_broadcasts.sql`. Check: `supabase/verification/20261012_community_broadcasts_check.sql`.
- **Admin Community screen:** two buttons, **Send as broadcast** and **Post to the feed**, and broadcasts are labelled.
- **Member Community tab:** two streams, **Feed** and **Broadcasts**. Broadcasts have no composer; members can like and comment, and cannot delete one. The feed shows the latest broadcast as a small card at the top.
- Broadcasts are loaded on their own query (latest 50) so a busy feed (latest 100 posts) can never push an announcement out of view.

## Decisions I made (change if wrong)
- Only owners and admins can broadcast. Staff and coaches cannot.
- Members can comment on and like broadcasts (they cannot post one or edit one).
- No push notification or email when a broadcast is sent yet.

## Testing
Applied the whole migration history to a scratch Postgres with the Supabase roles and schemas stubbed, then: the migration applies; the verification query says ok on every row; `supabase/tests/community_broadcasts.sql` (21 checks: owner, admin, staff, two members, another gym's admin, as the `authenticated` role with real JWT claims) passes, and fails with the migration undone; the rollback restores the previous rules and column; re-applying gives an identical catalog. The same steps now run in `database-schema.yml`. Not run against the live project.

## Order of rollout
1. Owner runs the migration SQL on the live project (safe for the current app: the column has a default and the old code ignores it).
2. Then merge the app change. Merged first, the Community screens would fail to load (they ask for the new column).
