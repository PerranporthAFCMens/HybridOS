import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadNeedsFeedback } from '../data/clientTraining';
import { Card, Empty } from '../ui/Card';
import '../members/members.css';

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

/** Workouts clients have finished that nobody has replied to yet. Each opens on the client's file, where the reply goes. */
export function Review() {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['needs-feedback', gym.gymId], queryFn: () => loadNeedsFeedback(gym.gymId) });
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Training</div>
          <h1>Client training</h1>
          <div className="muted">Workouts you set that clients have finished and nobody has replied to yet.</div>
        </div>
      </header>
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isError && <Card><Empty>Could not load this. Refresh to try again.</Empty></Card>}
      {q.data && q.data.length === 0 && <Card><Empty>Nothing waiting. When a client finishes a workout you set, it shows here.</Empty></Card>}
      {q.data?.map((r) => (
        <Link key={r.assignmentId} to={`/members/${r.memberUserId}`} className="tr-item by-coach" aria-label={`${r.memberName}, ${r.title}`}>
          <span className="tr-head"><b>{r.memberName}</b><span className="tag tr-tag">{r.title}</span></span>
          <span className="muted small">{r.completedAt ? when(r.completedAt) : ''}{r.summary ? ` · ${r.summary}` : ''}</span>
          {r.pain && <span className="tr-flags"><span className="tag">Pain noted</span></span>}
        </Link>
      ))}
      {q.data && q.data.length >= 60 && <p className="muted small">Showing the latest 60.</p>}
    </>
  );
}
