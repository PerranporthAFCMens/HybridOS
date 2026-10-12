-- Class blocks and the class leaderboard.
--
--   class_blocks / class_block_sessions   a block is a named run of weeks ("Hybrid Uppers, 6 weeks from 12 Oct"). Which
--                                         classes belong to it is the coach's choice (one class, or several a week), so
--                                         the link is its own table and the classes themselves are not changed. Each
--                                         class keeps its own workout (class_session_workouts). Week numbers are worked
--                                         out from the date, never stored. Owners and admins set blocks up; any active
--                                         member of the gym can read them.
--   class_session_workouts.score_*        the coach can mark one exercise as "the score" for a class workout (most weight,
--                                         most reps, furthest, most calories, or fastest time).
--   workout_sessions.share_score          a member can leave one recorded workout off the leaderboard.
--   member_score_settings                 a member's own choice to show their scores to others. Scores are shown unless
--                                         the member turns this off (the owner's decision, 12 October 2026).
--   get_class_leaderboard(session)        the ranked scores for one class, for people who are in that class (or run it).
--                                         Members cannot read each other's workouts directly, so this is the only way
--                                         one member sees another's score, and it leaves out anyone who opted out.
-- Rollback: supabase/rollback/20261012_drop_class_blocks_and_leaderboard.sql

create table public.class_blocks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  starts_on date not null,
  weeks smallint not null check (weeks between 1 and 52),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index class_blocks_gym_idx on public.class_blocks (gym_id, starts_on);

create table public.class_block_sessions (
  session_id uuid primary key references public.class_sessions(id) on delete cascade,
  block_id uuid not null references public.class_blocks(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade
);
create index class_block_sessions_block_idx on public.class_block_sessions (block_id);

alter table public.class_blocks enable row level security;
alter table public.class_block_sessions enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.class_blocks, public.class_block_sessions from anon, authenticated, service_role;
grant select, insert, update, delete on table public.class_blocks, public.class_block_sessions to authenticated;

create policy "owners admins manage class blocks" on public.class_blocks for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members read class blocks" on public.class_blocks for select to authenticated
  using (private.is_gym_member(gym_id));
create policy "owners admins manage block classes" on public.class_block_sessions for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members read block classes" on public.class_block_sessions for select to authenticated
  using (private.is_gym_member(gym_id));

-- A class can join a block only in the same gym and only inside the block's weeks (by the gym's own clock).
create function private.enforce_block_session() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare b record; s record;
begin
  select gym_id, starts_on, weeks into b from public.class_blocks where id = new.block_id;
  select cs.gym_id, (cs.starts_at at time zone g.timezone)::date as day into s
    from public.class_sessions cs join public.gyms g on g.id = cs.gym_id where cs.id = new.session_id;
  if b.gym_id is null or s.gym_id is null or b.gym_id <> new.gym_id or s.gym_id <> new.gym_id then
    raise exception 'That class is not in the same gym as the block';
  end if;
  if s.day < b.starts_on or s.day >= b.starts_on + (b.weeks * 7) then
    raise exception 'That class is outside the weeks of this block';
  end if;
  return new;
end $$;
revoke all on function private.enforce_block_session() from public, anon, authenticated, service_role;
create trigger class_block_session_in_range before insert or update of block_id, session_id, gym_id on public.class_block_sessions
  for each row execute function private.enforce_block_session();

-- The score for a class workout: one exercise and what counts (weight, reps, distance and calories: the most; time: the fastest).
alter table public.class_session_workouts add column score_exercise text check (score_exercise is null or char_length(btrim(score_exercise)) between 1 and 120);
alter table public.class_session_workouts add column score_metric text check (score_metric is null or score_metric in ('weight', 'reps', 'time', 'distance', 'calories'));
alter table public.class_session_workouts add constraint class_session_workouts_score_pair check ((score_exercise is null) = (score_metric is null));

-- Leaving one recorded workout off the leaderboard, and a member's overall choice (shown unless they turn it off).
alter table public.workout_sessions add column share_score boolean not null default true;

create table public.member_score_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  share_scores boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.member_score_settings enable row level security;
revoke all on table public.member_score_settings from anon, authenticated, service_role;
grant select, insert, update on table public.member_score_settings to authenticated;
create policy "members manage their own score setting" on public.member_score_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The ranked scores for one class. Only for someone who is in that class (booked or attended) with an active membership,
-- or who runs it (owner, admin, or staff assigned to it). People who opted out, or left that workout off, are not listed
-- (you always see your own row, marked as yours).
create function public.get_class_leaderboard(p_session_id uuid)
returns table (rank integer, display_name text, value numeric, is_me boolean)
  language plpgsql stable security definer set search_path = ''
as $$
declare w record; me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  select cw.gym_id, cw.score_exercise, cw.score_metric into w
    from public.class_session_workouts cw
   where cw.session_id = p_session_id and cw.published_at is not null and cw.score_metric is not null;
  if w.gym_id is null then return; end if;
  if not (
    private.has_gym_role(w.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
    or exists (select 1 from public.class_session_staff css where css.session_id = p_session_id and css.user_id = me and css.gym_id = w.gym_id)
    or (private.is_gym_member(w.gym_id) and exists (
          select 1 from public.class_bookings b
           where b.session_id = p_session_id and b.user_id = me and b.gym_id = w.gym_id and b.status in ('booked', 'attended')))
  ) then
    return;
  end if;
  return query
  with scored as (
    select ws.user_id,
           case w.score_metric
             when 'weight' then max(st.weight_kg)
             when 'reps' then max(st.reps)::numeric
             when 'distance' then max(st.distance_m)
             when 'calories' then max(st.calories)::numeric
             else min(st.duration_seconds)::numeric
           end as v,
           bool_and(ws.share_score) as shared
      from public.workout_sessions ws
      join public.workout_entries e on e.session_id = ws.id
      join public.workout_sets st on st.entry_id = e.id
     where ws.class_session_id = p_session_id and ws.gym_id = w.gym_id
       and lower(btrim(e.exercise_name)) = lower(btrim(w.score_exercise))
     group by ws.user_id
  ), shown as (
    select sc.user_id, sc.v from scored sc
      left join public.member_score_settings m on m.user_id = sc.user_id
     where sc.v is not null and (sc.user_id = me or (sc.shared and coalesce(m.share_scores, true)))
  )
  select (rank() over (order by case when w.score_metric = 'time' then sh.v else -sh.v end))::integer,
         coalesce(nullif(btrim(coalesce(nullif(btrim(p.first_name), ''), '') || ' ' || coalesce(left(nullif(btrim(p.last_name), ''), 1) || '.', '')), ''), nullif(btrim(p.display_name), ''), 'Member'),
         sh.v,
         sh.user_id = me
    from shown sh join public.profiles p on p.id = sh.user_id
   order by 1, 2
   limit 100;
end $$;
revoke all on function public.get_class_leaderboard(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_class_leaderboard(uuid) to authenticated;
