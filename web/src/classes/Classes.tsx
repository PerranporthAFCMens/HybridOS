import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { links } from '../shell/legacy';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import type { TimetableSession } from '../data/classes';
import { CalendarGrid } from './CalendarGrid';
import { ClassDetail } from './ClassDetail';
import { ClassForm } from './ClassForm';
import { EditClass } from './EditClass';
import { addDays, bookedText, dayTitle, sessionStatus, startOfWeek, timeRange, weekColumns, weekdayName, weekLabel, weekSummary } from './calc';
import { useTimetable } from './useClasses';
import '../members/members.css';
import './classes.css';

export function Classes() {
  const { gym } = useReadyAuth();
  const [anchor, setAnchor] = useState(() => new Date());
  // Week by default, as the owner asked. A week needs room for seven columns, so on a phone it opens on the day
  // (the Week button is hidden there; see classes.css).
  const [view, setView] = useState<'day' | 'week' | 'list'>(() => (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 701px)').matches ? 'week' : 'day'));
  const [adding, setAdding] = useState<{ date: string; start: string } | 'blank' | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const weekStart = startOfWeek(anchor);
  const step = view === 'day' ? 1 : 7;
  const q = useTimetable(gym.gymId, weekStart);
  const columns = weekColumns(weekStart, q.data ?? [], new Date());
  const days = view === 'day' ? [anchor] : columns.map((c) => c.date);
  const open = (s: TimetableSession) => setOpened(s.session_id);
  // Looked up by id so the open class reflects a cancel or reinstate as soon as the timetable reloads.
  const openedSession = opened ? (q.data ?? []).find((x) => x.session_id === opened) ?? null : null;

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Timetable &amp; bookings</div>
          <h1>Classes</h1>
        </div>
        <div className="week-actions">
          <Button onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="primary" onClick={() => setAdding('blank')}>Add class</Button>
          <LinkButton href={links['class-setup']}>Class setup</LinkButton>
          <LinkButton href={links.workouts}>Workout builder</LinkButton>
        </div>
      </header>

      <div className="weekbar">
        <div className="week-actions">
          <Button onClick={() => setAnchor(addDays(anchor, -step))}>Previous</Button>
          <Button onClick={() => setAnchor(addDays(anchor, step))}>Next</Button>
        </div>
        <div className="view-switch" role="group" aria-label="View">
          <Button variant={view === 'day' ? 'primary' : 'secondary'} aria-pressed={view === 'day'} onClick={() => setView('day')}>Day</Button>
          <Button className="view-week" variant={view === 'week' ? 'primary' : 'secondary'} aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</Button>
          <Button variant={view === 'list' ? 'primary' : 'secondary'} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</Button>
        </div>
        <div className="week-title">
          <strong>{view === 'day' ? dayTitle(anchor) : weekLabel(weekStart)}</strong>
          {q.data && <span className="muted">{weekSummary(q.data)}</span>}
        </div>
      </div>

      {q.isError && <Card><Empty>Could not load classes. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading classes…</Empty></Card>}

      {q.data && view !== 'list' && (
        <CalendarGrid days={days} sessions={q.data} now={new Date()} onSlot={(date, start) => setAdding({ date, start })} onOpen={open} />
      )}

      {q.data && view === 'list' && (
        <div className="calendar">
          {columns.map((day) => (
            <section key={day.key} className={`day${day.isToday ? ' today' : ''}`} aria-label={`${weekdayName(day.date)} ${day.date.getDate()}`}>
              <div className="dayhead">
                <b>{weekdayName(day.date)}</b>
                <span className="datebubble">{day.date.getDate()}</span>
              </div>
              {day.sessions.length === 0 && <div className="empty">No classes</div>}
              {day.sessions.map((s) => {
                const status = sessionStatus(s);
                return (
                  <article key={s.session_id} className={`session${s.is_cancelled ? ' cancelled' : ''}`} onClick={() => open(s)}>
                    <div className="time">{timeRange(s)}</div>
                    <h3>{s.name}</h3>
                    {s.description && <div className="meta">{s.description}</div>}
                    {s.staffNames.length > 0 && <div className="meta">Coach: {s.staffNames.join(', ')}</div>}
                    <div className="meta">{bookedText(s)}</div>
                    <span className={`tag ${status.tone}`.trim()}>{status.text}</span>
                    {s.reserved_capacity > 0 && s.reserved_plan_names?.length > 0 && (
                      <div className="meta">Reserved: {s.reserved_plan_names.join(', ')}</div>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {adding && (
        <ClassForm
          initial={adding === 'blank' ? undefined : adding}
          onClose={() => setAdding(null)}
          onSaved={(startsAt) => {
            setAnchor(startsAt);
            setAdding(null);
          }}
        />
      )}
      {openedSession && !editingId && <ClassDetail session={openedSession} onClose={() => setOpened(null)} onEdit={() => setEditingId(openedSession.session_id)} />}
      {editingId && (
        <EditClass
          sessionId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={(startsAt) => {
            setAnchor(startsAt);
            setEditingId(null);
            setOpened(null);
          }}
        />
      )}
    </>
  );
}
