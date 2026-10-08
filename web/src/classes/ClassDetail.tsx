import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { TimetableSession } from '../data/classes';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { bookedText, dayTitle, sessionStatus, timeRange } from './calc';
import { useSetCancelled } from './useClasses';

/** One class opened from the calendar: its facts, and cancel or bring it back. */
export function ClassDetail({ session, onClose }: { session: TimetableSession; onClose: () => void }) {
  const { gym } = useReadyAuth();
  const setCancelled = useSetCancelled(gym.gymId);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const status = sessionStatus(session);

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
      {confirming && !session.is_cancelled && (
        <div className="schedule-check bad" role="alert">
          Cancel this class? It stays on the timetable marked Cancelled and you can bring it back. People who have booked are not told automatically.
        </div>
      )}
      <div className="assign-msg">{message && <span className="msg error" role="alert">{message}</span>}</div>
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
