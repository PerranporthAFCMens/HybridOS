import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { bookClass, cancelClass, classAccess, joinWaitlist, leaveWaitlist, listMyWaitlists, type ClassAccess, type ClassRow, type MyWaitlist } from '../data/member';
import { pounds } from '../reports/library';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { dayLabel, dayOf, minutesLeft, timeOf } from './calc';

/** Booking, cancelling and the waitlist, with the dialogs, shared by Today and Classes. */
export function useBooking() {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);
  const [notIncluded, setNotIncluded] = useState<{ row: ClassRow; access: ClassAccess } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<ClassRow | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  // Places in line. Reading them also lets the database move a lapsed offer on, so poll gently while any are open.
  const lists = useQuery({
    queryKey: ['m-waitlists', gym.gymId],
    queryFn: () => listMyWaitlists(gym.gymId),
    refetchInterval: (q) => ((q.state.data ?? []).length > 0 ? 30000 : false),
  });
  const waitlists = lists.data ?? [];
  const [nowMs, setNowMs] = useState(() => Date.now());
  const anyOffered = waitlists.some((w) => w.status === 'offered');
  useEffect(() => {
    if (!anyOffered) return;
    const t = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, [anyOffered]);
  // Classes that looked bookable but the database says are full (a place held for someone in line).
  const [heldFull, setHeldFull] = useState<Set<string>>(new Set());

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['m-classes', gym.gymId] }),
    qc.invalidateQueries({ queryKey: ['m-waitlists', gym.gymId] }),
  ]);

  /** What this member's place in line is for a class, with expired offers treated as gone. */
  const waitlistFor = (sessionId: string): MyWaitlist | null => {
    const w = waitlists.find((x) => x.sessionId === sessionId);
    if (!w) return null;
    if (w.status === 'offered' && minutesLeft(w.offerExpiresAt, nowMs) === 0) return null;
    return w;
  };

  const book = async (row: ClassRow) => {
    setBusy(row.sessionId);
    setNotice(null);
    try {
      const access = await classAccess(row.sessionId);
      if (!access.included) {
        setNotIncluded({ row, access });
        return;
      }
      await bookClass(row.sessionId);
      await refresh();
      setNotice({ text: `Booked: ${row.name}, ${dayLabel(dayOf(row.startsAt))} at ${timeOf(row.startsAt)}.`, good: true });
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not book that class.';
      if (/class is full/i.test(text)) {
        setHeldFull((prev) => new Set(prev).add(row.sessionId));
        setNotice({ text: 'That class is full now. You can join the waitlist.', good: false });
        void refresh();
      } else {
        setNotice({ text, good: false });
      }
    } finally {
      setBusy(null);
    }
  };

  const joinLine = async (row: ClassRow) => {
    setBusy(row.sessionId);
    setNotice(null);
    try {
      await joinWaitlist(row.sessionId);
      await refresh();
      setNotice({ text: `You're on the waitlist for ${row.name}. We'll tell you if a place opens.`, good: true });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Could not join the waitlist.', good: false });
    } finally {
      setBusy(null);
    }
  };

  const leaveLine = async (row: ClassRow) => {
    setBusy(row.sessionId);
    setNotice(null);
    try {
      await leaveWaitlist(row.sessionId);
      await refresh();
      setNotice({ text: `You've left the waitlist for ${row.name}.`, good: true });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Could not leave the waitlist.', good: false });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (row: ClassRow) => {
    setConfirmCancel(null);
    setBusy(row.sessionId);
    setNotice(null);
    try {
      await cancelClass(row.sessionId);
      await refresh();
      setNotice({ text: `Cancelled: ${row.name}.`, good: true });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Could not cancel that booking.', good: false });
    } finally {
      setBusy(null);
    }
  };

  const layer: ReactNode = (
    <>
      {notice && <div className={`mem-notice ${notice.good ? '' : 'bad'}`} role={notice.good ? 'status' : 'alert'}>{notice.text}</div>}
      {notIncluded && (
        <Modal title="Not included in your plan" onClose={() => setNotIncluded(null)}>
          <h3>{notIncluded.row.name} is not included in your membership</h3>
          <p className="muted">
            {notIncluded.access.canPayDropIn
              ? `It can be booked as a drop-in for ${pounds(notIncluded.access.dropInPence)}. Paying online is not switched on yet, so please ask the gym to book you in.`
              : 'Ask your gym about a plan that includes classes.'}
          </p>
          {notIncluded.access.upgradePlans.length > 0 && (
            <ul className="mem-list">
              {notIncluded.access.upgradePlans.map((p) => <li key={p.name}><span>{p.name}</span><span className="muted">{pounds(p.pricePence)} / {p.interval}</span></li>)}
            </ul>
          )}
          <Button variant="primary" onClick={() => setNotIncluded(null)}>Close</Button>
        </Modal>
      )}
      {confirmCancel && (
        <Modal title="Cancel your booking" onClose={() => setConfirmCancel(null)}>
          <h3>Cancel {confirmCancel.name}?</h3>
          <p className="muted">{dayLabel(dayOf(confirmCancel.startsAt))} at {timeOf(confirmCancel.startsAt)}. Your place will go to someone else.</p>
          <div className="mem-actions">
            <Button variant="primary" onClick={() => void cancel(confirmCancel)}>Cancel booking</Button>
            <Button onClick={() => setConfirmCancel(null)}>Keep it</Button>
          </div>
        </Modal>
      )}
    </>
  );

  return { busy, book, joinLine, leaveLine, waitlistFor, isFull: (c: ClassRow) => !c.isBooked && (c.availableSpaces <= 0 || heldFull.has(c.sessionId)), nowMs, askCancel: setConfirmCancel, layer };
}
