import { useQueries } from '@tanstack/react-query';
import {
  countPendingPayments,
  getDisplayName,
  listActiveMembershipValues,
  listChannels,
  listClassSessions,
  listGymMembers,
} from '../data/today';
import { listPlans } from '../data/plans';

/** All data for the Today screen, one cached query per source. */
export function useToday(gymId: string, userId: string, email: string) {
  const [members, values, pending, plans, channels, sessions, name] = useQueries({
    queries: [
      { queryKey: ['today', 'members', gymId], queryFn: () => listGymMembers(gymId) },
      { queryKey: ['today', 'values', gymId], queryFn: () => listActiveMembershipValues(gymId) },
      { queryKey: ['today', 'pending', gymId], queryFn: () => countPendingPayments(gymId) },
      { queryKey: ['today', 'plans', gymId], queryFn: () => listPlans(gymId) },
      { queryKey: ['today', 'channels', gymId], queryFn: () => listChannels(gymId) },
      {
        queryKey: ['today', 'sessions', gymId, new Date().toDateString()],
        queryFn: () => {
          const from = new Date();
          from.setHours(0, 0, 0, 0);
          const to = new Date(from);
          to.setDate(to.getDate() + 7);
          return listClassSessions(gymId, from.toISOString(), to.toISOString());
        },
      },
      { queryKey: ['profile-name', userId], queryFn: () => getDisplayName(userId, email) },
    ],
  });
  return { members, values, pending, plans, channels, sessions, name };
}
