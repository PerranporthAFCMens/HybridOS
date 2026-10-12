-- Class workouts: the coach of a class puts a workout on that day's class and makes it available; the people in that
-- class (booked in, or marked attended; not no-shows or cancellations) can open it in the class, record their own
-- weights, reps and times, and keep them (those results feed the same "last time" and personal bests as every other
-- workout). Attendance is often marked after the class, so being booked in is enough to reach it once it is available.
--
--   class_session_workouts          one workout per class session. It is a copy of the workout from the builder (as
--                                   assignments are), so changing the library later never changes a class. It stays a
--                                   draft until the coach makes it available (published_at).
--   workout_sessions.class_session_id  a finished workout points at the class it was done for. A check on the row means
--                                   nobody can link to a class they are not in or that has no available workout.
--   member_notifications            the people in the class are told in the app when a workout is made available.
-- Who can set it: owners and admins, and the staff assigned to that class. Who can read it: those people, and members
-- booked into or marked attended at that class once it is available. Nothing here changes any existing access rule.
-- Rollback: supabase/rollback/20261012_drop_class_workouts.sql

create table public.class_session_workouts (
  session_id uuid primary key references public.class_sessions(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  workout_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(workout_snapshot) = 'object'),
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_session_workouts_gym_idx on public.class_session_workouts (gym_id);

alter table public.class_session_workouts enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.class_session_workouts from anon, authenticated, service_role;
grant select, insert, update, delete on table public.class_session_workouts to authenticated;

-- Owners and admins of the gym, and the staff assigned to that class, manage it (and the class must be in the same gym).
create policy "class staff manage class workouts" on public.class_session_workouts for all to authenticated
  using (
    exists (select 1 from public.class_sessions s where s.id = class_session_workouts.session_id and s.gym_id = class_session_workouts.gym_id)
    and (
      private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
      or exists (select 1 from public.class_session_staff css where css.session_id = class_session_workouts.session_id and css.user_id = auth.uid() and css.gym_id = class_session_workouts.gym_id)
    )
  )
  with check (
    exists (select 1 from public.class_sessions s where s.id = class_session_workouts.session_id and s.gym_id = class_session_workouts.gym_id)
    and (
      private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
      or exists (select 1 from public.class_session_staff css where css.session_id = class_session_workouts.session_id and css.user_id = auth.uid() and css.gym_id = class_session_workouts.gym_id)
    )
  );

-- A member reads it once it is available, and only if they are in that class (booked in or attended) and their
-- membership is active (private.is_gym_member is the status-aware check the other member-facing rules use, such as the
-- community ones; it also exists in the original schema, so this rule does not depend on the membership status migration).
create policy "class members read available class workouts" on public.class_session_workouts for select to authenticated
  using (
    published_at is not null
    and private.is_gym_member(gym_id)
    and exists (
      select 1 from public.class_bookings b
      where b.session_id = class_session_workouts.session_id and b.user_id = auth.uid() and b.gym_id = class_session_workouts.gym_id and b.status in ('booked', 'attended')
    )
  );

-- A finished workout can be linked to a class only by someone in that class, once its workout is available.
alter table public.workout_sessions add column class_session_id uuid references public.class_sessions(id) on delete set null;
create index workout_sessions_class_idx on public.workout_sessions (class_session_id) where class_session_id is not null;

create function private.enforce_session_class() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.class_session_id is not null and not exists (
    select 1
    from public.class_session_workouts w
    join public.class_bookings b on b.session_id = w.session_id and b.gym_id = w.gym_id
    where w.session_id = new.class_session_id and w.gym_id = new.gym_id and w.published_at is not null
      and b.user_id = new.user_id and b.status in ('booked', 'attended')
  ) then
    raise exception 'That class workout is not available to you';
  end if;
  return new;
end $$;
revoke all on function private.enforce_session_class() from public, anon, authenticated, service_role;
create trigger workout_session_class_member before insert or update of class_session_id, user_id, gym_id on public.workout_sessions
  for each row execute function private.enforce_session_class();

-- Tell the people in the class when the workout is made available.
create function private.notify_class_workout_available() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
    insert into public.member_notifications (gym_id, user_id, notification_type, title, body, related_session_id)
    select new.gym_id, b.user_id, 'class_workout', 'Your class workout is ready', new.title, new.session_id
    from public.class_bookings b
    where b.session_id = new.session_id and b.gym_id = new.gym_id and b.status in ('booked', 'attended') and b.user_id is distinct from new.published_by;
  end if;
  return new;
end $$;
revoke all on function private.notify_class_workout_available() from public, anon, authenticated, service_role;
create trigger class_workout_available_notification after insert or update of published_at on public.class_session_workouts
  for each row execute function private.notify_class_workout_available();
