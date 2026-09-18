-- Hybrid OS Social activity notifications.
-- Applied to Supabase project mzgnhmeydhhpzgxlgudh.
create or replace function public.notify_social_comment_activity()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare post_owner uuid; parent_owner uuid; pref boolean;
begin
 select p.user_id into post_owner from public.social_posts p where p.id=new.post_id and p.gym_id=new.gym_id;
 if new.parent_comment_id is not null then select c.user_id into parent_owner from public.social_comments c where c.id=new.parent_comment_id and c.gym_id=new.gym_id; end if;
 if parent_owner is not null and parent_owner<>new.user_id then
  select coalesce(np.social_notifications,true) into pref from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=parent_owner;
  if coalesce(pref,true) then insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id) values(new.gym_id,parent_owner,'social_reply','New reply in Social',left(new.body,180),new.post_id,new.id); end if;
 end if;
 if post_owner is not null and post_owner<>new.user_id and (parent_owner is null or parent_owner<>post_owner) then
  pref:=null; select coalesce(np.social_notifications,true) into pref from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=post_owner;
  if coalesce(pref,true) then insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id) values(new.gym_id,post_owner,'social_comment','New comment on your post',left(new.body,180),new.post_id,new.id); end if;
 end if;
 return new;
end; $$;
create or replace function public.notify_social_reaction_activity()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare target_user uuid; target_post uuid; pref boolean;
begin
 if new.comment_id is not null then select c.user_id,c.post_id into target_user,target_post from public.social_comments c where c.id=new.comment_id and c.gym_id=new.gym_id;
 elsif new.post_id is not null then select p.user_id,p.id into target_user,target_post from public.social_posts p where p.id=new.post_id and p.gym_id=new.gym_id; end if;
 if target_user is null or target_user=new.user_id then return new; end if;
 select coalesce(np.social_notifications,true) into pref from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=target_user;
 if coalesce(pref,true) then insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id) values(new.gym_id,target_user,'social_reaction','New reaction in Social','Someone reacted to your ' || case when new.comment_id is null then 'post' else 'comment' end || '.',target_post,new.comment_id); end if;
 return new;
end; $$;
drop trigger if exists social_comment_activity_notification on public.social_comments;
create trigger social_comment_activity_notification after insert on public.social_comments for each row execute function public.notify_social_comment_activity();
drop trigger if exists social_reaction_activity_notification on public.social_reactions;
create trigger social_reaction_activity_notification after insert on public.social_reactions for each row execute function public.notify_social_reaction_activity();
revoke all on function public.notify_social_comment_activity() from public, anon, authenticated;
revoke all on function public.notify_social_reaction_activity() from public, anon, authenticated;
