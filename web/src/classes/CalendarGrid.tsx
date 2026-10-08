import { useEffect, useRef } from 'react';
import { dayKey, shortDay, weekdayName } from './calc';
import { HOUR_PX, dayBlocks, gridHours, hourLabel } from './grid';
import { bookedText } from './calc';
import type { TimetableSession } from '../data/classes';

/**
 * Time-grid calendar for one or more days. Tap an empty hour to add a class at that time; tap a class
 * to open it. Positions use the gym's clock (UK time).
 */
export function CalendarGrid({
  days,
  sessions,
  now,
  onSlot,
  onOpen,
}: {
  days: Date[];
  sessions: TimetableSession[];
  now: Date;
  onSlot: (date: string, start: string) => void;
  onOpen: (session: TimetableSession) => void;
}) {
  const { startHour, endHour } = gridHours(sessions);
  const scroller = useRef<HTMLDivElement>(null);
  const dayKeys = days.map(dayKey).join();
  // Open near the first class of the shown days (or mid-morning when there are none), not at 05:00.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const keys = dayKeys.split(',');
    const tops = keys.flatMap((k) => dayBlocks(sessions, k, startHour).map((b) => b.top));
    const target = tops.length ? Math.min(...tops) - HOUR_PX / 2 : (8 - startHour) * HOUR_PX;
    el.scrollTop = Math.max(0, target);
    // Only when the shown days change, not on every refresh of the same days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKeys]);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const todayKey = dayKey(now);
  const single = days.length === 1;
  return (
    <div className="cal-scroll" ref={scroller}>
      <div className={`cal-grid${single ? ' single' : ''}`} style={{ ['--cols' as string]: days.length }}>
        <div className="cal-corner" />
        {days.map((d) => (
          <div key={dayKey(d)} className={`cal-dayhead${dayKey(d) === todayKey ? ' today' : ''}`}>
            {single ? null : <b>{weekdayName(d)}</b>}
            <span>{single ? shortDay(d) : d.getDate()}</span>
          </div>
        ))}
        <div className="cal-hours">
          {hours.map((h) => (
            <div key={h} className="cal-hour" style={{ height: HOUR_PX }}>{hourLabel(h)}</div>
          ))}
        </div>
        {days.map((d) => {
          const key = dayKey(d);
          const blocks = dayBlocks(sessions, key, startHour);
          return (
            <div key={key} className="cal-col" style={{ height: hours.length * HOUR_PX }} role="group" aria-label={`${shortDay(d)}`}>
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="cal-slot"
                  style={{ top: (h - startHour) * HOUR_PX, height: HOUR_PX }}
                  aria-label={`Add a class on ${shortDay(d)} at ${hourLabel(h)}`}
                  onClick={() => onSlot(key, hourLabel(h))}
                />
              ))}
              {blocks.map((b) => (
                <button
                  key={b.session.session_id}
                  type="button"
                  className={`cal-class${b.session.is_cancelled ? ' cancelled' : ''}`}
                  style={{ top: b.top, height: b.height, left: `${(b.lane / b.lanes) * 100}%`, width: `${100 / b.lanes}%` }}
                  aria-label={`${b.session.name}, ${shortDay(d)}. Open`}
                  onClick={() => onOpen(b.session)}
                >
                  <span className="cal-class-name">{b.session.name}</span>
                  <span className="cal-class-meta">{b.session.is_cancelled ? 'Cancelled' : bookedText(b.session)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
