import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClassAction, waitlistLine } from './ClassAction';
import { dayLabel, dayOf, dayStrip, packLeftText, spaceText, timeOf } from './calc';
import type { MemberCtx } from './useMember';
import { useBooking } from './useBooking';

/** Pick a day along the top, then Book, Cancel or join the waitlist on each class. */
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
      {booking.packLeft > 0 && <p className="muted small" data-testid="pack-left">You have {packLeftText(booking.packLeft)}. Booking a class your plan does not cover uses one.</p>}
      <div className="mem-days" role="group" aria-label="Choose a day">
        {strip.map((s) => {
          const has = d.classes.data.some((c) => dayOf(c.startsAt) === s.key);
          const booked = d.classes.data.some((c) => c.isBooked && dayOf(c.startsAt) === s.key);
          return (
            <button key={s.key} type="button" className={`mem-day${day === s.key ? ' on' : ''}${booked ? ' booked' : ''}`} aria-pressed={day === s.key} aria-label={`${dayLabel(s.key)}${booked ? ', you have a class booked' : has ? '' : ', no classes'}`} onClick={() => setDay(s.key)}>
              <span>{s.weekday}</span><b>{s.num}</b><i className={booked ? 'dot booked' : has ? 'dot' : 'dot off'} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="mem-list-head">{dayLabel(day)}</div>
      {d.classes.isPending && <div className="mem-card muted">Loading…</div>}
      {d.classes.isError && <div className="mem-card muted">Could not load classes. Pull down to try again.</div>}
      {!d.classes.isPending && !d.classes.isError && list.length === 0 && <div className="mem-card muted">No classes on this day.</div>}
      {list.map((c) => {
        const line = waitlistLine(c, booking);
        return (
          <article key={c.sessionId} className={`mem-class${c.isBooked ? ' booked' : ''}`} aria-label={`${c.name}, ${timeOf(c.startsAt)}`}>
            <div className="mem-time">{timeOf(c.startsAt)}</div>
            <div className="mem-class-main">
              <b>{c.name}</b>
              <div className="muted small">{timeOf(c.startsAt)}–{timeOf(c.endsAt)} · {booking.isFull(c) ? 'Full' : spaceText(c)}</div>
              {line && <div className="small"><b>{line}</b></div>}
            </div>
            <ClassAction c={c} booking={booking} />
          </article>
        );
      })}
    </div>
  );
}
