-- get_admin_invite(token) was callable by anyone who is not signed in. No page or app screen calls it (the invite page
-- uses get_access_invite), so the public access is removed. Signed-in people can still call it, so nothing is lost.
-- The three public pages keep working: get_access_invite, get_public_gym_brand, get_public_gym_join_options.
revoke execute on function public.get_admin_invite(text) from public, anon;
grant execute on function public.get_admin_invite(text) to authenticated;
