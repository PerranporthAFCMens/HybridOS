-- The coach and client training loop: a finished workout is tied to the workout the coach set, the client's report of
-- what changed and why is kept with it, the coach can reply, and the client is told in the app when work arrives or a
-- reply is given.
--
-- What this adds (nothing is removed, no existing row changes):
--   workout_sessions.assignment_id           which assigned workout a finished workout was done for
--   workout_assignments.result               the client's report per exercise (as set / changed / not this time, and why)
--   workout_assignments.feedback_seen_at     when the client last opened the feedback (drives the "new feedback" marker)
--   workout_assignment_feedback              the coach's replies (new table)
--   member_notifications.related_assignment_id   what a notification is about
--   member_notifications: members may read their own and mark them read (they had no permission before)
--   a check that a workout is only linked to an assigned workout set for the same person
--   two triggers that write a notification: when a coach assigns a workout, and when a coach replies
--
-- It does not change any existing access rule. A new check on workout_sessions stops a workout being linked to an assigned
-- workout that was set for someone else.
-- Undo: supabase/rollback/20261012_drop_training_feedback_loop.sql
-- Check: supabase/verification/20261012_training_feedback_loop_check.sql

-- 1. A finished workout points at the assigned workout it was done for.
alter table public.workout_sessions add column assignment_id uuid references public.workout_assignments(id) on delete set null;
create index workout_sessions_assignment_idx on public.workout_sessions (assignment_id) where assignment_id is not null;

-- A workout can only be linked to an assigned workout that was set for the same person in the same gym. This is a check
-- on the row (not a change to the existing access rules), so nobody can borrow someone else's assigned workout.
create function private.enforce_session_assignment() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.assignment_id is not null and not exists (
    select 1 from public.workout_assignments a
    where a.id = new.assignment_id and a.member_user_id = new.user_id and a.gym_id = new.gym_id
  ) then
    raise exception 'That workout was not set for you';
  end if;
  return new;
end $$;
revoke all on function private.enforce_session_assignment() from public, anon, authenticated, service_role;
create trigger workout_session_assignment_owner before insert or update of assignment_id, user_id, gym_id on public.workout_sessions
  for each row execute function private.enforce_session_assignment();

-- 2. The client's own report on an assigned workout, and when they last saw the coach's reply.
alter table public.workout_assignments add column result jsonb;
alter table public.workout_assignments add column feedback_seen_at timestamptz;
alter table public.workout_assignments add constraint workout_assignments_result_check check (result is null or jsonb_typeof(result) = 'object');

-- 3. The coach's replies. Owners, admins, staff and coaches of the gym write them; the client reads those on their own workouts.
create table public.workout_assignment_feedback (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  assignment_id uuid not null references public.workout_assignments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index workout_assignment_feedback_assignment on public.workout_assignment_feedback (assignment_id, created_at);

alter table public.workout_assignment_feedback enable row level security;
revoke all on table public.workout_assignment_feedback from anon, authenticated;
grant select, insert, delete on table public.workout_assignment_feedback to authenticated;

create policy "coaches and the client read workout feedback" on public.workout_assignment_feedback for select to authenticated
  using (
    private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role])
    or exists (select 1 from public.workout_assignments a where a.id = assignment_id and a.member_user_id = (select auth.uid()) and private.is_gym_member(a.gym_id))
  );
create policy "coaches write workout feedback" on public.workout_assignment_feedback for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role])
    and exists (select 1 from public.workout_assignments a where a.id = assignment_id and a.gym_id = workout_assignment_feedback.gym_id)
  );
create policy "authors and owners remove workout feedback" on public.workout_assignment_feedback for delete to authenticated
  using (
    (author_id = (select auth.uid()) and private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]))
    or private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
  );

-- 4. Tell the client in the app. The notification points at the assigned workout.
alter table public.member_notifications add column related_assignment_id uuid references public.workout_assignments(id) on delete cascade;

-- Signed-in members have no permission on this table today (the baseline leaves only REFERENCES, TRIGGER and TRUNCATE), so
-- the app could not show a notification at all. This grants the two things a member needs and nothing more: read, and mark
-- as read (only the read time can be changed). The existing row rules still limit everyone to their own rows.
grant select on table public.member_notifications to authenticated;
grant update (read_at) on table public.member_notifications to authenticated;

create function private.notify_workout_assigned() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.assigned_by is distinct from new.member_user_id then
    insert into public.member_notifications (gym_id, user_id, notification_type, title, body, related_assignment_id)
    values (new.gym_id, new.member_user_id, 'workout_assigned', 'New workout from your coach', new.title, new.id);
  end if;
  return new;
end $$;
revoke all on function private.notify_workout_assigned() from public, anon, authenticated, service_role;
create trigger workout_assigned_notification after insert on public.workout_assignments
  for each row when (new.source = 'pt') execute function private.notify_workout_assigned();

create function private.notify_workout_feedback() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare a record;
begin
  select member_user_id, title into a from public.workout_assignments where id = new.assignment_id;
  if a.member_user_id is not null and a.member_user_id <> new.author_id then
    insert into public.member_notifications (gym_id, user_id, notification_type, title, body, related_assignment_id)
    values (new.gym_id, a.member_user_id, 'workout_feedback', 'Feedback on your workout', a.title, new.assignment_id);
  end if;
  return new;
end $$;
revoke all on function private.notify_workout_feedback() from public, anon, authenticated, service_role;
create trigger workout_feedback_notification after insert on public.workout_assignment_feedback
  for each row execute function private.notify_workout_feedback();
