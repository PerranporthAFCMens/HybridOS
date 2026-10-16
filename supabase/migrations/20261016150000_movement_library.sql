-- Programming library, part 1 of 3: the database. No screen changes yet.
--
-- A gym's own list of movements ("Sled Push", "Wall Ball") with an optional video link and coaching cue, and up to three
-- levels per movement (Rx, Scaled, Foundations), each with its own prescription in the same shape the workout builder
-- already saves (display words plus set targets). Nothing existing changes: workouts keep their exercise names, and a movement
-- is matched by its name until the later parts link them.
--
--   public.movements          one row per gym per name (case and spaces ignored). Gym members read; owners, admins, staff and coaches
--                             add and edit. Movements are switched off (is_active = false), never deleted, so old workouts keep their words.
--   public.movement_levels    Rx / Scaled / Foundations prescriptions for a movement. Same people read and write.
--
-- Rollback: supabase/rollback/20261016_drop_movement_library.sql (drops both tables; nothing else depended on them).
begin;

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  key text generated always as (lower(btrim(name))) stored,
  video_url text check (video_url is null or (char_length(video_url) <= 500 and video_url ~* '^https://')),
  cue text check (cue is null or char_length(cue) <= 500),
  default_tracking text not null default 'strength'
    check (default_tracking in ('strength', 'reps', 'time', 'distance', 'calories', 'intervals', 'instruction', 'scores')),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movements_gym_key_unique unique (gym_id, key)
);

create table public.movement_levels (
  movement_id uuid not null references public.movements(id) on delete cascade,
  level text not null check (level in ('rx', 'scaled', 'foundations')),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  prescription jsonb not null default '{}'::jsonb check (jsonb_typeof(prescription) = 'object'),
  notes text check (notes is null or char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  primary key (movement_id, level)
);
create index movement_levels_gym_idx on public.movement_levels (gym_id);

create trigger movements_set_updated_at before update on public.movements for each row execute function public.set_updated_at();
create trigger movement_levels_set_updated_at before update on public.movement_levels for each row execute function public.set_updated_at();

alter table public.movements enable row level security;
alter table public.movement_levels enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.movements, public.movement_levels from anon, authenticated, service_role;
grant select, insert, update on table public.movements to authenticated;
grant select, insert, update, delete on table public.movement_levels to authenticated;

create policy "members read movements" on public.movements for select to authenticated
  using (private.is_gym_member(gym_id));
create policy "staff add movements" on public.movements for insert to authenticated
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]));
create policy "staff edit movements" on public.movements for update to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]));

-- A level's gym must be its movement's gym, so one gym cannot write into another's list.
create policy "members read movement levels" on public.movement_levels for select to authenticated
  using (private.is_gym_member(gym_id));
create policy "staff add movement levels" on public.movement_levels for insert to authenticated
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role])
    and exists (select 1 from public.movements m where m.id = movement_id and m.gym_id = movement_levels.gym_id));
create policy "staff edit movement levels" on public.movement_levels for update to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role])
    and exists (select 1 from public.movements m where m.id = movement_id and m.gym_id = movement_levels.gym_id));
create policy "staff remove movement levels" on public.movement_levels for delete to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]));

commit;
