-- Undo 20261008120000_update_validated_class_session.sql: removes only the new edit function.
-- Classes already edited through it stay as edited; override rows already written stay.
drop function if exists public.update_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text);
