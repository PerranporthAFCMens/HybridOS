-- Undo 20261114120000_website_content.sql. Removes the website content table and the website photo rules.
-- Any website edits saved since are lost and every site goes back to its built-in wording.
-- The website-media bucket is left in place (Supabase does not allow deleting a bucket that still holds files from SQL);
-- empty it in the Storage screen and delete it there if wanted.
begin;
drop policy if exists "gym owners and admins upload website media" on storage.objects;
drop policy if exists "gym owners and admins replace website media" on storage.objects;
drop policy if exists "gym owners and admins delete website media" on storage.objects;
drop table if exists public.website_pages;
drop function if exists private.stamp_website_page();
commit;
