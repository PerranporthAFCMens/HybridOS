-- Lifts with a leaderboard.
--
--   tracked_lifts         the exercises the gym has ticked as "record PBs / leaderboard" (squat, deadlift...). A row is a tick.
--                         Owners and admins manage the list; any active member can read it.
--   gym_lift_settings     one row per gym with ONE switch: show_by_default. true = people are on the leaderboard until they
--                         opt out (the owner's choice, 12 October 2026); false = nobody is until they opt in. No row = true.
--                         Changing it later changes everyone who has not made a choice of their own, nothing else.
--   member_lift_choice    a member's own choice (show or hide). No row = follow the gym's switch.
--   get_lift_leaderboard  the ranked heaviest lift (from personal_bests) for one ticked exercise. Members cannot read each
--                         other's personal bests directly, so this is the only way one member sees another's, and it
--                         leaves out anyone whose effective choice is "hide" (you always see your own row).
-- Rollback: supabase/rollback/20261012_drop_lift_leaderboard.sql

create table public.tracked_lifts (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  exercise_key text not null check (exercise_key = lower(btrim(exercise_key)) and char_length(exercise_key) between 1 and 120),
  exercise_name text not null check (char_length(btrim(exercise_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (gym_id, exercise_key)
);

create table public.gym_lift_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  show_by_default boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null
);

create table public.member_lift_choice (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  show boolean not null,
  updated_at timestamptz not null default now(),
  primary key (gym_id, user_id)
);

alter table public.tracked_lifts enable row level security;
alter table public.gym_lift_settings enable row level security;
alter table public.member_lift_choice enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.tracked_lifts, public.gym_lift_settings, public.member_lift_choice from anon, authenticated, service_role;
grant select, insert, update, delete on table public.tracked_lifts, public.gym_lift_settings to authenticated;
grant select, insert, update on table public.member_lift_choice to authenticated;

create policy "owners admins manage tracked lifts" on public.tracked_lifts for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members read tracked lifts" on public.tracked_lifts for select to authenticated
  using (private.is_gym_member(gym_id));

create policy "owners admins manage lift settings" on public.gym_lift_settings for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members read lift settings" on public.gym_lift_settings for select to authenticated
  using (private.is_gym_member(gym_id));

create policy "members manage their own lift choice" on public.member_lift_choice for all to authenticated
  using (user_id = auth.uid() and private.is_gym_member(gym_id))
  with check (user_id = auth.uid() and private.is_gym_member(gym_id));

-- The ranked heaviest lifts for one ticked exercise (top 50, plus you if you are further down). Ties share a place.
-- Only for someone who is an active member (or runs the gym). Listed: active members and staff whose effective choice is
-- "show"; the effective choice is their own if they made one, else the gym's switch, else shown.
create function public.get_lift_leaderboard(p_gym_id uuid, p_exercise_key text)
returns table (rank integer, display_name text, value numeric, is_me boolean)
  language plpgsql stable security definer set search_path = ''
as $$
declare me uuid := auth.uid(); k text := lower(btrim(coalesce(p_exercise_key, '')));
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not private.is_gym_member(p_gym_id) then return; end if;
  if not exists (select 1 from public.tracked_lifts t where t.gym_id = p_gym_id and t.exercise_key = k) then return; end if;
  return query
  with eligible as (
    select pb.user_id, max(pb.value_numeric) as v
      from public.personal_bests pb
      join public.gym_members gm on gm.gym_id = pb.gym_id and gm.user_id = pb.user_id and gm.is_active and gm.access_status = 'active'
      left join public.member_lift_choice mc on mc.gym_id = pb.gym_id and mc.user_id = pb.user_id
      left join public.gym_lift_settings gs on gs.gym_id = pb.gym_id
     where pb.gym_id = p_gym_id and pb.exercise_key = k and pb.metric_type = 'weight' and pb.value_numeric > 0
       and (
         gm.role in ('owner', 'admin', 'staff', 'coach')
         or coalesce((select ms.status::text from public.memberships ms where ms.gym_id = pb.gym_id and ms.user_id = pb.user_id
                       and (ms.ends_on is null or ms.ends_on >= current_date)
                      order by ms.created_at desc, ms.id desc limit 1), '') = 'active'
       )
       and (pb.user_id = me or coalesce(mc.show, gs.show_by_default, true))
     group by pb.user_id
  ), ranked as (
    select e.user_id, e.v, (rank() over (order by e.v desc))::integer as r from eligible e
  )
  select rk.r,
         coalesce(nullif(btrim(coalesce(nullif(btrim(p.first_name), ''), '') || ' ' || coalesce(left(nullif(btrim(p.last_name), ''), 1) || '.', '')), ''), nullif(btrim(p.display_name), ''), 'Member'),
         rk.v,
         rk.user_id = me
    from ranked rk join public.profiles p on p.id = rk.user_id
   where rk.r <= 50 or rk.user_id = me
   order by 1, 2;
end $$;
revoke all on function public.get_lift_leaderboard(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.get_lift_leaderboard(uuid, text) to authenticated;
