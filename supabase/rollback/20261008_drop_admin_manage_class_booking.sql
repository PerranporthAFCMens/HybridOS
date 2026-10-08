-- Undo 20261008150000_admin_manage_class_booking.sql: removes only the new function.
-- Bookings already changed through it stay as they are.
drop function if exists public.admin_manage_class_booking(uuid, uuid, uuid, text);
