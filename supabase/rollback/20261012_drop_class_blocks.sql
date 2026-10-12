-- Undo 20261012190000_class_blocks.sql. Removes blocks (and which classes were in them). The classes and their workouts are not touched.
begin;
drop trigger if exists class_block_session_in_range on public.class_block_sessions;
drop function if exists private.enforce_block_session();
drop table if exists public.class_block_sessions;
drop table if exists public.class_blocks;
commit;
