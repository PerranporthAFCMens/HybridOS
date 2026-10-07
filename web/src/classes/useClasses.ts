import { useQuery } from '@tanstack/react-query';
import { listTimetable } from '../data/classes';
import { addDays } from './calc';

export function useTimetable(gymId: string, weekStart: Date) {
  const from = weekStart.toISOString();
  return useQuery({
    queryKey: ['timetable', gymId, from],
    queryFn: () => listTimetable(gymId, from, addDays(weekStart, 7).toISOString()),
  });
}
