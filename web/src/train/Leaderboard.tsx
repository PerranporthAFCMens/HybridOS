import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLeaderboard } from '../data/classWorkouts';
import { scoreMetricLabel, scoreText, type ScoreMetric } from './calc';

/**
 * The ranked scores for a class workout. Scores are shown unless a member turned that off (in Me) or left one workout off;
 * your own score is always shown to you. Ties share a place.
 */
export function Leaderboard({ sessionId, exercise, metric }: { sessionId: string; exercise: string; metric: ScoreMetric }) {
  const q = useQuery({ queryKey: ['m-leaderboard', sessionId], queryFn: () => getLeaderboard(sessionId) });
  return (
    <section className="mem-card" aria-label="Leaderboard">
      <h2>Leaderboard</h2>
      <div className="muted small">{exercise}: {scoreMetricLabel(metric)}</div>
      {q.isPending && <div className="muted">Loading…</div>}
      {q.isError && <div className="mem-error" role="alert">Could not load the leaderboard.</div>}
      {q.data?.length === 0 && <div className="muted">No scores yet. Record your workout and yours will be here.</div>}
      {q.data && q.data.length > 0 && (
        <ol className="tr-board">
          {q.data.map((r, i) => (
            <li key={`${r.rank}-${i}`} className={r.isMe ? 'me' : ''}>
              <span className="tr-rank">{r.rank}</span>
              <span className="tr-bname">{r.isMe ? `${r.name} (you)` : r.name}</span>
              <b>{scoreText(metric, r.value)}</b>
            </li>
          ))}
        </ol>
      )}
      <div className="muted small">People can choose not to show their scores. You can change yours in <Link to="/m/me">Me</Link>.</div>
    </section>
  );
}
