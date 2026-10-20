-- Rollback for 20261020100000_class_packs.sql. Removes the pack types, every pack a member holds and the two owner actions.
-- Later parts of class packs (payment, booking) must be rolled back first.
begin;
drop function if exists public.owner_void_class_pack(uuid);
drop function if exists public.owner_give_class_pack(uuid, uuid, uuid);
drop table if exists public.class_packs;
drop table if exists public.class_pack_types;
commit;
