-- Workout V2 training engine: reusable multi-block workouts, PT assignments and optional gym WODs.
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict, title text not null check (length(trim(title)) between 1 and 120),
  description text, workout_type text not null default 'strength' check (workout_type in ('strength','cardio','conditioning','hybrid','mobility','recovery','custom')),
  focus_tags text[] not null default '{}', estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 600),
  visibility text not null default 'private' check (visibility in ('private','gym')), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workout_template_blocks (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.workout_templates(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade, title text not null,
  block_type text not null default 'standard' check (block_type in ('warmup','standard','strength','circuit','amrap','emom','for_time','intervals','finisher','cooldown','custom')),
  position integer not null default 0, rounds integer check (rounds is null or rounds > 0), instructions text, created_at timestamptz not null default now()
);
create table if not exists public.workout_template_activities (
  id uuid primary key default gen_random_uuid(), block_id uuid not null references public.workout_template_blocks(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete cascade, gym_id uuid not null references public.gyms(id) on delete cascade,
  activity_name text not null, activity_type text not null default 'exercise', tracking_type text not null default 'strength',
  position integer not null default 0, prescription jsonb not null default '{}'::jsonb, notes text, created_at timestamptz not null default now()
);
create table if not exists public.workout_assignments (
  id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null, member_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null, source text not null check (source in ('self','pt','wod')),
  title text not null, workout_type text not null default 'strength', focus_tags text[] not null default '{}',
  workout_snapshot jsonb not null default '{}'::jsonb, scheduled_for date, due_at timestamptz,
  status text not null default 'todo' check (status in ('todo','in_progress','completed','skipped')),
  started_at timestamptz, completed_at timestamptz, member_rpe numeric check (member_rpe is null or member_rpe between 1 and 10),
  member_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workout_wods (
  id uuid primary key default gen_random_uuid(), gym_id uuid not null references public.gyms(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete cascade, published_by uuid not null references auth.users(id) on delete restrict,
  wod_date date not null, message text, is_active boolean not null default true, created_at timestamptz not null default now(), unique(gym_id,wod_date)
);
create index if not exists workout_templates_gym_idx on public.workout_templates(gym_id,is_active);
create index if not exists workout_blocks_template_idx on public.workout_template_blocks(template_id,position);
create index if not exists workout_activities_block_idx on public.workout_template_activities(block_id,position);
create index if not exists workout_assignments_member_idx on public.workout_assignments(member_user_id,status,scheduled_for);
create index if not exists workout_wods_gym_date_idx on public.workout_wods(gym_id,wod_date);
alter table public.workout_templates enable row level security;
alter table public.workout_template_blocks enable row level security;
alter table public.workout_template_activities enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.workout_wods enable row level security;
create policy "staff manage workout templates" on public.workout_templates for all to authenticated using (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[])) with check (created_by=(select auth.uid()) and private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[]));
create policy "members read gym workout templates" on public.workout_templates for select to authenticated using (visibility='gym' and is_active and private.is_gym_member(gym_id));
create policy "staff manage workout blocks" on public.workout_template_blocks for all to authenticated using (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[])) with check (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[]) and exists(select 1 from public.workout_templates t where t.id=template_id and t.gym_id=workout_template_blocks.gym_id));
create policy "members read published workout blocks" on public.workout_template_blocks for select to authenticated using (private.is_gym_member(gym_id) and exists(select 1 from public.workout_templates t where t.id=template_id and t.gym_id=workout_template_blocks.gym_id and t.visibility='gym' and t.is_active));
create policy "staff manage workout activities" on public.workout_template_activities for all to authenticated using (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[])) with check (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[]) and exists(select 1 from public.workout_template_blocks b where b.id=block_id and b.template_id=workout_template_activities.template_id and b.gym_id=workout_template_activities.gym_id));
create policy "members read published workout activities" on public.workout_template_activities for select to authenticated using (private.is_gym_member(gym_id) and exists(select 1 from public.workout_templates t where t.id=template_id and t.gym_id=workout_template_activities.gym_id and t.visibility='gym' and t.is_active));
create policy "members read own workout assignments" on public.workout_assignments for select to authenticated using (member_user_id=(select auth.uid()) and private.is_gym_member(gym_id));
create policy "members create own optional workouts" on public.workout_assignments for insert to authenticated with check (member_user_id=(select auth.uid()) and source in ('self','wod') and private.is_gym_member(gym_id));
create policy "members update own workout assignments" on public.workout_assignments for update to authenticated using (member_user_id=(select auth.uid()) and private.is_gym_member(gym_id)) with check (member_user_id=(select auth.uid()) and private.is_gym_member(gym_id));
create policy "staff manage member workout assignments" on public.workout_assignments for all to authenticated using (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[])) with check (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[]) and exists(select 1 from public.gym_members gm where gm.gym_id=workout_assignments.gym_id and gm.user_id=workout_assignments.member_user_id and gm.is_active));
create policy "gym members read active wods" on public.workout_wods for select to authenticated using (is_active and private.is_gym_member(gym_id));
create policy "staff manage wods" on public.workout_wods for all to authenticated using (private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[])) with check (published_by=(select auth.uid()) and private.has_gym_role(gym_id,array['owner','admin','staff','coach']::public.gym_member_role[]) and exists(select 1 from public.workout_templates t where t.id=template_id and t.gym_id=workout_wods.gym_id));
grant select,insert,update,delete on public.workout_templates,public.workout_template_blocks,public.workout_template_activities,public.workout_assignments,public.workout_wods to authenticated;
