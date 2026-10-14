import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getGymSlug } from '../data/join';
import { Checklist } from '../join/Checklist';

/** Where a member finishes what Quick join left until after paying: emergency contact, waiver, address. */
export function Finish() {
  const { gym } = useReadyAuth();
  const slug = useQuery({ queryKey: ['gym-slug', gym.gymId], queryFn: () => getGymSlug(gym.gymId), retry: false });
  return (
    <div className="mem-screen">
      <Link className="mem-back" to="/m/today">‹ Today</Link>
      <h1 className="mem-title">Finish setting up</h1>
      <section className="mem-card">
        {slug.isPending ? <p className="muted">Loading…</p> : slug.isError ? <p className="mem-error" role="alert">We could not load this page. Please refresh.</p> : <Checklist gymId={gym.gymId} slug={slug.data} />}
      </section>
    </div>
  );
}
