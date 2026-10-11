-- Read-only. Run BEFORE applying 20261011200000_join_display_name.sql. Lists every profile the repair would change, with its
-- current display name (an email address) and the name it would get. Save the result: it is the only record of the old values.
select p.id as user_id, p.display_name as current_display_name, btrim(p.first_name) || ' ' || btrim(p.last_name) as new_display_name
  from public.profiles p
 where p.display_name like '%@%'
   and coalesce(btrim(p.first_name), '') <> ''
   and coalesce(btrim(p.last_name), '') <> ''
 order by p.created_at;
