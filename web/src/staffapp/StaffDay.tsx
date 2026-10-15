import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BOOKING_STATUS_TEXT, rosterSummary } from '../classes/calc';
import { useRoster } from '../classes/useClasses';
import type { BookingStatus } from '../data/classes';
import type { StaffClass } from '../data/staffApp';
import { dayOf, timeOf, whenWords } from '../member/calc';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { classCountText, dayHeading, groupByDay, nextUp } from './calc';
import type { StaffCtx } from './StaffShell';
import { useGymClasses, useMarkAttendance, useMyClasses } from './useStaffApp';

function Roster({ cls, ctx, onClose }: { cls: StaffClass; ctx: StaffCtx; onClose: () => void }) {
  const roster = useRoster(ctx.gymId, cls.sessionId);
  const mark = useMarkAttendance(ctx.gymId, cls.sessionId, ctx.role === 'owner' || ctx.role === 'admin');
  const [error, setError] = useState('');
  const canMark = ctx.allowed('mark_attendance');
  const set = (bookingId: string, userId: string, status: BookingStatus) => {
    setError('');
    mark.mutate({ bookingId, userId, status }, { onError: (e) => setError(e.message) });
  };
  return (
    <Modal title={cls.name} onClose={onClose}>
      <h2 className="staff-modal-title">{cls.name}</h2>
      <p className="muted">{whenWords(dayOf(cls.startsAt), dayOf(new Date().toISOString()))} · {timeOf(cls.startsAt)}–{timeOf(cls.endsAt)}</p>
      {roster.isPending && <p className="muted small">Loading…</p>}
      {roster.isError && <p className="mem-error" role="alert">Could not load the list of people. Close and open the class to try again.</p>}
      {roster.data && roster.data.length === 0 && <p className="muted">Nobody has booked yet.</p>}
      {roster.data && roster.data.length > 0 && (
        <>
          <p className="muted small">{rosterSummary(roster.data)}</p>
          <ol className="staff-roster">
            {roster.data.map((r) => (
              <li key={r.bookingId}>
                <div className="staff-person"><b>{r.name}</b><span className={`tag ${r.status === 'attended' ? 'good' : r.status === 'no_show' ? 'warn' : ''}`.trim()}>{BOOKING_STATUS_TEXT[r.status]}</span></div>
                {canMark && (
                  <div className="staff-att">
                    {r.status === 'booked' ? (
                      <>
                        <Button aria-label={`Attended: ${r.name}`} disabled={mark.isPending} onClick={() => set(r.bookingId, r.userId, 'attended')}>Attended</Button>
                        <Button aria-label={`No-show: ${r.name}`} disabled={mark.isPending} onClick={() => set(r.bookingId, r.userId, 'no_show')}>No-show</Button>
                      </>
                    ) : (
                      <Button aria-label={`Undo: ${r.name}`} disabled={mark.isPending} onClick={() => set(r.bookingId, r.userId, 'booked')}>Undo</Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {error && <p className="mem-error" role="alert">{error}</p>}
      <Button className="wide-btn" onClick={onClose}>Close</Button>
    </Modal>
  );
}

function ClassLine({ c, onOpen }: { c: StaffClass; onOpen: (c: StaffClass) => void }) {
  return (
    <button type="button" className="mem-class staff-class" onClick={() => onOpen(c)}>
      <span className="mem-time">{timeOf(c.startsAt)}</span>
      <span className="mem-class-main">
        <b>{c.name}</b>
        <span className="muted small">
          {[c.role, c.booked !== null && c.capacity !== null ? `${c.booked}/${c.capacity} booked` : null].filter(Boolean).join(' · ') || 'Roster'}
        </span>
      </span>
      <span className="muted" aria-hidden="true">›</span>
    </button>
  );
}

function Days({ classes, onOpen, empty }: { classes: StaffClass[]; onOpen: (c: StaffClass) => void; empty: string }) {
  if (classes.length === 0) return <p className="mem-card muted">{empty}</p>;
  const today = dayOf(new Date().toISOString());
  return (
    <>
      {groupByDay(classes).map((g) => (
        <section key={g.day} className="staff-day">
          <h2 className="mem-list-head">{dayHeading(g.day, today)}</h2>
          {g.classes.map((c) => <ClassLine key={c.sessionId} c={c} onOpen={onOpen} />)}
        </section>
      ))}
    </>
  );
}

/** My day: the classes this person is assigned to, today first, each opening its list of people. */
export function StaffDay() {
  const ctx = useOutletContext<StaffCtx>();
  const mine = useMyClasses(ctx.gymId, ctx.userId);
  const [open, setOpen] = useState<StaffClass | null>(null);
  const list = mine.data ?? [];
  const today = dayOf(new Date().toISOString());
  const todays = list.filter((c) => dayOf(c.startsAt) === today);
  const next = nextUp(list, new Date());
  return (
    <div className="mem-screen">
      <div>
        <div className="mem-hi">{classCountText(todays.length)} today</div>
        <h1 className="mem-title">My day</h1>
      </div>
      {next && (
        <section className="mem-card mem-hero">
          <div className="mem-eyebrow">Next up</div>
          <div className="mem-big">{next.name}</div>
          <div className="muted">{whenWords(dayOf(next.startsAt), today)} at {timeOf(next.startsAt)}{next.role ? ` · ${next.role}` : ''}</div>
          <Button variant="primary" onClick={() => setOpen(next)}>See who is booked</Button>
        </section>
      )}
      {mine.isPending && <p className="muted">Loading…</p>}
      {mine.isError && <p className="mem-error" role="alert">Could not load your classes. Refresh to try again.</p>}
      {mine.data && <Days classes={list} onOpen={setOpen} empty="No classes assigned to you in the next two weeks." />}
      {open && <Roster cls={open} ctx={ctx} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The whole gym's timetable for the next two weeks, for staff whose access level allows it. */
export function StaffTimetable() {
  const ctx = useOutletContext<StaffCtx>();
  const all = useGymClasses(ctx.gymId, ctx.allowed('view_timetable'));
  const [open, setOpen] = useState<StaffClass | null>(null);
  if (!ctx.allowed('view_timetable')) return <p className="mem-card muted">Your access level does not include the gym timetable.</p>;
  return (
    <div className="mem-screen">
      <h1 className="mem-title">Gym timetable</h1>
      {all.isPending && <p className="muted">Loading…</p>}
      {all.isError && <p className="mem-error" role="alert">Could not load the timetable. Refresh to try again.</p>}
      {all.data && <Days classes={all.data} onOpen={setOpen} empty="No classes in the next two weeks." />}
      {open && <Roster cls={open} ctx={ctx} onClose={() => setOpen(null)} />}
    </div>
  );
}
