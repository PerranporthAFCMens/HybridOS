import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { listDebtors } from '../data/arrears';
import { alertLine, biggestDebts } from '../reports/owed';
import { Card } from '../ui/Card';

/**
 * Front dashboard alert for owners and admins: who is not financial and what they owe. It shows nothing when nobody owes
 * anything, and nothing at all to anyone who cannot see money owed (the database refuses them, so the question is not even asked).
 */
export function OwedAlert() {
  const { gym } = useReadyAuth();
  const allowed = gym.role === 'owner' || gym.role === 'admin';
  const q = useQuery({ queryKey: ['owed', gym.gymId], queryFn: () => listDebtors(gym.gymId), enabled: allowed, retry: false });
  if (!allowed || !q.data || q.data.length === 0) return null;
  const top = biggestDebts(q.data);
  return (
    <Card className="full owed-alert" role="region" aria-label="Money owed">
      <div className="owed-alert-top">
        <span className="need-dot warn" aria-hidden="true" />
        <div className="need-text">
          <b>Not financial: {alertLine(q.data)}</b>
          <span>{top.map((t) => `${t.name} ${t.owed}`).join(' · ')}{q.data.length > top.length ? ` · and ${q.data.length - top.length} more` : ''}</span>
        </div>
        <Link className="btn primary" to="/reports?tab=owed">See who owes</Link>
      </div>
    </Card>
  );
}
