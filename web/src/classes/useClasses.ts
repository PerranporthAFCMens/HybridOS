import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkSchedule, createClassSession, listClassTypes, listSchedulingRules, listStaffOptions, listTimetable, type NewClass, type ScheduleProposal } from '../data/classes';
import { listPlans } from '../data/plans';
import { addDays, type Occurrence, type WeekResult } from './calc';

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

const CHECKS_AT_ONCE = 4;

/** The database's verdict on every week of a repeating class, a few at a time so a long series does not flood it. */
export function useSeriesCheck(gymId: string, base: Omit<ScheduleProposal, 'startsAt' | 'endsAt'> | null, occurrences: Occurrence[]) {
  return useQuery({
    queryKey: ['series-check', gymId, base, occurrences],
    enabled: !!base && !!base.classTypeId && occurrences.length > 0,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const out = new Array<{ ok: boolean; errors: string[] }>(occurrences.length);
      let next = 0;
      const worker = async () => {
        while (next < occurrences.length) {
          const i = next++;
          const o = occurrences[i] as Occurrence;
          try {
            const v = await checkSchedule(gymId, { ...(base as NonNullable<typeof base>), startsAt: o.startsAt, endsAt: o.endsAt });
            out[i] = { ok: v.ok, errors: v.errors };
          } catch (e) {
            out[i] = { ok: false, errors: [e instanceof Error ? e.message : 'Could not check this week.'] };
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CHECKS_AT_ONCE, occurrences.length) }, worker));
      return out;
    },
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

/** Saves the chosen weeks one at a time (each is checked by the database again) and reports every week. */
export function useCreateSeries(gymId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { base: Omit<NewClass, 'startsAt' | 'endsAt'>; weeks: Occurrence[]; /** Weeks (by start) to schedule despite failing, with one shared reason. */ overrides?: { starts: string[]; reason: string } }): Promise<WeekResult[]> => {
      const results: WeekResult[] = [];
      for (const w of v.weeks) {
        try {
          const verdict = await createClassSession(gymId, { ...v.base, startsAt: w.startsAt, endsAt: w.endsAt, overrideReason: v.overrides?.starts.includes(w.startsAt) ? v.overrides.reason : null });
          results.push({ startsAt: w.startsAt, ok: verdict.ok, errors: verdict.errors });
        } catch (e) {
          results.push({ startsAt: w.startsAt, ok: false, errors: [e instanceof Error ? e.message : 'Could not save this week.'] });
        }
      }
      return results;
    },
    onSettled: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['timetable', gymId] }), qc.invalidateQueries({ queryKey: ['today'] })]);
    },
  });
}
