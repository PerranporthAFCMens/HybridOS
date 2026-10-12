-- Class blocks.
--
--   class_blocks / class_block_sessions   a block is a named run of weeks ("Hybrid Uppers, 6 weeks from 12 Oct"). Which
--                                         classes belong to it is the coach's choice (one class, or several a week), so
--                                         the link is its own table and the classes themselves are not changed. Each
--                                         class keeps its own workout (class_session_workouts). Week numbers are worked
--                                         out from the date, never stored. Owners and admins set blocks up; any active
--                                         member of the gym can read them.
-- Rollback: supabase/rollback/20261012_drop_class_blocks.sql

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
