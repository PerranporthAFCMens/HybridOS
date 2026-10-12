import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { listMyPbs, listRecentSessions, markNoticesRead } from '../data/train';
import { listMyClassWorkouts } from '../data/classWorkouts';
import { listTrackedLifts } from '../data/lifts';
import { getBlocksOfClasses } from '../data/classBlocks';
import { groupClassWorkouts } from './classwork';
import { pbValueText } from './pb';
import { dayLabel, dayOf, timeOf } from '../member/calc';
import type { MemberCtx } from '../member/useMember';
import { coachNote, comingUp, dueNow, planDay } from './calc';

/** The Workouts tab (for every member): what is planned for today, what is coming, a way to start your own, and what you did lately. */
export function Train() {
  const { gym, userId } = useReadyAuth();
  const d = useOutletContext<MemberCtx>();
  const state = useLocation().state as { saved?: string; pb?: string; pbError?: string | null } | null;
  const tracked = useQuery({ queryKey: ['m-tracked-lifts', gym.gymId], queryFn: () => listTrackedLifts(gym.gymId) });
  const pbs = useQuery({ queryKey: ['m-pbs', gym.gymId, userId], queryFn: () => listMyPbs(userId, gym.gymId) });
  const recent = useQuery({ queryKey: ['m-sessions', gym.gymId, userId], queryFn: () => listRecentSessions(userId, gym.gymId) });
  const classes = useQuery({ queryKey: ['m-class-workouts', gym.gymId, userId], queryFn: () => listMyClassWorkouts(userId, gym.gymId) });
  const classIds = (classes.data ?? []).map((c) => c.sessionId);
  const blocks = useQuery({ queryKey: ['m-class-blocks', gym.gymId, classIds.join(',')], queryFn: () => getBlocksOfClasses(classIds), enabled: classIds.length > 0 });
  const classGroups = groupClassWorkouts(classes.data ?? [], blocks.data ?? new Map(), d.today);
  const qc = useQueryClient();
  // The coach's workouts wait in their own list, with no days and no deadlines. Anything else keeps the Today and Coming up lists.
  const fromCoach = d.plans.filter((p) => p.source === 'pt' && (p.status === 'todo' || p.status === 'in_progress'));
  const mine = d.plans.filter((p) => p.source !== 'pt');
  const now = dueNow(mine, d.today, dayOf);
  const later = comingUp(mine, d.today, dayOf);
  // Looking at the list is what "seen" means: clear the new-workout notices.
  const unseen = d.notices.filter((n) => n.kind === 'workout_assigned' || n.kind === 'class_workout').map((n) => n.id);
  useEffect(() => {
    if (unseen.length === 0) return;
    void markNoticesRead(unseen).then(() => qc.invalidateQueries({ queryKey: ['m-notices'] }));
  }, [unseen.join(','), qc]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mem-screen">
      <h1 className="mem-title">Workouts</h1>
      {state?.saved && <div className="mem-card mem-ok" role="status">{state.saved}</div>}
      {state?.pb && <div className="mem-card mem-pbwin" role="status">{state.pb}</div>}
      {state?.pbError && <div className="mem-error" role="alert">Your workout is saved, but a personal best could not be saved: {state.pbError}</div>}

      {fromCoach.length > 0 && (
        <section className="mem-card by-coach" aria-label="From your coach">
          <div className="mem-row"><h2>From your coach</h2><span className="mem-tag">{fromCoach.length} for you</span></div>
          <div className="muted small">Do them whenever suits you. Change, swap or leave out anything.</div>
          {fromCoach.map((p) => {
            const note = coachNote(p.snapshot);
            return (
              <div className="mem-line" key={p.id}>
                <div>
                  <b>{p.title}</b>
                  <div className="muted small">{p.status === 'in_progress' ? 'Started' : 'Waiting for you'}</div>
                  {note && <div className="muted small">“{note}”</div>}
                </div>
                <Link className="btn primary" to={`/m/train/${p.id}`} aria-label={`${p.status === 'in_progress' ? 'Continue' : 'Open'} ${p.title}`}>{p.status === 'in_progress' ? 'Continue' : 'Open'}</Link>
              </div>
            );
          })}
        </section>
      )}

      {(classes.data?.length ?? 0) > 0 && (
        <section className="mem-card by-coach" aria-label="From your classes">
          <div className="mem-row"><h2>From your classes</h2><span className="mem-tag">{classes.data?.length}</span></div>
          <div className="muted small">The workout from a class you were in. Record your weights, reps and times to keep them.</div>
          {classGroups.map((g) => (
            <div key={g.key} role="group" aria-label={g.heading ?? 'Other classes'}>
              {g.heading && <div className="mem-row tr-block-head"><b>{g.heading}</b><span className="muted small">{g.progress}</span></div>}
              {g.items.map((c) => (
                <div className="mem-line" key={c.sessionId}>
                  <div>
                    <b>{c.title}</b>
                    <div className="muted small">{c.week ? `Week ${c.week} · ` : ''}{c.className} · {dayLabel(dayOf(c.startsAt))} {timeOf(c.startsAt)}</div>
                    {c.done && <div className="muted small">Recorded</div>}
                  </div>
                  <Link className={`btn ${c.done ? 'secondary' : 'primary'}`} to={`/m/train/class/${c.sessionId}`} aria-label={`${c.done ? 'View' : 'Record'} ${c.title}, ${c.className}`}>{c.done ? 'View' : 'Record'}</Link>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="mem-card" aria-label="Today">
        <h2>Today</h2>
        {now.length === 0 && <div className="muted">Start your own workout whenever you like.</div>}
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

      {d.flags.pt && (
        <section className="mem-card" aria-label="Personal training">
          <div className="mem-row"><h2>Personal training</h2><Link to="/m/train/pt">See all</Link></div>
          {d.pt[0] ? <div className="mem-line"><b>Next session</b><span>{dayLabel(dayOf(d.pt[0].startsAt))} · {timeOf(d.pt[0].startsAt)}</span></div> : <div className="muted">No sessions booked.</div>}
        </section>
      )}

      <section className="mem-card" aria-label="Personal bests">
        <div className="mem-row"><h2>Personal bests</h2><Link to="/m/train/pbs">See all</Link></div>
        {(tracked.data?.length ?? 0) > 0 && <div className="mem-row"><span className="muted small">Where you stand on the big lifts</span><Link to="/m/train/leaderboard">Leaderboards</Link></div>}
        {pbs.isPending && <div className="muted">Loading…</div>}
        {pbs.data?.length === 0 && <div className="muted">Log a workout and your bests appear here.</div>}
        {pbs.data?.slice(0, 3).map((p) => <div className="mem-line" key={p.id}><b>{p.name}</b><span>{pbValueText(p.metric, p.unit, p.value)}</span></div>)}
      </section>

      <section className="mem-card" aria-label="Recent">
        <h2>Recent</h2>
        {recent.isPending && <div className="muted">Loading…</div>}
        {recent.data?.length === 0 && <div className="muted">Your workouts will appear here.</div>}
        {recent.data?.map((s) => s.assignmentId ? (
          <Link key={s.id} to={`/m/train/done/${s.assignmentId}`} className="mem-card by-coach tr-recent" aria-label={`${s.title}, set by your coach`}>
            <div className="mem-row"><b>{s.title}</b><span className="mem-tag">Set by your coach</span></div>
            <div className="mem-row"><span className="muted small">{dayLabel(dayOf(s.performedAt))}</span>{s.feedbackNew ? <span className="mem-tag new">New feedback</span> : s.feedbackCount > 0 ? <span className="muted small">Feedback read</span> : null}</div>
          </Link>
        ) : <div className="mem-line" key={s.id}><b>{s.title}</b><span className="muted small">{dayLabel(dayOf(s.performedAt))}</span></div>)}
      </section>
    </div>
  );
}
