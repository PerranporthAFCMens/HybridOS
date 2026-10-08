import { useQuery } from '@tanstack/react-query';
import { loadLibraryData } from '../data/reportLibrary';
import { listActiveMemberships, listPersonNames, listReportBookings, listReportSessions } from '../data/reports';
import { listPlans } from '../data/plans';
import { listGymMembers } from '../data/today';
import { rangeStart } from './calc';

/** Everything the Overview needs for one date range. */
export function useReportData(gymId: string, rangeDays: number) {
  return useQuery({
    queryKey: ['reports', gymId, rangeDays],
    queryFn: async () => {
      const since = rangeStart(rangeDays, new Date());
      const sessions = await listReportSessions(gymId, since);
      const [bookings, plans, activeMemberships, members] = await Promise.all([
        listReportBookings(sessions.map((s) => s.id)),
        listPlans(gymId),
        listActiveMemberships(gymId),
        listGymMembers(gymId),
      ]);
      const names = await listPersonNames([...activeMemberships.map((m) => m.userId), ...members.map((m) => m.userId)]);
      return { since, sessions, bookings, plans, activeMemberships, members, names };
    },
  });
}

/** Everything the report library needs for one date range. Only loaded once the owner opens the library. */
export function useLibraryData(gymId: string, rangeDays: number, enabled: boolean) {
  return useQuery({
    queryKey: ['report-library', gymId, rangeDays],
    enabled,
    queryFn: () => loadLibraryData(gymId, rangeStart(rangeDays, new Date())),
  });
}
