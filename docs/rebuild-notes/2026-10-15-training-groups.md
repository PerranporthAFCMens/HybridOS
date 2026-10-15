# Training groups moved to the new member app (15 October 2026)

Replaces `groups.html`, `groups.js`, `groups.css` and `group-join.html` (the old files stay until the owner signs off the archive).

- `/m/groups`: your groups, make a new one, copy the invite link.
- `/m/groups/:id`: challenges (ranked results, post your result, make a challenge) and members with recent workouts and PBs.
- `/m/groups/join?code=...`: who invited you, then Join. Linked from the Community tab ("Training groups").
- New invite links point at this screen. Old `group-join.html` links keep working while that page exists.

**No database change.** Uses the existing member functions (`get_my_training_groups`, `get_training_group_dashboard`, `create_training_group`, `create_training_group_challenge`, `submit_training_group_challenge_result`, `preview_training_group_invite`, `join_training_group_by_code`), which already check the caller is signed in and in the group. Gym comes from the shared gym context.

Files: `web/src/groups/`, `web/src/data/groups.ts`, `web/tests/groups.test.ts`, route in `App.tsx`, link in `MemberCommunity.tsx`, two states in `web/browser/audit.mjs`.
