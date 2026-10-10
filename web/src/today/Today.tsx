import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { LinkButton } from '../ui/Button';
import { links } from '../shell/legacy';
import { MemberTrend } from './MemberTrend';
import {
  activePlans,
  bookedPercent,
  buildNeeds,
  expectedMonthlyIncome,
  greeting,
  memberTrend,
  money,
  monthlyCounts,
  sessionsOnDay,
  summaryLine,
  upcomingSessions,
} from './calc';
import { useToday } from './useToday';
import './today.css';

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long' });

export function Today() {
  const { gym, userId, email } = useReadyAuth();
  const q = useToday(gym.gymId, userId, email);
  const now = new Date();

  const members = q.members.data;
  const sessions = useMemo(() => upcomingSessions(q.sessions.data ?? []), [q.sessions.data]);
  const counts = members ? monthlyCounts(members, now) : null;
  const plans = q.plans.data;

  const needs = useMemo(() => {
    if (!members || !plans || q.pending.data === undefined || !q.sessions.data) return null;
    return buildNeeds({ pendingPayments: q.pending.data, plans, sessions, memberCount: members.length, now: new Date() });
  }, [members, plans, q.pending.data, q.sessions.data, sessions]);

  const todays = sessionsOnDay(sessions, now);
  const failed = [q.members, q.values, q.pending, q.plans, q.channels, q.sessions].some((x) => x.isError);

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">{DATE.format(now)}</div>
          <h1>{q.name.data ? greeting(q.name.data, now) : 'Welcome back'}</h1>
        </div>
      </header>

      {failed && <div className="empty" role="alert" style={{ marginBottom: 16 }}>Some figures could not load. Refresh to try again.</div>}

      <div className="today-grid">
        <Card className="full today-head">
          <p className="muted">{needs ? summaryLine(needs.length) : 'Checking what needs you…'}</p>
          <div className="today-actions">
            <LinkButton href={links['class-setup']}>Add a class</LinkButton>
            <LinkButton variant="primary" href={links.members}>Invite members</LinkButton>
          </div>
        </Card>

        <Card className="full">
          <SectionTitle title="Needs you" action={needs?.length ? <span className="muted">{needs.length} {needs.length === 1 ? 'item' : 'items'}</span> : null} />
          {!needs ? (
            <Empty>Loading…</Empty>
          ) : needs.length ? (
            <div className="needs-list">
              {needs.map((n) => (
                <div className="need-row" key={n.key}>
                  <span className={`need-dot ${n.tone}`} aria-hidden="true" />
                  <div className="need-text">
                    <b>{n.title}</b>
                    <span>{n.sub}</span>
                  </div>
                  <LinkButton href={links[n.to]}>{n.button}</LinkButton>
                </div>
              ))}
            </div>
          ) : (
            <div className="needs-list">
              <div className="need-row">
                <span className="need-dot ok" aria-hidden="true" />
                <div className="need-text">
                  <b>You are all caught up</b>
                  <span>New items will show here when something needs a decision.</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Kpi label="Active members" value={counts ? String(counts.active) : '—'} note="Members with a live membership" />
        <Kpi
          label="Joined this month"
          value={counts ? String(counts.joined) : '—'}
          note={counts ? (counts.joined === 0 ? 'No new members yet this month' : `New members since 1 ${MONTH.format(now)}`) : ''}
        />
        <Kpi
          label="Cancelled this month"
          value={counts ? String(counts.left) : '—'}
          note={counts ? (counts.left === 0 ? 'Nobody has left this month' : 'Members who left this month') : ''}
        />
        <Kpi
          label="Expected income"
          value={q.values.data ? money(expectedMonthlyIncome(q.values.data)) : '—'}
          note="Per month, from active memberships"
        />

        <Card className="wide">
          <SectionTitle title="Classes today" action={<Link className="muted-link" to={links.classes}>Open timetable</Link>} />
          {!q.sessions.data ? (
            <Empty>Loading classes…</Empty>
          ) : todays.length ? (
            <div className="class-today-list">
              {todays.map((s) => (
                <div className="ct-row" key={s.session_id}>
                  <span className="ct-time">{TIME.format(new Date(s.starts_at))}</span>
                  <span className="ct-name">{s.name}</span>
                  <span className="ct-bar" aria-hidden="true"><i style={{ width: `${bookedPercent(s)}%` }} /></span>
                  <span className="ct-count">{s.booked_count || 0}/{s.capacity || 0} booked</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No classes today. Add one and members can book straight away.</Empty>
          )}
        </Card>

        <Card className="narrow">
          <SectionTitle title="Members over time" action={<span className="muted">Last 12 months</span>} />
          {members ? <MemberTrend points={memberTrend(members, now)} /> : <Empty>Loading…</Empty>}
        </Card>

        <Card className="wide">
          <SectionTitle title="Membership plans" action={<Link className="btn secondary" to={links.plans}>Manage</Link>} />
          {!plans ? (
            <Empty>Loading plans…</Empty>
          ) : activePlans(plans).length ? (
            activePlans(plans).slice(0, 4).map((p) => (
              <div className="channel" key={p.id}>
                <b>{p.name}</b>
                <div className="muted">{money(p.priceInPence)} / {p.interval} · {p.accessType}</div>
              </div>
            ))
          ) : (
            <Empty>No active membership plans yet.</Empty>
          )}
        </Card>

        <Card className="narrow">
          <SectionTitle title="Community" action={<Link className="muted-link" to={links.community}>Open</Link>} />
          {!q.channels.data ? (
            <Empty>Loading channels…</Empty>
          ) : q.channels.data.length ? (
            q.channels.data.map((c) => (
              <div className="channel" key={c.id}>
                <b># {c.name}</b>
                <div className="muted">{c.description || 'Community channel'}</div>
              </div>
            ))
          ) : (
            <Empty>No channels yet.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="kpi">
      <div className="label">{label}</div>
      <div className="num">{value}</div>
      <div className="kpi-note">{note}</div>
    </Card>
  );
}
