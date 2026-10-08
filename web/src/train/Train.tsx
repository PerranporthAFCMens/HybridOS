import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { listMyPbs, listRecentSessions } from '../data/train';
import { pbValueText } from './pb';
import { dayLabel, dayOf } from '../member/calc';
import type { MemberCtx } from '../member/useMember';
import { comingUp, dueNow, planDay } from './calc';

/** The Train tab: what is planned for today, what is coming, a way to start your own, and what you did lately. */
export function Train() {
  const { gym, userId } = useReadyAuth();
  const d = useOutletContext<MemberCtx>();
  const state = useLocation().state as { saved?: string; pb?: string; pbError?: string | null } | null;
  const pbs = useQuery({ queryKey: ['m-pbs', gym.gymId, userId], queryFn: () => listMyPbs(userId, gym.gymId) });
  const recent = useQuery({ queryKey: ['m-sessions', gym.gymId, userId], queryFn: () => listRecentSessions(userId, gym.gymId) });
  const now = dueNow(d.plans, d.today, dayOf);
  const later = comingUp(d.plans, d.today, dayOf);
  return (
    <div className="mem-screen">
      <h1 className="mem-title">Train</h1>
      {state?.saved && <div className="mem-card mem-ok" role="status">{state.saved}</div>}
      {state?.pb && <div className="mem-card mem-pbwin" role="status">{state.pb}</div>}
      {state?.pbError && <div className="mem-error" role="alert">Your workout is saved, but a personal best could not be saved: {state.pbError}</div>}

      <section className="mem-card" aria-label="Today">
        <h2>Today</h2>
        {now.length === 0 && <div className="muted">Nothing planned. Start your own workout whenever you like.</div>}
        {now.map((p) => {
          const day = planDay(p, dayOf);
          return (
            <div className="mem-line" key={p.id}>
              <div>
                <b>{p.title}</b>
                <div className="muted small">{p.status === 'in_progress' ? 'Started' : day && day < d.today ? `From ${dayLabel(day)}` : 'Suggested for today'}</div>
              </div>
              <Link className="btn primary" to={`/m/train/${p.id}`} aria-label={`${p.status === 'in_progress' ? 'Continue' : 'Start'} ${p.title}`}>{p.status === 'in_progress' ? 'Continue' : 'Start'}</Link>
            </div>
          );
        })}
        <Link className="btn secondary" to="/m/train/new">Start my own workout</Link>
      </section>

      {later.length > 0 && (
        <section className="mem-card" aria-label="Coming up">
          <h2>Coming up</h2>
          {later.map((p) => (
            <div className="mem-line" key={p.id}>
              <div><b>{p.title}</b><div className="muted small">{dayLabel(planDay(p, dayOf) ?? '')}</div></div>
              <Link className="btn secondary" to={`/m/train/${p.id}`} aria-label={`Open ${p.title}`}>Open</Link>
            </div>
          ))}
        </section>
      )}

      <section className="mem-card" aria-label="Personal bests">
        <div className="mem-row"><h2>Personal bests</h2><Link to="/m/train/pbs">See all</Link></div>
        {pbs.isPending && <div className="muted">Loading…</div>}
        {pbs.data?.length === 0 && <div className="muted">Log a workout and your bests appear here.</div>}
        {pbs.data?.slice(0, 3).map((p) => <div className="mem-line" key={p.id}><b>{p.name}</b><span>{pbValueText(p.metric, p.unit, p.value)}</span></div>)}
      </section>

      <section className="mem-card" aria-label="Recent">
        <h2>Recent</h2>
        {recent.isPending && <div className="muted">Loading…</div>}
        {recent.data?.length === 0 && <div className="muted">Your workouts will appear here.</div>}
        {recent.data?.map((s) => <div className="mem-line" key={s.id}><b>{s.title}</b><span className="muted small">{dayLabel(dayOf(s.performedAt))}</span></div>)}
      </section>
    </div>
  );
}
