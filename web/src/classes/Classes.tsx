import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { links } from '../shell/legacy';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { ClassForm } from './ClassForm';
import { addDays, bookedText, sessionStatus, startOfWeek, timeRange, weekColumns, weekdayName, weekLabel, weekSummary } from './calc';
import { useTimetable } from './useClasses';
import '../members/members.css';
import './classes.css';

export function Classes() {
  const { gym } = useReadyAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [adding, setAdding] = useState(false);
  const q = useTimetable(gym.gymId, weekStart);
  const columns = weekColumns(weekStart, q.data ?? [], new Date());

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Timetable &amp; bookings</div>
          <h1>Classes</h1>
        </div>
        <div className="week-actions">
          <Button onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
          <Button variant="primary" onClick={() => setAdding(true)}>Add class</Button>
          <LinkButton href={links['class-setup']}>Class setup</LinkButton>
        </div>
      </header>

      <div className="weekbar">
        <div className="week-actions">
          <Button onClick={() => setWeekStart(addDays(weekStart, -7))}>Previous</Button>
          <Button onClick={() => setWeekStart(addDays(weekStart, 7))}>Next</Button>
        </div>
        <div className="week-title">
          <strong>{weekLabel(weekStart)}</strong>
          {q.data && <span className="muted">{weekSummary(q.data)}</span>}
        </div>
      </div>

      {q.isError && <Card><Empty>Could not load classes. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading classes…</Empty></Card>}

      {q.data && (
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
                  <article key={s.session_id} className={`session${s.is_cancelled ? ' cancelled' : ''}`}>
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
          onClose={() => setAdding(false)}
          onSaved={(startsAt) => {
            setWeekStart(startOfWeek(startsAt));
            setAdding(false);
          }}
        />
      )}
    </>
  );
}
