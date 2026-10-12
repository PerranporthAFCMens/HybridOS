# Community in the new member app (2026-10-12)

New **Community** tab in the new member app (`/m/community`, fifth tab). Any member can post, comment, reply (a reply to a reply stays in the same thread), and like or unlike a post or a comment. Members can delete their own posts and comments (asks first); owners and admins moderate from the admin Community screen as before.

- Same tables as the old page and the admin screen (`social_posts`, `social_comments`, `social_reactions`); no database change. A like is the existing `like` reaction, one per person per post or comment (the database already enforces it).
- Fix found on the way: likes on comments were never loaded (the feed asked only for reactions on posts), so comment likes could not be counted or toggled. The feed now loads both.
- Paused or ended memberships cannot write (existing database rule); the error is shown under the post.

## Not in this change (owner's decisions, 12 October)
- **Broadcasts** (owner/admin announcements members can read, like and comment on but not replace or bury) need a database change (a post type, and a rule that only owners and admins can create broadcasts). Next piece; SQL goes to the owner first.
- Strava and the social notification setting are left out for now. The new app has no Strava reference; the old Integrations page goes away at the cutover.

Checks: `web/browser/member-community.mjs` (feed, post, comment, reply to a reply, like and unlike, delete asks first, exact requests, phone and desktop), the admin Community check and the member check updated (five tabs; reaction rows now carry the user), the 320px layout audit (tab labels shrink a little on narrow phones).
