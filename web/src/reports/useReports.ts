import { useQuery } from '@tanstack/react-query';
import { listActiveMembershipPlans, listReportBookings, listReportSessions } from '../data/reports';
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
      const [bookings, plans, activePlanIds, members] = await Promise.all([
        listReportBookings(sessions.map((s) => s.id)),
        listPlans(gymId),
        listActiveMembershipPlans(gymId),
        listGymMembers(gymId),
      ]);
      return { since, sessions, bookings, plans, activePlanIds, members };
    },
  });
}
