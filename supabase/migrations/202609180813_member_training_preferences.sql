-- Member-owned preferences are intentionally separate from gym_member_view_settings.
-- gym_member_view_settings is an admin/owner configuration surface.
create table if not exists public.member_training_preferences (
  gym_id uuid not null,
  user_id uuid not null,
  weekly_goal smallint not null default 3 check (weekly_goal between 1 and 14),
  updated_at timestamptz not null default now(),
  primary key (gym_id,user_id)
);

alter table public.member_training_preferences enable row level security;

drop policy if exists "members read own training preferences" on public.member_training_preferences;
create policy "members read own training preferences"
on public.member_training_preferences for select to authenticated
using (
  user_id=auth.uid()
  and exists (
    select 1 from public.gym_members gm
    where gm.gym_id=member_training_preferences.gym_id
      and gm.user_id=auth.uid()
      and gm.is_active=true
  )
);

drop policy if exists "members insert own training preferences" on public.member_training_preferences;
create policy "members insert own training preferences"
on public.member_training_preferences for insert to authenticated
with check (
  user_id=auth.uid()
  and exists (
    select 1 from public.gym_members gm
    where gm.gym_id=member_training_preferences.gym_id
      and gm.user_id=auth.uid()
      and gm.is_active=true
  )
);

drop policy if exists "members update own training preferences" on public.member_training_preferences;
create policy "members update own training preferences"
on public.member_training_preferences for update to authenticated
using (
  user_id=auth.uid()
  and exists (
    select 1 from public.gym_members gm
    where gm.gym_id=member_training_preferences.gym_id
      and gm.user_id=auth.uid()
      and gm.is_active=true
  )
)
with check (
  user_id=auth.uid()
  and exists (
    select 1 from public.gym_members gm
    where gm.gym_id=member_training_preferences.gym_id
      and gm.user_id=auth.uid()
      and gm.is_active=true
  )
);

grant select,insert,update on public.member_training_preferences to authenticated;
