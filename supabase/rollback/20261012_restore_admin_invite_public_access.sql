-- Undo 20261012170000_admin_invite_signed_in_only.sql: get_admin_invite is callable by anyone with the token again.
begin;
grant execute on function public.get_admin_invite(text) to public, anon;
commit;
