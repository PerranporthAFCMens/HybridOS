import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkSchedule, createClassSession, listClassTypes, listSchedulingRules, listStaffOptions, listTimetable, type NewClass, type ScheduleProposal } from '../data/classes';
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

export function useClassTypes(gymId: string) {
  return useQuery({ queryKey: ['class-types', gymId], queryFn: () => listClassTypes(gymId) });
}

export function useSchedulingRules(gymId: string) {
  return useQuery({ queryKey: ['scheduling-rules', gymId], queryFn: () => listSchedulingRules(gymId) });
}

/** The database's live verdict on a proposed class. Only asked once there is a class type and a sensible time. */
export function useScheduleCheck(gymId: string, proposal: ScheduleProposal | null) {
  return useQuery({
    queryKey: ['schedule-check', gymId, proposal],
    queryFn: () => checkSchedule(gymId, proposal as ScheduleProposal),
    enabled: !!proposal && !!proposal.classTypeId,
    staleTime: 0,
    gcTime: 0,
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
