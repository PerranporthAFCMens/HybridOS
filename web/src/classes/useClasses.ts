import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClassSession, listStaffOptions, listTimetable, type NewClass } from '../data/classes';
import { listPlans } from '../data/plans';
import { addDays } from './calc';

export function useTimetable(gymId: string, weekStart: Date) {
  const from = weekStart.toISOString();
  return useQuery({
    queryKey: ['timetable', gymId, from],
    queryFn: () => listTimetable(gymId, from, addDays(weekStart, 7).toISOString()),
  });
}

export function useStaffOptions(gymId: string) {
  return useQuery({ queryKey: ['class-staff', gymId], queryFn: () => listStaffOptions(gymId) });
}

export function useActivePlans(gymId: string) {
  return useQuery({
    queryKey: ['class-plans', gymId],
    queryFn: async () => (await listPlans(gymId)).filter((p) => p.isActive),
  });
}

/** A new class refreshes the timetable and the Today figures. */
export function useCreateClass(gymId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: NewClass) => createClassSession(gymId, c),
    onSettled: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['timetable', gymId] }), qc.invalidateQueries({ queryKey: ['today'] })]);
    },
  });
}
