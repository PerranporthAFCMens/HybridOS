import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../ui/Button';
import { dayLabel, dayOf, dayStrip, spaceText, timeOf } from './calc';
import type { MemberCtx } from './useMember';
import { useBooking } from './useBooking';

/** Pick a day along the top, then Book or Cancel on each class. */
export function MemberClasses() {
  const d = useOutletContext<MemberCtx>();
  const booking = useBooking();
  const strip = dayStrip(d.today, 14);
  const [day, setDay] = useState(d.today);
  const list = d.classes.data.filter((c) => dayOf(c.startsAt) === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="mem-screen">
      {booking.layer}
      <h1 className="mem-title">Classes</h1>
      <div className="mem-days" role="group" aria-label="Choose a day">
        {strip.map((s) => {
          const has = d.classes.data.some((c) => dayOf(c.startsAt) === s.key);
          return (
            <button key={s.key} type="button" className={`mem-day${day === s.key ? ' on' : ''}`} aria-pressed={day === s.key} aria-label={`${dayLabel(s.key)}${has ? '' : ', no classes'}`} onClick={() => setDay(s.key)}>
              <span>{s.weekday}</span><b>{s.num}</b><i className={has ? 'dot' : 'dot off'} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="mem-list-head">{dayLabel(day)}</div>
      {d.classes.isPending && <div className="mem-card muted">Loading…</div>}
      {d.classes.isError && <div className="mem-card muted">Could not load classes. Pull down to try again.</div>}
      {!d.classes.isPending && !d.classes.isError && list.length === 0 && <div className="mem-card muted">No classes on this day.</div>}
      {list.map((c) => {
        const full = !c.isBooked && c.availableSpaces <= 0;
        const busy = booking.busy === c.sessionId;
        return (
          <article key={c.sessionId} className={`mem-class${c.isBooked ? ' booked' : ''}`} aria-label={`${c.name}, ${timeOf(c.startsAt)}`}>
            <div className="mem-time">{timeOf(c.startsAt)}</div>
            <div className="mem-class-main">
              <b>{c.name}</b>
              <div className="muted small">{timeOf(c.startsAt)}–{timeOf(c.endsAt)} · {spaceText(c)}</div>
            </div>
            {c.isBooked
              ? <Button disabled={busy} onClick={() => booking.askCancel(c)} aria-label={`Cancel ${c.name}`}>Cancel</Button>
              : <Button variant="primary" disabled={busy || full} onClick={() => void booking.book(c)} aria-label={`${full ? 'Full' : 'Book'} ${c.name}`}>{busy ? 'Booking…' : full ? 'Full' : 'Book'}</Button>}
          </article>
        );
      })}
    </div>
  );
}
