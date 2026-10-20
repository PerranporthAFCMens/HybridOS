import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addBlock, addClosedDay, cancelClass, cancelPtSession, loadBookings, loadMyBlocks, loadRota, loadUpcomingBlocks, removeBlock, removeClosedDay, type NewBlock } from '../data/rota';
import { addDays, dayRange, findClashes, type Clash } from './calc';

export function useRota(gymId: string, start: string) {
  return useQuery({
    queryKey: ['rota', gymId, start],
    queryFn: () => loadRota(gymId, dayRange(start).start.toISOString(), dayRange(addDays(start, 6)).end.toISOString(), start, addDays(start, 6)),
  });
}

/** Every write refreshes the calendar. */
export function useRotaWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['rota', gymId] }), qc.invalidateQueries({ queryKey: ['clashes', gymId] }), qc.invalidateQueries({ queryKey: ['my-blocks', gymId] })]);
  return {
    addBlock: useMutation({ mutationFn: (b: NewBlock) => addBlock(gymId, b), onSettled: refresh }),
    removeBlock: useMutation({ mutationFn: (id: string) => removeBlock(gymId, id), onSettled: refresh }),
    addClosed: useMutation({ mutationFn: (v: { day: string; reason: string | null }) => addClosedDay(gymId, v.day, v.reason), onSettled: refresh }),
    removeClosed: useMutation({ mutationFn: (id: string) => removeClosedDay(gymId, id), onSettled: refresh }),
  };
}

const DAY = 86_400_000;
const horizon = () => { const from = new Date(); return { from: from.toISOString(), to: new Date(+from + 60 * DAY).toISOString() }; };

/** What is already booked during time off in the next 60 days. `userId` limits it to one person (a coach's own screen). */
export function useClashes(gymId: string, userId?: string) {
  return useQuery({
    queryKey: ['clashes', gymId, userId ?? 'all'],
    queryFn: async () => {
      const w = horizon();
      const [blocks, bookings] = await Promise.all([userId ? loadMyBlocks(gymId, userId, w.from) : loadUpcomingBlocks(gymId, w.from, w.to), loadBookings(gymId, w.from, w.to, userId)]);
      return { blocks, clashes: findClashes(blocks, bookings.classes, bookings.pt) };
    },
  });
}

export function useMyBlocks(gymId: string, userId: string) {
  return useQuery({ queryKey: ['my-blocks', gymId, userId], queryFn: () => loadMyBlocks(gymId, userId, new Date().toISOString()) });
}

export function useCancelBooking(gymId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Clash) => (c.kind === 'class' && c.sessionId ? cancelClass(gymId, c.sessionId) : cancelPtSession(gymId, c.appointmentId ?? '')),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['clashes', gymId] }), qc.invalidateQueries({ queryKey: ['classes'] }), qc.invalidateQueries({ queryKey: ['class-calendar'] })]),
  });
}
