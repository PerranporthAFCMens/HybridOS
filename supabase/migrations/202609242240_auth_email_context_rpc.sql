create or replace function public.get_auth_email_context(
  p_user_id uuid,
  p_email text,
  p_gym_id uuid default null,
  p_access_invite text default null,
  p_signup_slug text default null
)
returns table(
  gym_id uuid,
  gym_name text,
  gym_slug text,
  sender_name text,
  sender_email text,
  reply_to_email text,
  sender_domain_status text,
  accent_color text,
  logo_url text,
  footer_text text,
  invited_by text,
  invite_role text,
  access_invite boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_inviter uuid;
  v_invite_role text;
  v_is_invite boolean := false;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if nullif(trim(coalesce(p_access_invite,'')),'') is not null then
    select i.gym_id, i.created_by, i.invite_role
      into v_gym_id, v_inviter, v_invite_role
    from public.gym_admin_invites i
    where i.token_hash = encode(extensions.digest(p_access_invite,'sha256'),'hex')
      and lower(i.email) = lower(trim(coalesce(p_email,'')))
      and i.status = 'open'
      and i.expires_at > now()
    limit 1;

    if v_gym_id is null then return; end if;
    v_is_invite := true;

  elsif nullif(trim(coalesce(p_signup_slug,'')),'') is not null then
    select g.id into v_gym_id
    from public.gyms g
    where g.id = p_gym_id
      and g.slug = p_signup_slug
      and exists (
        select 1
        from public.membership_plans mp
        where mp.gym_id = g.id
          and mp.is_active = true
          and mp.is_public = true
      )
    limit 1;

    if v_gym_id is null then return; end if;

  elsif p_gym_id is not null and p_user_id is not null then
    if exists (
      select 1
      from public.gym_members gm
      where gm.gym_id = p_gym_id
        and gm.user_id = p_user_id
        and gm.is_active = true
    ) then
      v_gym_id := p_gym_id;
    else
      return;
    end if;

  else
    return;
  end if;

  return query
  select
    g.id,
    g.name,
    g.slug,
    coalesce(nullif(trim(s.sender_name),''), g.name),
    s.sender_email,
    s.reply_to_email,
    coalesce(nullif(trim(s.sender_domain_status),''), 'unverified'),
    coalesce(nullif(trim(s.accent_color),''), '#0b1020'),
    s.logo_url,
    coalesce(nullif(trim(s.footer_text),''), 'Sent by ' || g.name || ' via HybridOne'),
    case
      when v_inviter is null then null
      else coalesce(
        nullif(trim(p.display_name),''),
        nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
        'A gym Owner'
      )
    end,
    v_invite_role,
    v_is_invite
  from public.gyms g
  left join public.gym_communication_settings s on s.gym_id = g.id
  left join public.profiles p on p.id = v_inviter
  where g.id = v_gym_id
  limit 1;
end;
$$;

revoke all on function public.get_auth_email_context(uuid,text,uuid,text,text) from public;
revoke all on function public.get_auth_email_context(uuid,text,uuid,text,text) from anon;
revoke all on function public.get_auth_email_context(uuid,text,uuid,text,text) from authenticated;
grant execute on function public.get_auth_email_context(uuid,text,uuid,text,text) to service_role;

create or replace function public.get_auth_email_template(
  p_gym_id uuid,
  p_template_key text
)
returns table(
  subject text,
  preheader text,
  heading text,
  body_text text,
  button_label text,
  enabled boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  select
    t.subject,
    t.preheader,
    t.heading,
    t.body_text,
    t.button_label,
    t.enabled
  from public.gym_email_templates t
  where t.gym_id = p_gym_id
    and t.template_key = p_template_key
  limit 1;
end;
$$;

revoke all on function public.get_auth_email_template(uuid,text) from public;
revoke all on function public.get_auth_email_template(uuid,text) from anon;
revoke all on function public.get_auth_email_template(uuid,text) from authenticated;
grant execute on function public.get_auth_email_template(uuid,text) to service_role;
