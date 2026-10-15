import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { names } from '../data/clientTraining';
import { MemberTraining } from '../members/MemberTraining';
import { Card, Empty } from '../ui/Card';
import '../members/members.css';

/** One client: send them a workout, see what they have done, reply. Reuses the Training part of the member's file. */
export function StaffClient() {
  const { gym } = useReadyAuth();
  const { userId = '' } = useParams();
  const who = useQuery({ queryKey: ['pt-client-name', gym.gymId, userId], queryFn: async () => (await names([userId])).get(userId) ?? 'Member', enabled: !!userId });
  return (
    <div className="staff-day">
      <Link to="/s/clients" className="staff-back">‹ Clients</Link>
      {who.isPending && <Card><Empty>Loading…</Empty></Card>}
      {who.data && (
        <>
          <h1 className="staff-title">{who.data}</h1>
          <MemberTraining userId={userId} name={who.data} />
        </>
      )}
    </div>
  );
}
