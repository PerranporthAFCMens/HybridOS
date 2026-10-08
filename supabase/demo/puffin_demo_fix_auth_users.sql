-- FIX for the 24 demo sign-in records added by puffin_demo_members_part2.sql.
-- Why: those rows were inserted by hand with several text columns left empty (NULL). Supabase's Auth service
-- expects an empty string there, and listing users (which the automated Auth journey and membership personas
-- checks do first) can fail while any row has NULL in them. This sets those columns to '' for the demo rows
-- ONLY (email ends @demo.hybridone.invalid). It changes nothing else and is safe to run twice.
begin;

do $$
declare
  c text;
  n integer;
begin
  foreach c in array array[
    'confirmation_token','recovery_token','email_change_token_new','email_change',
    'email_change_token_current','phone_change','phone_change_token','reauthentication_token'
  ] loop
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = c) then
      execute format(
        'update auth.users set %1$I = '''' where email like ''%%@demo.hybridone.invalid'' and %1$I is null', c);
      get diagnostics n = row_count;
      raise notice '% : % row(s) fixed', c, n;
    end if;
  end loop;
end $$;

commit;
