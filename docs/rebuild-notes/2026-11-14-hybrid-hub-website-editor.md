# Hybrid Hub website: owner login and live editor

**Date:** 14 November 2026
**Gym touched:** Hybrid Hub's website content only (new per-gym table, empty until an owner publishes). No member, class or payment data changes.

The demo "Edit site" mode (saved in one browser only) is replaced by a real editor on the Hybrid Hub concept site (`preview/hybrid-hub-nqy/`).

- **Owner login** in the footer of every page opens a sign-in box. It uses the normal HybridOne login (Supabase Auth, email and password).
- Only an **active owner or admin of Hybrid Hub** gets edit mode. Anyone else is told their account can't edit the site. The database enforces this too, so the check in the page is only for a friendly message.
- In edit mode the owner clicks any text to change it (small toolbar: Bold, Italic, Link, Unlink, Clear) or "Change photo" on any photo (uploaded to the `website-media` bucket in the gym's own folder). **Publish** saves the page; **Discard** goes back to what is published; edit mode carries over when moving between pages.
- Every visitor's browser reads the published text and photos for the page from `website_pages` (public read) and shows them. A saved edit is only applied to the same built-in text it was made on, so a later change to the page layout can't put text in the wrong place. Only plain formatting is kept (bold, italic, small, line breaks, links).
- No rebuild or deploy is needed when an owner publishes.

Database change (not applied to live until Adam runs it):
- Migration `supabase/migrations/20261114120000_website_content.sql`, rollback `supabase/rollback/20261114_drop_website_content.sql`.
- Test `supabase/tests/website_content_access.sql` (16 checks: owner and admin of the gym can change it; members, staff, an owner of another gym and visitors cannot; visitors can read). Added to the database schema workflow, with its expected counts moved to 105 tables, 190 functions, 246 policies, 45 triggers.

Checks: on a local Supabase rebuilt from the repo migrations, the access test passed 16/16, the rollback removed everything and the migration re-applied cleanly, and the member function guard still passed. A Playwright run against that local copy passed 14/14 (wrong password message, owner signs in, edits text with bold, uploads a photo, publishes, edit mode carries to Train, sign out; a fresh phone-sized visitor sees the new heading, bold word and photo; a Hybrid Hub member who owns another gym is refused, and their direct database write is blocked). Build, smoke test, UI consistency and project control checks passed.

Note: on the same web address as HybridOne, the site shares the HybridOne sign-in, so an owner already signed in to HybridOne goes straight to edit mode and "Sign out" on the site signs them out of HybridOne in that browser too.
