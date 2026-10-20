import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { bookedText, slotText, type Clash } from './calc';
import { useCancelBooking, useClashes } from './useRota';

/**
 * Classes and personal training sessions that are already booked while someone has time off. Nothing is cancelled for the owner:
 * each line says what it is and lets them swap the coach (on the timetable, which checks the rules) or cancel it themselves.
 */
export function Clashes({ names }: { names: Map<string, string> }) {
  const { gym } = useReadyAuth();
  const q = useClashes(gym.gymId);
  const cancel = useCancelBooking(gym.gymId);
  const [asking, setAsking] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const list = q.data?.clashes ?? [];
  const run = (c: Clash) => { setProblem(''); cancel.mutate(c, { onSuccess: () => setAsking(null), onError: (e) => { setAsking(null); setProblem(`Could not cancel: ${e.message}`); } }); };
  return (
    <Card className="clash-card">
      <SectionTitle title="Booked during time off" />
      <div className="muted small">Classes and personal training in the next 60 days that fall in someone's time off. Nothing is changed for you: swap the coach on the timetable, or cancel.</div>
      {q.isPending && <Empty>Checking bookings…</Empty>}
      {q.isError && <Empty>Could not check bookings. Refresh to try again.</Empty>}
      {q.data && list.length === 0 && <Empty>Nothing booked falls in anyone's time off.</Empty>}
      {problem && <div className="field-error" role="alert">{problem}</div>}
      {list.length > 0 && (
        <ul className="clash-list">
          {list.map((c) => (
            <li key={c.key} className="clash-item">
              <div className="clash-text">
                <b>{c.title}</b>
                <span className="muted small">{slotText(c.startsAt, c.endsAt)} · {names.get(c.userId) ?? 'Team member'}{bookedText(c) ? ` · ${bookedText(c)}` : ''}</span>
              </div>
              <div className="clash-actions">
                {asking === c.key ? (
                  <>
                    <Button variant="primary" disabled={cancel.isPending} onClick={() => run(c)}>{c.kind === 'class' ? 'Yes, cancel the class' : 'Yes, cancel it'}</Button>
                    <Button onClick={() => setAsking(null)}>Keep</Button>
                  </>
                ) : (
                  <>
                    {c.kind === 'class' && <LinkButton href="/classes">Change coach</LinkButton>}
                    <Button aria-label={`Cancel ${c.title} on ${slotText(c.startsAt, c.endsAt)}`} onClick={() => setAsking(c.key)}>Cancel</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
