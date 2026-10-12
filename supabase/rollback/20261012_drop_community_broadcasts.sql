-- Undo 20261012120000_community_broadcasts.sql. Puts the two social_posts rules back exactly as they were and removes
-- the column. Any broadcast becomes an ordinary post (the column is dropped with its values).
begin;
drop policy if exists "gym members create social posts" on public.social_posts;
create policy "gym members create social posts" on public.social_posts for insert to public
  with check (((user_id = auth.uid()) and private.can_write_gym(gym_id)));
drop policy if exists "authors or admins update social posts" on public.social_posts;
create policy "authors or admins update social posts" on public.social_posts for update to "authenticated"
  using ((((user_id = auth.uid()) and private.can_write_gym(gym_id)) or private.has_gym_role(gym_id, array['owner'::gym_member_role, 'admin'::gym_member_role])))
  with check ((((user_id = auth.uid()) and private.can_write_gym(gym_id)) or private.has_gym_role(gym_id, array['owner'::gym_member_role, 'admin'::gym_member_role])));
alter table public.social_posts drop constraint if exists social_posts_kind_check;
alter table public.social_posts drop column if exists kind;
commit;
