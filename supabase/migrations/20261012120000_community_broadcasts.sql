-- Community broadcasts: announcements from the gym's owners and admins that members can read, like and comment on,
-- but cannot post themselves and cannot bury under their own posts (the app shows them in their own stream).
--
-- A post is either an ordinary 'post' (anyone who is an active member of the gym, as before) or a 'broadcast'.
-- Only an owner or an admin of the gym may create a broadcast, or turn a post into one. Reading, commenting, liking
-- and deleting are unchanged (an author or an owner/admin may delete). Every existing post stays an ordinary post.
--
-- This replaces two existing rules on social_posts (same names, same count): "gym members create social posts" and
-- "authors or admins update social posts". Nothing else is touched.
-- Undo: supabase/rollback/20261012_drop_community_broadcasts.sql
-- Check: supabase/verification/20261012_community_broadcasts_check.sql

alter table public.social_posts add column kind text not null default 'post';
alter table public.social_posts add constraint social_posts_kind_check check (kind in ('post', 'broadcast'));

drop policy "gym members create social posts" on public.social_posts;
create policy "gym members create social posts" on public.social_posts for insert to public
  with check (
    user_id = auth.uid()
    and private.can_write_gym(gym_id)
    and (kind = 'post' or private.has_gym_role(gym_id, array['owner'::gym_member_role, 'admin'::gym_member_role]))
  );

drop policy "authors or admins update social posts" on public.social_posts;
create policy "authors or admins update social posts" on public.social_posts for update to "authenticated"
  using (
    ((user_id = auth.uid()) and private.can_write_gym(gym_id))
    or private.has_gym_role(gym_id, array['owner'::gym_member_role, 'admin'::gym_member_role])
  )
  with check (
    (((user_id = auth.uid()) and private.can_write_gym(gym_id)) or private.has_gym_role(gym_id, array['owner'::gym_member_role, 'admin'::gym_member_role]))
    and (kind = 'post' or private.has_gym_role(gym_id, array['owner'::gym_member_role, 'admin'::gym_member_role]))
  );
