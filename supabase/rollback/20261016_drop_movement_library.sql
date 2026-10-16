-- Rollback for 20261016150000_movement_library.sql. Nothing else depends on these tables.
begin;
drop table if exists public.movement_levels;
drop table if exists public.movements;
commit;
