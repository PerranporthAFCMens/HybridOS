-- Add the invitee's name to access invites.
-- Backward compatible: the new parameter is optional, so the live front end
-- (which sends 4 named arguments) keeps working until it is updated.
begin;

alter table public.gym_admin_invites add column if not exists invitee_name text;

drop function if exists public.create_email_access_invite(uuid,text,text,integer);
drop function if exists public.create_shareable_access_invite(uuid,text,text,integer);

create function public.create_email_access_invite(target_gym_id uuid, invite_email text, requested_role text default 'admin', expires_in_days integer default 7, invitee_name text default null)
 returns table(invite_id uuid, status text, owner_approvals integer, owner_approvals_required integer)
 language plpgsql security definer set search_path to ''
as $function$
declare
  normal_email text:=lower(trim(invite_email));
  normal_role text:=lower(trim(coalesce(requested_role,'admin')));
  clean_name text:=nullif(left(trim(coalesce(invitee_name,'')),120),'');
  required_count integer;
  new_status text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if normal_role not in ('admin','owner') then raise exception 'Invite role must be Admin or Owner'; end if;
  if normal_email is null or position('@' in normal_email)<2 then raise exception 'A valid email address is required'; end if;

  if exists(
    select 1 from public.gym_members gm join auth.users u on u.id=gm.user_id
    where gm.gym_id=target_gym_id and gm.is_active=true and gm.access_status='active' and lower(u.email)=normal_email
  ) then
    raise exception 'That account already has active access to this gym';
  end if;

  update public.gym_admin_invites i
  set status='revoked',revoked_at=now()
  where i.gym_id=target_gym_id and lower(i.email)=normal_email and i.status in ('awaiting_approval','open');

  required_count:=case when normal_role='owner' then private.active_owner_count(target_gym_id) else 1 end;
  if required_count<1 then raise exception 'Gym has no active Owner'; end if;
  new_status:=case when normal_role='owner' and required_count>1 then 'awaiting_approval' else 'open' end;

  insert into public.gym_admin_invites(gym_id,email,token_hash,status,created_by,expires_at,invite_role,invitee_name)
  values(
    target_gym_id,normal_email,'pending-email-token-'||gen_random_uuid()::text,new_status,auth.uid(),
    now()+make_interval(days=>greatest(1,least(coalesce(expires_in_days,7),30))),normal_role,clean_name
  )
  returning id into new_id;

  insert into public.gym_access_invite_approvals(invite_id,owner_user_id)
  values(new_id,auth.uid()) on conflict do nothing;

  return query select new_id,new_status,1,required_count;
end;
$function$;

create function public.create_shareable_access_invite(target_gym_id uuid, invite_email text, requested_role text default 'admin', expires_in_days integer default 7, invitee_name text default null)
 returns table(invite_id uuid, token text, status text, owner_approvals integer, owner_approvals_required integer)
 language plpgsql security definer set search_path to ''
as $function$
declare
  normal_email text:=lower(trim(invite_email));
  normal_role text:=lower(trim(coalesce(requested_role,'admin')));
  clean_name text:=nullif(left(trim(coalesce(invitee_name,'')),120),'');
  required_count integer;
  new_status text;
  new_id uuid;
  raw_token text:=encode(extensions.gen_random_bytes(32),'hex');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if normal_role not in ('admin','owner') then raise exception 'Invite role must be Admin or Owner'; end if;
  if normal_email is null or position('@' in normal_email)<2 then raise exception 'A valid email address is required'; end if;

  if exists(
    select 1 from public.gym_members gm join auth.users u on u.id=gm.user_id
    where gm.gym_id=target_gym_id and gm.is_active=true and gm.access_status='active' and lower(u.email)=normal_email
  ) then
    raise exception 'That account already has active access to this gym';
  end if;

  update public.gym_admin_invites i
  set status='revoked',revoked_at=now()
  where i.gym_id=target_gym_id and lower(i.email)=normal_email and i.status in ('awaiting_approval','open');

  required_count:=case when normal_role='owner' then private.active_owner_count(target_gym_id) else 1 end;
  if required_count<1 then raise exception 'Gym has no active Owner'; end if;
  new_status:=case when normal_role='owner' and required_count>1 then 'awaiting_approval' else 'open' end;

  insert into public.gym_admin_invites(gym_id,email,token_hash,status,created_by,expires_at,invite_role,delivery_method,email_sent_at,invitee_name)
  values(
    target_gym_id,normal_email,encode(extensions.digest(raw_token,'sha256'),'hex'),new_status,auth.uid(),
    now()+make_interval(days=>greatest(1,least(coalesce(expires_in_days,7),30))),normal_role,'link',
    case when new_status='open' then now() else null end,clean_name
  )
  returning id into new_id;

  insert into public.gym_access_invite_approvals(invite_id,owner_user_id)
  values(new_id,auth.uid()) on conflict do nothing;

  return query
  select new_id,case when new_status='open' then raw_token else null end,new_status,1,required_count;
end;
$function$;

revoke all on function public.create_email_access_invite(uuid,text,text,integer,text) from public, anon;
revoke all on function public.create_shareable_access_invite(uuid,text,text,integer,text) from public, anon;
grant execute on function public.create_email_access_invite(uuid,text,text,integer,text) to authenticated, service_role;
grant execute on function public.create_shareable_access_invite(uuid,text,text,integer,text) to authenticated, service_role;

commit;
