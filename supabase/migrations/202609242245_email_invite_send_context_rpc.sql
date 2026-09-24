create or replace function public.get_email_invite_send_context(
  target_invite_id uuid,
  requesting_user_id uuid
)
returns table(
  invite_id uuid,
  gym_id uuid,
  email text,
  invite_role text,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv public.gym_admin_invites%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select i.* into inv
  from public.gym_admin_invites i
  where i.id = target_invite_id;

  if inv.id is null then raise exception 'Invite not found'; end if;

  if not exists (
    select 1 from public.gym_members gm
    where gm.gym_id = inv.gym_id
      and gm.user_id = requesting_user_id
      and gm.role = 'owner'::public.gym_member_role
      and gm.is_active = true
      and gm.access_status = 'active'
  ) then
    raise exception 'Owner access required';
  end if;

  return query
  select inv.id, inv.gym_id, inv.email, inv.invite_role, inv.status, inv.expires_at;
end;
$$;

revoke all on function public.get_email_invite_send_context(uuid,uuid) from public;
revoke all on function public.get_email_invite_send_context(uuid,uuid) from anon;
revoke all on function public.get_email_invite_send_context(uuid,uuid) from authenticated;
grant execute on function public.get_email_invite_send_context(uuid,uuid) to service_role;
