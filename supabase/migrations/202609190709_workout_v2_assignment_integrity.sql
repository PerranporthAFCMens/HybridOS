-- Harden Workout V2 assignment integrity and member runtime boundaries.
create unique index if not exists workout_assignments_unique_wod_pickup_idx
on public.workout_assignments(gym_id, member_user_id, template_id, scheduled_for)
where source = 'wod' and template_id is not null and scheduled_for is not null;

create or replace function private.enforce_workout_assignment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_is_staff boolean := false;
begin
  if actor is not null then
    actor_is_staff := private.has_gym_role(new.gym_id, array['owner','admin','staff','coach']::public.gym_member_role[]);
  end if;

  if not exists (
    select 1 from public.gym_members gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.member_user_id
      and gm.is_active
  ) then
    raise exception 'Workout assignment member must be active in this gym';
  end if;

  if new.template_id is not null and not exists (
    select 1 from public.workout_templates wt
    where wt.id = new.template_id and wt.gym_id = new.gym_id
  ) then
    raise exception 'Workout template must belong to the assignment gym';
  end if;

  if new.source = 'wod' then
    if new.template_id is null or new.scheduled_for is null or not exists (
      select 1 from public.workout_wods w
      where w.gym_id = new.gym_id
        and w.template_id = new.template_id
        and w.wod_date = new.scheduled_for
        and w.is_active
    ) then
      raise exception 'WOD assignment must match an active published gym WOD';
    end if;
  end if;

  if tg_op = 'UPDATE' and actor = old.member_user_id and not actor_is_staff then
    if new.gym_id is distinct from old.gym_id
      or new.member_user_id is distinct from old.member_user_id
      or new.template_id is distinct from old.template_id
      or new.assigned_by is distinct from old.assigned_by
      or new.source is distinct from old.source
      or new.title is distinct from old.title
      or new.workout_type is distinct from old.workout_type
      or new.focus_tags is distinct from old.focus_tags
      or new.workout_snapshot is distinct from old.workout_snapshot
      or new.scheduled_for is distinct from old.scheduled_for
      or new.due_at is distinct from old.due_at
      or new.created_at is distinct from old.created_at then
      raise exception 'Members may only update workout progress and completion fields';
    end if;
  end if;

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status <> 'completed' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_workout_assignment_integrity() from public, anon, authenticated;

drop trigger if exists workout_assignment_integrity on public.workout_assignments;
create trigger workout_assignment_integrity
before insert or update on public.workout_assignments
for each row execute function private.enforce_workout_assignment_integrity();
