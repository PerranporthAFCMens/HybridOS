import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MemberMembership } from '../data/members';
import { endMembership, releaseFromTerm, syncStripe } from '../data/terms';
import { Button } from '../ui/Button';
import { DateInput, Field, FieldRow, Input, Select } from '../ui/Field';
import { termsSentence } from '../plans/terms';

type Msg = { text: string; tone: 'good' | 'error' } | null;

/**
 * What an owner or admin can do about a member leaving, whatever the term and notice: end the membership today or on a last day,
 * or let them out of the rest of their minimum term. Every one needs a reason, which is kept on the record.
 * A member paying by card through HybridOne has their Stripe subscription told to stop too.
 */
export function EndMembership({ gymId, userId, membership: m, name }: { gymId: string; userId: string; membership: MemberMembership; name: string }) {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<'end' | 'release' | null>(null);
  const [when, setWhen] = useState<'today' | 'date'>('today');
  const [lastDay, setLastDay] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const live = m.status === 'active' || m.status === 'paused' || m.status === 'pending';
  const hasTerm = (m.termMonths ?? 0) > 0;
  if (!live && !msg) return null;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['members', gymId] }),
      qc.invalidateQueries({ queryKey: ['member-memberships', gymId, userId] }),
      qc.invalidateQueries({ queryKey: ['today'] }),
      qc.invalidateQueries({ queryKey: ['membership-requests', gymId] }),
    ]);
  };
  const close = () => {
    setPanel(null);
    setReason('');
    setLastDay('');
    setWhen('today');
  };
  const run = async (work: () => Promise<void>, done: string) => {
    if (reason.trim().length < 3) return setMsg({ text: 'Give a reason (a few words is fine).', tone: 'error' });
    setBusy(true);
    setMsg(null);
    try {
      await work();
      const stripeProblem = m.paymentProvider === 'stripe' && panel === 'end' ? await syncStripe(m.id) : null;
      await refresh();
      close();
      setMsg(stripeProblem
        ? { text: `${done} But Stripe could not be told to stop billing ${name} (${stripeProblem}). Check their subscription in Stripe.`, tone: 'error' }
        : { text: m.paymentProvider === 'stripe' && done.includes('ended') ? `${done} Stripe has been told to stop billing.` : done, tone: 'good' });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not do that. Try again.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const end = () => {
    if (when === 'date' && !lastDay) return setMsg({ text: 'Choose their last day.', tone: 'error' });
    void run(() => endMembership(m.id, when === 'date' ? lastDay : null, reason), when === 'date' ? `Booked: their last day is ${lastDay}.` : 'Membership ended today.');
  };

  return (
    <div className="end-membership">
      {live && (
        <>
          <div className="muted small">Their terms: {termsSentence(m.termMonths, m.noticeDays) || 'your gym-wide settings'}</div>
          {panel === null && (
            <div className="membership-actions">
              <Button className="danger" onClick={() => { setMsg(null); setPanel('end'); }}>End membership…</Button>
              {hasTerm && <Button onClick={() => { setMsg(null); setPanel('release'); }}>Release from minimum term…</Button>}
            </div>
          )}
        </>
      )}
      {panel === 'end' && (
        <div className="notice" role="group" aria-label="End membership">
          <b>End {name}'s membership</b>
          <div className="muted small">This ignores their minimum term and notice. The reason is kept on the record.</div>
          <FieldRow>
            <Field label="When" htmlFor={`end-when-${m.id}`}>
              <Select id={`end-when-${m.id}`} value={when} onChange={(e) => setWhen(e.target.value as 'today' | 'date')}>
                <option value="today">Today (ends now)</option>
                <option value="date">On a last day…</option>
              </Select>
            </Field>
            {when === 'date' && (
              <Field label="Last day" htmlFor={`end-day-${m.id}`}>
                <DateInput id={`end-day-${m.id}`} value={lastDay} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setLastDay(e.target.value)} />
              </Field>
            )}
          </FieldRow>
          <Field label="Reason (required)" htmlFor={`end-reason-${m.id}`}>
            <Input id={`end-reason-${m.id}`} placeholder="e.g. Moved away, agreed at the desk" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button className="danger" disabled={busy} onClick={end}>{busy ? 'Ending…' : 'End membership'}</Button>{' '}
          <Button disabled={busy} onClick={close}>Not now</Button>
        </div>
      )}
      {panel === 'release' && (
        <div className="notice" role="group" aria-label="Release from minimum term">
          <b>Release {name} from their minimum term</b>
          <div className="muted small">They can then leave after just their notice period. The reason is kept on the record.</div>
          <Field label="Reason (required)" htmlFor={`rel-reason-${m.id}`}>
            <Input id={`rel-reason-${m.id}`} placeholder="e.g. Goodwill, long illness" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={busy} onClick={() => void run(() => releaseFromTerm(m.id, reason), `${name} is released from their minimum term.`)}>{busy ? 'Saving…' : 'Release them'}</Button>{' '}
          <Button disabled={busy} onClick={close}>Not now</Button>
        </div>
      )}
      {msg && <div className={`msg ${msg.tone}`} role={msg.tone === 'error' ? 'alert' : 'status'}>{msg.text}</div>}
    </div>
  );
}
