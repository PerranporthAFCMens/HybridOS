-- PART 2 of the Puffin Performance demo data. Run AFTER puffin_demo_data.sql.
-- Why: the new Members screen lists people who have a login record (auth user + profile + gym member).
-- Part 1 added members without one, so they did not show. This gives each of the 24 demo members a
-- login-less record (a fake @demo.hybridone.invalid email, NO password, so nobody can sign in as them)
-- and links their memberships and payments to it.
-- Touches the sign-in table (auth.users) for these 24 fake emails only. Puffin Performance only.
-- Undo: puffin_demo_data_remove.sql (updated to remove these too).
begin;

do $$
begin
  if (select count(*) from public.members where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and email like '%@demo.hybridone.invalid') <> 24 then
    raise exception 'Run puffin_demo_data.sql first (expected 24 demo members).';
  end if;
  if exists (select 1 from public.members where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and email like '%@demo.hybridone.invalid' and user_id is not null) then
    raise exception 'Part 2 has already been run.';
  end if;
end $$;

-- 1. One login-less sign-in record per demo member (id kept so we can link everything).
create temp table demo_map on commit drop as
select m.id as member_id, gen_random_uuid() as user_id, m.first_name, m.last_name, m.display_name, m.email, m.joined_at
from public.members m
where m.gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and m.email like '%@demo.hybridone.invalid';

-- The text token columns are set to '' (not left empty), which is what Supabase's Auth service expects.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('demo', true), joined_at, now(),
       '', '', '', ''
from demo_map;

-- 2. Profiles (a sign-up trigger may already have made them, so fill in the names either way).
insert into public.profiles (id, first_name, last_name, display_name)
select user_id, first_name, last_name, display_name from demo_map
on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, display_name = excluded.display_name;

-- 3. Gym membership records, so they appear on the Members screen.
insert into public.gym_members (gym_id, user_id, role, is_active, joined_at, access_status)
select 'aec16956-3793-4543-873b-4412646ca1eb', user_id, 'member', true, joined_at, 'active' from demo_map
on conflict (gym_id, user_id) do nothing;

-- 4. Link the existing demo rows to those records.
update public.members m set user_id = d.user_id from demo_map d where m.id = d.member_id;
update public.memberships ms set user_id = d.user_id from demo_map d where ms.member_id = d.member_id;
update public.payment_records pr set user_id = ms.user_id from public.memberships ms
 where pr.membership_id = ms.id and ms.member_id in (select member_id from demo_map);

select 'members with a login record' as what, count(*) from public.gym_members
 where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and user_id in (select user_id from demo_map)
union all select 'memberships linked', count(*) from public.memberships where user_id in (select user_id from demo_map)
union all select 'payments linked', count(*) from public.payment_records where user_id in (select user_id from demo_map);

commit;
