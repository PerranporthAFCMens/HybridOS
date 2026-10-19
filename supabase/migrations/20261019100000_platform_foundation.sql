-- HybridOne Control, step 1: who the platform administrators are, the add-on catalogue, and which add-ons each gym has.
-- DRAFT FOR THE OWNER TO APPROVE. Nothing here is applied by merging; the owner runs the approved text in the SQL editor.
--
--   platform_admins     the short list of people who run HybridOne itself (separate from any gym role). Nobody can read or
--                       change it from the app; it is changed only by the owner in the SQL editor.
--   platform_audit_log  every change made through HybridOne Control: who, what, which gym, when. Platform admins can read it.
--   platform_addons     the catalogue of switchable modules (key, name, whether it is optional). Platform admins edit it;
--                       any signed-in user can read the names (they are not secret).
--   gym_addons          one row per gym per module that has been switched OFF or ON explicitly. No row means the module's
--                       default (platform_addons.default_on). Only the platform functions below change it.
--
-- Functions:
--   private.is_platform_admin()                     true when the caller is on the platform_admins list
--   public.gym_addon_enabled(gym, key)              true when a module is on for a gym. Callable by members of that gym
--                                                   (and platform admins); used by menus and by other database rules
--   public.my_gym_addons(gym)                       the list of module keys switched on for a gym, for the app's menu
--   public.platform_list_gyms()                     every gym with member count and owner email, platform admins only
--   public.platform_set_gym_addon(gym, key, on)     switch one module on or off for one gym, platform admins only, logged
--
-- Hiding a module here is a switch, not security by itself: each important module still needs its own database rule that
-- calls gym_addon_enabled (to be added module by module, with the owner's approval).
-- Rollback: supabase/rollback/20261019_drop_platform_foundation.sql

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table public.platform_addons (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text,
  optional boolean not null default true,
  default_on boolean not null default true,
  sort_order integer not null default 100
);

create table public.gym_addons (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  addon_key text not null references public.platform_addons(key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (gym_id, addon_key)
);

create table public.platform_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  gym_id uuid references public.gyms(id) on delete set null,
  detail jsonb not null default '{}'::jsonb
);

alter table public.platform_admins enable row level security;
alter table public.platform_addons enable row level security;
alter table public.gym_addons enable row level security;
alter table public.platform_audit_log enable row level security;
revoke all on table public.platform_admins, public.platform_addons, public.gym_addons, public.platform_audit_log from anon, authenticated, service_role;
grant select on table public.platform_addons to authenticated;
-- platform_admins, gym_addons and the audit log have no direct grants: they are read and changed only through the functions below.

create function private.is_platform_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.platform_admins a where a.user_id = auth.uid()) $$;
revoke all on function private.is_platform_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated;

create policy "anyone signed in reads the catalogue" on public.platform_addons for select to authenticated using (true);

insert into public.platform_addons (key, name, description, optional, default_on, sort_order) values
  ('classes',        'Classes and timetable',            'Class calendar, booking and attendance', false, true, 10),
  ('class_setup',    'Class setup and resources',        'Class types, rooms and equipment', true, true, 20),
  ('personal_training','Personal training',             'PT sessions, clients and coach plans', true, true, 30),
  ('workouts',       'Workouts and workout builder',     'Programmes, logging and the builder', true, true, 40),
  ('personal_bests', 'Personal bests and leaderboards',  'PBs and lift leaderboards', true, true, 50),
  ('community',      'Community and social',             'Feed, broadcasts and comments', true, true, 60),
  ('groups',         'Training groups and challenges',   'Private groups and challenges', true, true, 70),
  ('messages',       'Messages and notifications',       'Email templates and notifications', true, true, 80),
  ('payments',       'Memberships and payments',         'Plans, Stripe payments and money owed', false, true, 90),
  ('reports',        'Reports and report builder',       'Reports, downloads and Xero export', true, true, 100),
  ('staff_permissions','Staff and access levels',        'Staff logins and access levels', false, true, 110),
  ('integrations',   'Integrations',                     'Strava and other connections', true, true, 120),
  ('member_app',     'Member app',                       'The member side of the app', false, true, 130)
on conflict (key) do nothing;

create function public.gym_addon_enabled(p_gym_id uuid, p_key text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case
    when not (private.is_platform_admin() or private.is_gym_member(p_gym_id)) then false
    else coalesce(
      (select g.enabled from public.gym_addons g where g.gym_id = p_gym_id and g.addon_key = p_key),
      (select a.default_on from public.platform_addons a where a.key = p_key),
      false)
  end
$$;
revoke all on function public.gym_addon_enabled(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.gym_addon_enabled(uuid, text) to authenticated;

create function public.my_gym_addons(p_gym_id uuid) returns text[]
  language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(a.key order by a.sort_order), '{}')
  from public.platform_addons a
  where public.gym_addon_enabled(p_gym_id, a.key)
$$;
revoke all on function public.my_gym_addons(uuid) from public, anon, authenticated, service_role;
grant execute on function public.my_gym_addons(uuid) to authenticated;

create function public.platform_list_gyms() returns table (
  gym_id uuid, name text, slug text, created_at timestamptz, members bigint, owner_email text, addons_off text[]
) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then raise exception 'Not allowed'; end if;
  return query
    select g.id, g.name, g.slug, g.created_at,
      (select count(*) from public.gym_members m where m.gym_id = g.id and m.role = 'member' and m.is_active),
      (select u.email::text from public.gym_members m join auth.users u on u.id = m.user_id
         where m.gym_id = g.id and m.role = 'owner' and m.is_active order by m.joined_at limit 1),
      coalesce((select array_agg(a.key order by a.sort_order) from public.platform_addons a
         where not public.gym_addon_enabled(g.id, a.key)), '{}')
    from public.gyms g order by g.name;
end $$;
revoke all on function public.platform_list_gyms() from public, anon, authenticated, service_role;
grant execute on function public.platform_list_gyms() to authenticated;

create function public.platform_set_gym_addon(p_gym_id uuid, p_key text, p_enabled boolean) returns void
  language plpgsql security definer set search_path = ''
as $$
declare v_optional boolean;
begin
  if not private.is_platform_admin() then raise exception 'Not allowed'; end if;
  select optional into v_optional from public.platform_addons where key = p_key;
  if v_optional is null then raise exception 'Unknown add-on'; end if;
  if not v_optional and not p_enabled then raise exception 'This module is always on'; end if;
  if not exists (select 1 from public.gyms where id = p_gym_id) then raise exception 'Unknown gym'; end if;
  insert into public.gym_addons (gym_id, addon_key, enabled, updated_by) values (p_gym_id, p_key, p_enabled, auth.uid())
    on conflict (gym_id, addon_key) do update set enabled = excluded.enabled, updated_at = now(), updated_by = auth.uid();
  insert into public.platform_audit_log (actor, action, gym_id, detail)
    values (auth.uid(), 'set_gym_addon', p_gym_id, jsonb_build_object('addon', p_key, 'enabled', p_enabled));
end $$;
revoke all on function public.platform_set_gym_addon(uuid, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.platform_set_gym_addon(uuid, text, boolean) to authenticated;

create function public.platform_audit(p_limit integer default 100) returns setof public.platform_audit_log
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then raise exception 'Not allowed'; end if;
  return query select * from public.platform_audit_log order by id desc limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function public.platform_audit(integer) from public, anon, authenticated, service_role;
grant execute on function public.platform_audit(integer) to authenticated;

-- Separate step, run by the owner once (not part of this file, because the repo is public): add yourself as a platform admin.
--   insert into public.platform_admins (user_id, note) select id, 'owner' from auth.users where email = '<your sign-in email>';
