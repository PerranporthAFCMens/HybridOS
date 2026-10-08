import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { BookingAction, TimetableSession } from '../data/classes';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { AddToClass } from './AddToClass';
import { BOOKING_STATUS_TEXT, bookedText, dayTitle, rosterActions, rosterSummary, sessionStatus, timeRange } from './calc';
import { useManageBooking, useRoster, useSetCancelled } from './useClasses';

/** One class opened from the calendar: its facts, and cancel or bring it back. */
export function ClassDetail({ session, onClose, onEdit }: { session: TimetableSession; onClose: () => void; onEdit: () => void }) {
  const { gym } = useReadyAuth();
  const setCancelled = useSetCancelled(gym.gymId);
  const roster = useRoster(gym.gymId, session.session_id);
  const manage = useManageBooking(gym.gymId, session.session_id);
  const [removing, setRemoving] = useState<string | null>(null);
  const [rosterMessage, setRosterMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const status = sessionStatus(session);

  const act = (userId: string, action: BookingAction) => {
    setRosterMessage('');
    manage.mutate(
      { userId, action },
      {
        onSuccess: (r) => {
          setRemoving(null);
          if (!r.ok) setRosterMessage(r.errors.join(' ') || 'Could not change that booking.');
        },
        onError: (e) => setRosterMessage(e.message),
      },
    );
  };

  const change = (cancelled: boolean) =>
    setCancelled.mutate({ sessionId: session.session_id, cancelled }, { onSuccess: onClose, onError: (e) => setMessage(e.message) });

  return (
    <Modal title={session.name} onClose={onClose}>
      <SectionTitle title={session.name} action={<Button onClick={onClose}>Close</Button>} />
      <p className="muted">{dayTitle(new Date(session.starts_at))} · {timeRange(session)}</p>
      <dl className="detail-list">
        <div><dt>Status</dt><dd><span className={`tag ${status.tone}`.trim()}>{status.text}</span></dd></div>
        <div><dt>Booked</dt><dd>{bookedText(session)}</dd></div>
        <div><dt>Coach</dt><dd>{session.staffNames.length ? session.staffNames.join(', ') : 'Nobody assigned'}</dd></div>
        {session.reserved_capacity > 0 && (
          <div><dt>Reserved</dt><dd>{session.reserved_capacity} for {session.reserved_plan_names?.length ? session.reserved_plan_names.join(', ') : 'chosen plans'}</dd></div>
        )}
        {session.description && <div><dt>About</dt><dd>{session.description}</dd></div>}
      </dl>
      <h4 className="detail-heading">Who has booked</h4>
      {roster.isPending && <p className="muted small">Loading…</p>}
      {roster.isError && <p className="muted small">Could not load the list of people. Close and open the class to try again.</p>}
      {roster.data && roster.data.length === 0 && <p className="muted small">Nobody has booked yet.</p>}
      {roster.data && roster.data.length > 0 && (
        <>
          <p className="muted small">{rosterSummary(roster.data)}</p>
          <ol className="roster">
            {roster.data.map((r) => (
              <li key={r.bookingId} className="roster-row">
                <span className="roster-name">{r.name}</span>
                <span className={`tag ${r.status === 'attended' ? 'good' : r.status === 'no_show' ? 'warn' : ''}`.trim()}>{BOOKING_STATUS_TEXT[r.status]}</span>
                <span className="roster-actions">
                  {removing === r.userId ? (
                    <>
                      <Button disabled={manage.isPending} onClick={() => act(r.userId, 'cancel')}>Yes, remove</Button>
                      <Button onClick={() => setRemoving(null)}>Keep</Button>
                    </>
                  ) : (
                    rosterActions(r.status).map((a) => (
                      <Button key={a.action} aria-label={`${a.label}: ${r.name}`} disabled={manage.isPending} onClick={() => (a.action === 'cancel' ? setRemoving(r.userId) : act(r.userId, a.action))}>
                        {a.label}
                      </Button>
                    ))
                  )}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {rosterMessage && <div className="assign-msg"><span className="msg error" role="alert">{rosterMessage}</span></div>}
      {roster.data && <AddToClass sessionId={session.session_id} roster={roster.data} disabled={session.is_cancelled} />}
      {confirming && !session.is_cancelled && (
        <div className="schedule-check bad" role="alert">
          Cancel this class? It stays on the timetable marked Cancelled and you can bring it back. People who have booked are not told automatically.
        </div>
      )}
      <div className="assign-msg">{message && <span className="msg error" role="alert">{message}</span>}</div>
      {!confirming && <Button variant="primary" className="wide-btn" onClick={onEdit}>Edit class</Button>}
      {session.is_cancelled ? (
        <Button variant="primary" className="wide-btn" disabled={setCancelled.isPending} onClick={() => change(false)}>{setCancelled.isPending ? 'Saving…' : 'Bring class back'}</Button>
      ) : confirming ? (
        <Button variant="primary" className="wide-btn" disabled={setCancelled.isPending} onClick={() => change(true)}>{setCancelled.isPending ? 'Cancelling…' : 'Yes, cancel class'}</Button>
      ) : (
        <Button className="wide-btn" onClick={() => setConfirming(true)}>Cancel class</Button>
      )}
    </Modal>
  );
}
