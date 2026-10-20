import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addBlock, addClosedDay, loadRota, removeBlock, removeClosedDay, type NewBlock } from '../data/rota';
import { addDays, dayRange } from './calc';

export function useRota(gymId: string, start: string) {
  return useQuery({
    queryKey: ['rota', gymId, start],
    queryFn: () => loadRota(gymId, dayRange(start).start.toISOString(), dayRange(addDays(start, 6)).end.toISOString(), start, addDays(start, 6)),
  });
}

/** Every write refreshes the calendar. */
export function useRotaWrites(gymId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['rota', gymId] });
  return {
    addBlock: useMutation({ mutationFn: (b: NewBlock) => addBlock(gymId, b), onSettled: refresh }),
    removeBlock: useMutation({ mutationFn: (id: string) => removeBlock(gymId, id), onSettled: refresh }),
    addClosed: useMutation({ mutationFn: (v: { day: string; reason: string | null }) => addClosedDay(gymId, v.day, v.reason), onSettled: refresh }),
    removeClosed: useMutation({ mutationFn: (id: string) => removeClosedDay(gymId, id), onSettled: refresh }),
  };
}
