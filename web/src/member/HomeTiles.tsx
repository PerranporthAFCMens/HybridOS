import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ClassRow, MyPlan, PtRow } from '../data/member';
import type { Notice, SessionRow } from '../data/train';
import type { Cta } from '../memberview/calc';
import { ctaLink } from '../memberview/calc';
import { pbValueText, type StoredPb } from '../train/pb';
import { Button } from '../ui/Button';
import { dayLabel, dayOf, timeOf } from './calc';

/** The gym's promo panel (the "Training hub" tile). A button whose link is not allowed is left out. */
export function Promo({ cta }: { cta: Cta }) {
  if (!cta.enabled) return null;
  const buttons = [
    { label: cta.primary_label.trim(), link: ctaLink(cta.primary_target, cta.primary_url), primary: true },
    { label: cta.secondary_label.trim(), link: ctaLink(cta.secondary_target, cta.secondary_url), primary: false },
  ].filter((b) => b.label && b.link);
  return (
    <section className="mem-card mem-hero" aria-label="From your gym">
      {cta.eyebrow.trim() && <span className="mem-eyebrow">{cta.eyebrow.trim()}</span>}
      {cta.title.trim() && <div className="mem-big">{cta.title.trim()}</div>}
      {cta.body.trim() && <div className="muted">{cta.body.trim()}</div>}
      {buttons.length > 0 && (
        <div className="mem-actions">
          {buttons.map((b) => {
            const cls = `btn ${b.primary ? 'primary' : 'secondary'}`;
            return b.link && 'to' in b.link
              ? <Link key={b.label} className={cls} to={b.link.to}>{b.label}</Link>
              : b.link && <a key={b.label} className={cls} href={b.link.href} target="_blank" rel="noopener noreferrer">{b.label}</a>;
          })}
        </div>
      )}
    </section>
  );
}

/** The gym's door PIN, hidden until the member taps. Only shown when the gym has switched it on and set a code. */
export function DoorCard({ label, code, note }: { label: string; code: string; note: string }) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mem-card" aria-label="Door access">
      <span className="mem-eyebrow">{label.trim() || 'Door access'}</span>
      <div className="mem-big">Gym PIN</div>
      {shown ? <div className="mem-big mem-pin" aria-live="polite">{code}</div> : null}
      <Button aria-expanded={shown} onClick={() => setShown(!shown)}>{shown ? 'Hide code' : 'Tap to reveal'}</Button>
      <div className="muted small">{note.trim() || 'Set by your gym.'}</div>
    </section>
  );
}

export function Snapshot({ workoutsThisWeek, pbs }: { workoutsThisWeek: number; pbs: StoredPb[] }) {
  const latest = pbs[0];
  return (
    <section className="mem-card" aria-label="Training snapshot">
      <h2>Training snapshot</h2>
      <div className="mem-line"><span>Workouts this week</span><b>{workoutsThisWeek}</b></div>
      <div className="mem-line"><span>Personal bests</span><b>{pbs.length}</b></div>
      <div className="mem-line"><span>Latest best</span><b>{latest ? `${latest.name} ${pbValueText(latest.metric, latest.unit, latest.value)}` : 'None yet'}</b></div>
      <Link className="btn secondary" to="/m/train/pbs">See my bests</Link>
    </section>
  );
}

export function Activity({ sessions, pbs }: { sessions: SessionRow[]; pbs: StoredPb[] }) {
  const rows = [
    ...sessions.slice(0, 3).map((s) => ({ key: `s${s.id}`, at: s.performedAt, text: s.title, tag: 'Workout' })),
    ...pbs.slice(0, 3).map((p) => ({ key: `p${p.id}`, at: p.achievedAt, text: `${p.name} ${pbValueText(p.metric, p.unit, p.value)}`, tag: 'Personal best' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  return (
    <section className="mem-card" aria-label="Recent activity">
      <h2>Recent activity</h2>
      {rows.length === 0 ? <div className="muted">Nothing logged yet. Your workouts and personal bests will show here.</div> : rows.map((r) => (
        <div className="mem-line" key={r.key}><div><b>{r.text}</b><div className="muted small">{r.tag} · {dayLabel(dayOf(r.at))}</div></div></div>
      ))}
    </section>
  );
}

export function UpcomingCount({ classes }: { classes: ClassRow[] }) {
  const n = classes.filter((c) => c.isBooked).length;
  return (
    <section className="mem-card" aria-label="Upcoming bookings">
      <div className="mem-row"><div><h2>Upcoming bookings</h2><div className="muted">{n === 0 ? 'Nothing booked yet' : `${n} class${n === 1 ? '' : 'es'} booked`}</div></div><Link to="/m/classes">Classes</Link></div>
    </section>
  );
}

export function MembershipTile({ plan }: { plan: MyPlan | null }) {
  return (
    <section className="mem-card" aria-label="Membership">
      <div className="mem-row"><h2>Membership</h2><Link to="/m/membership">Manage</Link></div>
      {plan ? <div className="mem-line"><span>{plan.name}</span><span className="mem-pill">{plan.status}</span></div> : <div className="muted">No membership found for this gym.</div>}
    </section>
  );
}

export function BookedClasses({ classes }: { classes: ClassRow[] }) {
  const mine = classes.filter((c) => c.isBooked).slice(0, 5);
  return (
    <section className="mem-card" aria-label="My booked classes">
      <div className="mem-row"><h2>My booked classes</h2><Link to="/m/classes">All classes</Link></div>
      {mine.length === 0 ? <div className="muted">You have no classes booked.</div> : mine.map((c) => (
        <div className="mem-line" key={c.sessionId}><div><b>{c.name}</b><div className="muted small">{dayLabel(dayOf(c.startsAt))} · {timeOf(c.startsAt)}–{timeOf(c.endsAt)}</div></div></div>
      ))}
    </section>
  );
}

export function PtList({ rows }: { rows: PtRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mem-card" aria-label="PT appointments">
      <h2>PT appointments</h2>
      {rows.slice(0, 3).map((r) => (
        <div className="mem-line" key={r.id}><div><b>{dayLabel(dayOf(r.startsAt))}</b><div className="muted small">{timeOf(r.startsAt)}–{timeOf(r.endsAt)}</div></div></div>
      ))}
    </section>
  );
}

/** New from the coach: workouts waiting and replies to read. Shown whatever the gym's tile settings are. */
export function Notices({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;
  const assigned = notices.filter((n) => n.kind === 'workout_assigned');
  const replies = notices.filter((n) => n.kind === 'workout_feedback' && n.assignmentId);
  const classes = notices.filter((n) => n.kind === 'class_workout' && n.sessionId);
  return (
    <section className="mem-card by-coach" aria-label="New from your coach">
      <div className="mem-row"><h2>New from your coach</h2><span className="mem-tag new">{notices.length} new</span></div>
      {assigned.length > 0 && (
        <div className="mem-line">
          <div><b>{assigned.length === 1 ? 'A new workout' : `${assigned.length} new workouts`}</b><div className="muted small">{assigned.map((n) => n.body).filter(Boolean).join(', ')}</div></div>
          <Link className="btn primary" to="/m/train">See {assigned.length === 1 ? 'it' : 'them'}</Link>
        </div>
      )}
      {classes.map((n) => (
        <div className="mem-line" key={n.id}>
          <div><b>Your class workout is ready</b><div className="muted small">{n.body}</div></div>
          <Link className="btn primary" to={`/m/train/class/${n.sessionId}`}>Open</Link>
        </div>
      ))}
      {replies.map((n) => (
        <div className="mem-line" key={n.id}>
          <div><b>Feedback on {n.body ?? 'your workout'}</b></div>
          <Link className="btn secondary" to={`/m/train/done/${n.assignmentId}`}>Read</Link>
        </div>
      ))}
    </section>
  );
}
