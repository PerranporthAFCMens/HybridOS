import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listGymClasses, listMyClasses, loadMyPermissions, markAttendance } from '../data/staffApp';
import type { BookingStatus } from '../data/classes';

const DAY = 86400000;
/** From the start of today (so this morning's classes can still be marked) to two weeks ahead. */
function span(): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: new Date(start.getTime() + 14 * DAY).toISOString() };
}

export function useMyPermissions(gymId: string, userId: string) {
  return useQuery({ queryKey: ['staff-perms', gymId, userId], queryFn: () => loadMyPermissions(gymId, userId) });
}

export function useMyClasses(gymId: string, userId: string) {
  return useQuery({ queryKey: ['staff-classes', gymId, userId], queryFn: () => { const w = span(); return listMyClasses(gymId, userId, w.from, w.to); } });
}

export function useGymClasses(gymId: string, enabled: boolean) {
  return useQuery({ queryKey: ['staff-gym-classes', gymId], enabled, queryFn: () => { const w = span(); return listGymClasses(gymId, w.from, w.to); } });
}

export function useMarkAttendance(gymId: string, sessionId: string, admin: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { bookingId: string; userId: string; status: BookingStatus }) => markAttendance({ gymId, sessionId, admin, ...v }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['roster', gymId, sessionId] }),
  });
}
