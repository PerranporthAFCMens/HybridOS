import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { listMissedPayments } from '../data/arrears';
import { owedOf } from '../reports/owed';
import { pounds } from '../reports/library';

/** A red "Not financial" chip on a member's file when they have missed payments. Only owners and admins can see money owed, so nobody else sees it. */
export function NotFinancial({ gymId, userId }: { gymId: string; userId: string }) {
  const { gym } = useReadyAuth();
  const allowed = gym.role === 'owner' || gym.role === 'admin';
  const q = useQuery({ queryKey: ['missed', gymId, userId], queryFn: () => listMissedPayments(gymId, userId), enabled: allowed, retry: false });
  const owing = owedOf(q.data ?? []);
  if (!allowed || owing <= 0) return null;
  return <span className="chip bad" title="Open Reports, then Money owed, to see what they missed">Not financial · owes {pounds(owing)}</span>;
}
