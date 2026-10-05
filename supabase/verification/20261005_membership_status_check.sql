-- Read-only verification for the Stage 2a membership status migration (20261005120000_membership_status_enforcement.sql).
-- Safe to run against any database: it only reads the catalog. One row per check; every `ok` must be true after the
-- migration is applied, and the "before" column of the pre-migration database should show the opposite (all false).
with newest as (
  select 'helper functions exist (current_membership_status, member_status_allows)' as check_name,
         (select count(*) = 2 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname in ('current_membership_status','member_status_allows')) as ok
  union all select 'is_gym_member is status aware',
         coalesce((select pg_get_functiondef(p.oid) like '%member_status_allows%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='is_gym_member'), false)
  union all select 'can_write_gym is status aware',
         coalesce((select pg_get_functiondef(p.oid) like '%member_status_allows%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='can_write_gym'), false)
  union all select 'can_view_profile is status aware',
         coalesce((select pg_get_functiondef(p.oid) like '%member_status_allows%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='can_view_profile'), false)
  union all select 'member_has_class_access uses the newest membership row',
         coalesce((select pg_get_functiondef(p.oid) like '%current_membership_status%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='member_has_class_access'), false)
  union all select 'book_class_session and member_book_class gate on status before any paid drop-in check',
         (select count(*) = 2 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('book_class_session','member_book_class') and pg_get_functiondef(p.oid) like '%member_status_allows%')
  union all select 'member_class_schedule and get_member_home_settings gate on status',
         (select count(*) = 2 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname in ('member_class_schedule','get_member_home_settings') and pg_get_functiondef(p.oid) like '%member_status_allows%')
  union all select 'new helpers are not executable by anon',
         not coalesce((select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('current_membership_status','member_status_allows')), false)
  union all select 'current_membership_status is not executable by authenticated (no status oracle)',
         not coalesce((select has_function_privilege('authenticated', p.oid, 'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='current_membership_status'), true)
  union all select 'none of the 15 replaced permissive policies remains',
         (select count(*) = 0 from pg_policies where schemaname='public' and (tablename, policyname) in (
           ('membership_plans','gym members can read plans'),('gyms','authorized users can read gyms'),
           ('workout_sessions','members_manage_own_workout_sessions'),('workout_entries','members_manage_own_workout_entries'),
           ('workout_sets','members_manage_sets_for_own_entries'),('personal_bests','members_manage_own_personal_bests'),
           ('workout_assignments','members read own workout assignments'),('member_training_preferences','members read own training preferences'),
           ('class_bookings','users can view own class bookings'),('pt_appointments','members can view own pt appointments'),
           ('payment_records','gym users can read relevant payments'),('social_posts','gym members read social posts'),
           ('social_comments','gym members read social comments'),('social_reactions','gym members read social reactions'),
           ('gym_access_settings','gym members can view access settings')))
  union all select 'all 28 new policies are present',
         (select count(*) = 28 from pg_policies where schemaname='public' and policyname in (
           'plans readable by active paused and pending members','members read own gym member row','gyms readable by creator and non-ended members',
           'own workout sessions readable when active or paused','own workout sessions insertable when active','own workout sessions updatable when active','own workout sessions deletable when active',
           'own workout entries readable when active or paused','own workout entries insertable when active','own workout entries updatable when active','own workout entries deletable when active',
           'own workout sets readable when active or paused','own workout sets insertable when active','own workout sets updatable when active','own workout sets deletable when active',
           'own personal bests readable when active or paused','own personal bests insertable when active','own personal bests updatable when active','own personal bests deletable when active',
           'own workout assignments readable when active or paused','own training preferences readable when active or paused',
           'own class bookings readable when active','own pt appointments readable when active','own payments readable when active or admin reads',
           'social posts readable by active members','social comments readable by active members','social reactions readable by active members','access settings readable by active members'))
)
select check_name, ok from newest order by ok, check_name;

-- Policies on every affected table (for the before/after review):
select tablename, policyname, cmd, roles::text as roles
from pg_policies
where schemaname = 'public'
  and tablename in ('membership_plans','gym_members','gyms','workout_sessions','workout_entries','workout_sets','personal_bests',
                    'workout_assignments','member_training_preferences','class_bookings','pt_appointments','payment_records',
                    'social_posts','social_comments','social_reactions','gym_access_settings')
order by tablename, cmd, policyname;
