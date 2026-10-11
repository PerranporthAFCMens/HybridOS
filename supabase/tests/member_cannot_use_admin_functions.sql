-- Guard test: a plain MEMBER of a gym can run only member and self-service functions.
-- It calls every public function a signed-in person is allowed to execute, as a plain member, with harmless dummy arguments,
-- and lists the ones that went through. Every one must be on the reviewed list below. A new function that does not check who
-- is asking will go through, appear here, and fail this test until someone reviews it and adds it (or fixes it).
-- Run on a scratch database only (it inserts a test gym and users).
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000e1','plainmember@x'),('00000000-0000-0000-0000-0000000000e2','other@x') on conflict do nothing;
insert into public.profiles(id) values ('00000000-0000-0000-0000-0000000000e1'),('00000000-0000-0000-0000-0000000000e2') on conflict do nothing;
insert into public.gyms(id,name,slug) values ('00000000-0000-0000-0000-0000000000e9','Guard gym','guard-gym') on conflict do nothing;
insert into public.gym_members(gym_id,user_id,role,is_active) values
  ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000e1','member',true),
  ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000e2','member',true) on conflict do nothing;

create temp table guard_calls(fn text, outcome text, detail text);
grant all on guard_calls to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
do $$
declare r record; args text; i int; t text; n text; lit text; q text;
begin
  for r in
    select p.proname, p.pronargs, p.proargtypes::oid[] as types, p.proargnames as names
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
       and has_function_privilege('authenticated', p.oid, 'execute')
     order by p.proname
  loop
    args := '';
    for i in 1..r.pronargs loop
      t := format_type(r.types[i-1], null);
      n := coalesce(r.names[i], '');
      lit := case
        when t = 'uuid' then case when n ilike '%gym%' then '''00000000-0000-0000-0000-0000000000e9''::uuid'
                                  when n ilike '%user%' or n ilike '%member%' then '''00000000-0000-0000-0000-0000000000e2''::uuid'
                                  else 'gen_random_uuid()' end
        when t in ('text','character varying') then '''x'''
        when t = 'boolean' then 'false'
        when t in ('integer','bigint','smallint','numeric') then '0'
        when t = 'date' then 'current_date'
        when t like 'timestamp%' then 'now()'
        when t = 'jsonb' then '''{}''::jsonb'
        when t = 'json' then '''{}''::json'
        when t = 'uuid[]' then '''{}''::uuid[]'
        when t = 'text[]' then '''{}''::text[]'
        else 'null' end;
      args := args || case when i > 1 then ', ' else '' end || lit || '::' || t;
    end loop;
    q := format('perform public.%I(%s)', r.proname, args);
    begin
      execute 'do $x$ begin ' || q || '; end $x$';
      insert into guard_calls values (r.proname, 'went through', null);
    exception when others then
      insert into guard_calls values (r.proname, 'refused', left(sqlerrm, 90));
    end;
  end loop;
end $$;
reset role;

do $$
declare got text; extra text;
  allowed text[] := array['get_access_invite', 'get_admin_invite', 'get_class_calendar', 'get_member_home_settings', 'get_my_membership_options', 'get_my_private_profile', 'get_my_training_groups', 'member_class_schedule'];
begin
  select string_agg(distinct fn, ', ' order by fn) into got from guard_calls where outcome = 'went through';
  select string_agg(distinct fn, ', ' order by fn) into extra from guard_calls where outcome = 'went through' and fn <> all (allowed);
  raise notice 'functions a plain member can run with dummy arguments: %', got;
  -- fewer is fine (what goes through can depend on what data exists); anything not reviewed is not
  if extra is not null then
    raise exception 'A plain member can run a function that is not on the reviewed list: %', extra;
  end if;
  raise notice 'GUARD: a plain member can run only the reviewed member and self-service functions (% functions checked)', (select count(*) from guard_calls);
end $$;
