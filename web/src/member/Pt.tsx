import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { listMyPtAll } from '../data/member';
import { dayLabel, dayOf, ptMinutes, ptPastTag, splitPt, timeOf } from './calc';

/** Every personal training session: what is coming, and what has been. Moving one is for the coach. */
export function Pt() {
  const { gym, userId } = useReadyAuth();
  const q = useQuery({ queryKey: ['m-pt-all', gym.gymId, userId], queryFn: () => listMyPtAll(userId, gym.gymId, new Date()) });
  const { upcoming, past } = splitPt(q.data ?? [], new Date());
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Workouts</Link>
        <h1 className="mem-title">Personal training</h1>
        <div className="mem-hi">To move or cancel a session, ask your coach.</div>
      </div>
      {q.isPending && <div className="mem-card muted">Loading…</div>}
      {q.isError && <div className="mem-card muted">Could not load your sessions.</div>}
      {q.data && (
        <>
          <section className="mem-card" aria-label="Coming up">
            <h2>Coming up</h2>
            {upcoming.length === 0 && <div className="muted">No sessions booked.</div>}
            {upcoming.map((r) => (
              <div className="mem-line" key={r.id}>
                <div><b>{dayLabel(dayOf(r.startsAt))}</b><div className="muted small">{timeOf(r.startsAt)}–{timeOf(r.endsAt)} · {ptMinutes(r)} min</div></div>
              </div>
            ))}
          </section>
          <section className="mem-card" aria-label="Past sessions">
            <h2>Past sessions</h2>
            {past.length === 0 && <div className="muted">Your past sessions will be listed here.</div>}
            {past.map((r) => (
              <div className="mem-line" key={r.id}>
                <div><b>{dayLabel(dayOf(r.startsAt))}</b><div className="muted small">{timeOf(r.startsAt)} · {ptMinutes(r)} min</div></div>
                {ptPastTag(r.status) && <span className="mem-pill">{ptPastTag(r.status)}</span>}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
