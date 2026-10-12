import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMyDone, markFeedbackSeen, markNoticesRead } from '../data/train';
import { dayLabel, dayOf } from '../member/calc';
import type { MemberCtx } from '../member/useMember';
import { readResult, reasonLabel, statusLabel } from './calc';

/** A finished workout the coach set: what you recorded, and anything the coach said about it. */
export function TrainDone() {
  const { id = '' } = useParams();
  const { gym, userId } = useReadyAuth();
  const d = useOutletContext<MemberCtx>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['m-done', gym.gymId, id], queryFn: () => getMyDone(userId, gym.gymId, id) });
  const hasReply = (q.data?.feedback.length ?? 0) > 0;
  const mine = d.notices.filter((n) => n.assignmentId === id).map((n) => n.id).join(',');
  // Opening it is what "seen" means: the reply stops being new, and its notification is cleared.
  useEffect(() => {
    if (!q.data || !hasReply) return;
    void (async () => {
      await markFeedbackSeen(id);
      await markNoticesRead(mine ? mine.split(',') : []);
      await Promise.all([qc.invalidateQueries({ queryKey: ['m-notices'] }), qc.invalidateQueries({ queryKey: ['m-sessions'] })]);
    })();
  }, [q.data, hasReply, id, mine, qc]);

  if (q.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
  if (q.isError || !q.data) return <div className="mem-screen"><h1 className="mem-title">Workout not found</h1><div className="mem-card muted">It may have been removed. <Link to="/m/train">Back to Workouts</Link></div></div>;
  const { done, feedback } = q.data;
  const rows = readResult(done.result);
  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Workouts</Link>
        <h1 className="mem-title">{done.title}</h1>
        <div className="mem-hi">{done.completedAt ? dayLabel(dayOf(done.completedAt)) : ''}{done.rpe ? ` · effort ${done.rpe} of 10` : ''}</div>
      </div>
      <section className="mem-card by-coach" aria-label="What you recorded">
        <div className="mem-row"><h2>What you recorded</h2><span className="mem-tag">Set by your coach</span></div>
        {rows.length === 0 && <div className="muted">Nothing was recorded against the exercises.</div>}
        {rows.map((r) => (
          <div className="tr-res" key={`${r.name}-${r.status}`}>
            <div className="mem-row"><b>{r.swappedTo ? `${r.name} → ${r.swappedTo}` : r.name}</b><span className="mem-tag">{statusLabel(r.status)}</span></div>
            {r.plan && <div className="muted small">Set: {r.plan}</div>}
            {(r.reason || r.note) && <div className="muted small">{[reasonLabel(r.reason), r.note].filter(Boolean).join(': ')}</div>}
          </div>
        ))}
        {done.note && <div className="muted small">Your note: {done.note}</div>}
      </section>
      <section className="mem-card" aria-label="From your coach">
        <h2>From your coach</h2>
        {feedback.length === 0 && <div className="muted">No reply yet. When your coach has looked at it, it will show here.</div>}
        {feedback.map((f) => <div className="tr-reply" key={f.id}>{f.body}</div>)}
      </section>
    </div>
  );
}
