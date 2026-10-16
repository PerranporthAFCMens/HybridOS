-- Rollback for 20261016170000_block_benchmarks.sql. Nothing else depends on this table.
begin;
drop table if exists public.block_benchmarks;
commit;
