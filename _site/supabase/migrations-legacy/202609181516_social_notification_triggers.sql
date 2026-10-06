create or replace function private.social_notifications_enabled(p_gym_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_members gm
    where gm.gym_id = p_gym_id and gm.user_id = p_user_id and gm.is_active
  ) and coalesce((
    select np.social_notifications
    from public.notification_preferences np
    where np.gym_id = p_gym_id and np.user_id = p_user_id
  ), true);
$$;

create or replace function private.notify_social_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  kind text;
begin
  if new.parent_comment_id is not null then
    select c.user_id into recipient
    from public.social_comments c
    where c.id = new.parent_comment_id and c.gym_id = new.gym_id;
    kind := 'social_reply';
  else
    select p.user_id into recipient
    from public.social_posts p
    where p.id = new.post_id and p.gym_id = new.gym_id;
    kind := 'social_comment';
  end if;

  if recipient is not null and recipient <> new.user_id
     and private.social_notifications_enabled(new.gym_id, recipient) then
    insert into public.member_notifications
      (gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id,scheduled_for)
    values
      (new.gym_id,recipient,kind,
       case when kind='social_reply' then 'New reply' else 'New comment' end,
       case when kind='social_reply' then 'Someone replied to your comment.' else 'Someone commented on your post.' end,
       new.post_id,new.id,now());
  end if;
  return new;
end;
$$;

create or replace function private.notify_social_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  target_post uuid;
  target_comment uuid;
begin
  if new.post_id is not null then
    select p.user_id, p.id into recipient, target_post
    from public.social_posts p
    where p.id = new.post_id and p.gym_id = new.gym_id;
  elsif new.comment_id is not null then
    select c.user_id, c.post_id, c.id into recipient, target_post, target_comment
    from public.social_comments c
    where c.id = new.comment_id and c.gym_id = new.gym_id;
  end if;

  if recipient is not null and recipient <> new.user_id
     and private.social_notifications_enabled(new.gym_id, recipient) then
    insert into public.member_notifications
      (gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id,scheduled_for)
    values
      (new.gym_id,recipient,'social_reaction','New reaction','Someone reacted to your post or comment.',target_post,target_comment,now());
  end if;
  return new;
end;
$$;

drop trigger if exists social_comments_notify_member on public.social_comments;
create trigger social_comments_notify_member
after insert on public.social_comments
for each row execute function private.notify_social_comment();

drop trigger if exists social_reactions_notify_member on public.social_reactions;
create trigger social_reactions_notify_member
after insert on public.social_reactions
for each row execute function private.notify_social_reaction();

revoke all on function private.social_notifications_enabled(uuid,uuid) from public;
revoke all on function private.notify_social_comment() from public;
revoke all on function private.notify_social_reaction() from public;
