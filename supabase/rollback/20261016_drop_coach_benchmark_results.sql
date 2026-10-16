-- Rollback for 20261016180000_coach_benchmark_results.sql.
begin;
drop function if exists public.get_block_benchmark_results(uuid);
drop table if exists public.gym_benchmark_settings;
commit;
