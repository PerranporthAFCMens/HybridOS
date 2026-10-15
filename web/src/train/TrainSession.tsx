import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMySession } from '../data/train';
import { dayLabel, dayOf } from '../member/calc';
import { setText } from './calc';

/** One of your own finished workouts: every exercise and the numbers you recorded, with a way to do it again. */
export function TrainSession() {
  const { sessionId = '' } = useParams();
  const { gym, userId } = useReadyAuth();
  const q = useQuery({ queryKey: ['m-session', gym.gymId, userId, sessionId], queryFn: () => getMySession(userId, gym.gymId, sessionId) });
  if (q.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
  if (q.isError || !q.data) return <div className="mem-screen"><h1 className="mem-title">Workout not found</h1><div className="mem-card muted">It may have been removed. <Link to="/m/train">Back to Workouts</Link></div></div>;
  const w = q.data;
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Workouts</Link>
        <h1 className="mem-title">{w.title}</h1>
        <div className="mem-hi">{dayLabel(dayOf(w.performedAt))}</div>
      </div>
      {w.exercises.length === 0 && <div className="mem-card muted">No exercises were saved with this workout.</div>}
      {w.exercises.map((x, i) => (
        <section className="mem-card" key={`${x.name}-${i}`} aria-label={x.name}>
          <h2>{x.name}</h2>
          {x.sets.length === 0 && <div className="muted">No sets saved.</div>}
          {x.sets.map((set, j) => <div className="mem-line" key={j}><span className="muted small">Set {j + 1}</span><span>{setText(x.tracking, set) || '–'}</span></div>)}
          {x.note && <div className="muted small">Note: {x.note}</div>}
        </section>
      ))}
      {w.notes && <div className="mem-card muted small">Notes: {w.notes}</div>}
      <section className="mem-card" aria-label="Do it again">
        <div className="muted small">Starts a new workout with these exercises and the numbers from this one. Change them to today's, then finish.</div>
        <Link className="btn primary" to={`/m/train/again/${w.id}`}>Do it again</Link>
      </section>
    </div>
  );
}
