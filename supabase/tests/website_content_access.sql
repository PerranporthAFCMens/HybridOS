-- Website content: who can read and who can change a gym's website text and photos.
-- Personas: owner and admin of gym A (may edit A), a member of A, an owner of gym B, a staff member of A, and a visitor (anon).
-- Run on a scratch database only. Everything runs inside one transaction and is rolled back.
begin;
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-0000000000f1','web-owner@x'),('00000000-0000-0000-0000-0000000000f2','web-admin@x'),
  ('00000000-0000-0000-0000-0000000000f3','web-member@x'),('00000000-0000-0000-0000-0000000000f4','web-other-owner@x'),
  ('00000000-0000-0000-0000-0000000000f5','web-staff@x');
insert into public.profiles(id) select id from auth.users where email like 'web-%@x' on conflict do nothing;
insert into public.gyms(id,name,slug) values
  ('00000000-0000-0000-0000-0000000000fa','Website gym A','website-gym-a'),('00000000-0000-0000-0000-0000000000fb','Website gym B','website-gym-b');
insert into public.gym_members(gym_id,user_id,role) values
  ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000f1','owner'),
  ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000f2','admin'),
  ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000f3','member'),
  ('00000000-0000-0000-0000-0000000000fb','00000000-0000-0000-0000-0000000000f4','owner'),
  ('00000000-0000-0000-0000-0000000000fa','00000000-0000-0000-0000-0000000000f5','staff');

create temp table web_results(who text, action text, outcome text);
grant all on web_results to anon, authenticated;

create function pg_temp.try(p_who text, p_action text, p_sql text) returns void language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  insert into web_results values (p_who, p_action, case when n > 0 then 'allowed' else 'no rows' end);
exception when insufficient_privilege or check_violation then
  insert into web_results values (p_who, p_action, 'blocked');
end $$;
grant execute on function pg_temp.try(text,text,text) to anon, authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false);
select pg_temp.try('owner A','insert A',$q$insert into public.website_pages(gym_id,page,content) values ('00000000-0000-0000-0000-0000000000fa','index','{"t":{}}')$q$);
select pg_temp.try('owner A','insert B',$q$insert into public.website_pages(gym_id,page,content) values ('00000000-0000-0000-0000-0000000000fb','index','{}')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f2',false);
select pg_temp.try('admin A','update A',$q$update public.website_pages set content='{"t":{"0":{"o":"a","h":"b"}}}' where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f3',false);
select pg_temp.try('member A','read A',$q$select 1 from public.website_pages where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select pg_temp.try('member A','update A',$q$update public.website_pages set content='{}' where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select pg_temp.try('member A','insert A',$q$insert into public.website_pages(gym_id,page,content) values ('00000000-0000-0000-0000-0000000000fa','train','{}')$q$);
select pg_temp.try('member A','delete A',$q$delete from public.website_pages where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f5',false);
select pg_temp.try('staff A','update A',$q$update public.website_pages set content='{}' where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f4',false);
select pg_temp.try('owner B','update A',$q$update public.website_pages set content='{}' where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select pg_temp.try('owner B','insert A',$q$insert into public.website_pages(gym_id,page,content) values ('00000000-0000-0000-0000-0000000000fa','visit','{}')$q$);
select pg_temp.try('owner B','upload photo A',$q$insert into storage.objects(bucket_id,name) values ('website-media','00000000-0000-0000-0000-0000000000fa/x.jpg')$q$);
select pg_temp.try('owner B','upload photo B',$q$insert into storage.objects(bucket_id,name) values ('website-media','00000000-0000-0000-0000-0000000000fb/x.jpg')$q$);
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.try('visitor','read A',$q$select 1 from public.website_pages where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select pg_temp.try('visitor','update A',$q$update public.website_pages set content='{}' where gym_id='00000000-0000-0000-0000-0000000000fa'$q$);
select pg_temp.try('visitor','insert A',$q$insert into public.website_pages(gym_id,page,content) values ('00000000-0000-0000-0000-0000000000fa','x','{}')$q$);
reset role;

-- The admin's edit must have stuck (nobody after them changed it) and been stamped with who made it.
insert into web_results select 'check','content kept and stamped',
  case when content->'t'->'0'->>'h'='b' and updated_by='00000000-0000-0000-0000-0000000000f2' then 'allowed' else 'wrong' end
  from public.website_pages where gym_id='00000000-0000-0000-0000-0000000000fa' and page='index';

do $$
declare expected text[][] := array[
  ['owner A','insert A','allowed'],['owner A','insert B','blocked'],['admin A','update A','allowed'],
  ['member A','read A','allowed'],['member A','update A','no rows'],['member A','insert A','blocked'],['member A','delete A','no rows'],
  ['staff A','update A','no rows'],['owner B','update A','no rows'],['owner B','insert A','blocked'],
  ['owner B','upload photo A','blocked'],['owner B','upload photo B','allowed'],
  ['visitor','read A','allowed'],['visitor','update A','blocked'],['visitor','insert A','blocked'],
  ['check','content kept and stamped','allowed']];
  i int; got text; bad int := 0;
begin
  for i in 1..array_length(expected,1) loop
    select outcome into got from web_results where who=expected[i][1] and action=expected[i][2];
    raise notice '% | % | % (expected %)', expected[i][1], expected[i][2], coalesce(got,'missing'), expected[i][3];
    if got is distinct from expected[i][3] then bad := bad + 1; end if;
  end loop;
  if bad > 0 then raise exception '% website content access checks failed', bad; end if;
  raise notice 'website content access: all % checks passed', array_length(expected,1);
end $$;
rollback;
