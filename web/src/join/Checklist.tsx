import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReadyStatus, getSignupDocuments, myBirthday, saveAddress, saveEmergency } from '../data/join';
import { loadDoor } from '../data/door';
import { DoorCard } from '../member/HomeTiles';
import { Button } from '../ui/Button';
import { Field, FieldRow, Input } from '../ui/Field';
import {
  EMPTY_DETAILS, READY_TIME, checkAddress, checkEmergency, firstToDo, isUnder18, normalisePhone, normalisePostcode, readyCounts,
  type ReadyKey,
} from './calc';
import { SignForm } from './SignForm';

const TITLES: Record<ReadyKey, string> = { emergency: 'Emergency contact', documents: 'Health questions and waiver', address: 'Your address' };

/**
 * The short list a new member works through after paying under Quick join: emergency contact, health questions and waiver, address.
 * It is also the member's way back to anything left undone, and it shows the door code once the gym will release it.
 */
export function Checklist({ gymId, slug, onChanged }: { gymId: string; slug: string; onChanged?: () => void }) {
  const qc = useQueryClient();
  const statusQ = useQuery({ queryKey: ['ready', gymId], queryFn: () => getReadyStatus(gymId), retry: false });
  const status = statusQ.data;
  const wantsDocs = !!status?.items.some((i) => i.key === 'documents');
  const docsQ = useQuery({ queryKey: ['join-docs', slug, 'checklist'], queryFn: () => getSignupDocuments(slug), enabled: wantsDocs, retry: false });
  const birthdayQ = useQuery({ queryKey: ['my-birthday'], queryFn: myBirthday, enabled: wantsDocs, retry: false });
  const doorQ = useQuery({ queryKey: ['ready-door', gymId, status?.held], queryFn: () => loadDoor(gymId), enabled: !!status && !status.held, retry: false });
  const [open, setOpen] = useState<ReadyKey | null>(null);

  if (statusQ.isPending) return <p className="muted">Loading…</p>;
  if (statusQ.isError) return <p className="join-msg bad" role="alert">We could not load your list. Please refresh the page.</p>;
  if (!status) return null;

  const { done, total } = readyCounts(status.items);
  const next = firstToDo(status.items);
  const refresh = async () => {
    setOpen(null);
    await qc.invalidateQueries({ queryKey: ['ready', gymId] });
    onChanged?.();
  };
  const door = doorQ.data && doorQ.data.enabled && doorQ.data.code ? doorQ.data : null;

  return (
    <section aria-label="Get ready for your first visit">
      <h2>{status.items.length === 0 || done === total ? "You're all set" : 'Get ready for your first visit'}</h2>
      {done < total && <p className="muted">{total === 1 ? 'One quick thing.' : `${total} quick things.`} They take about two minutes.</p>}
      <div className="qj-bar" role="img" aria-label={`${done} of ${total} done`}><i style={{ width: `${total ? Math.round((done / total) * 100) : 100}%` }} /></div>
      <ul className="qj-list">
        {status.items.map((item) => (
          <li key={item.key} className={`qj-item${item.done ? ' done' : ''}`}>
            <button type="button" aria-expanded={open === item.key} disabled={item.done} onClick={() => setOpen(open === item.key ? null : item.key)}>
              <span className="qj-circle" aria-hidden="true">{item.done ? '✓' : ''}</span>
              <span className="qj-what">
                <b>{TITLES[item.key]}</b>
                <span className="muted small">{item.done ? 'Done' : `${READY_TIME[item.key]}${item.required ? '' : ' · optional'}`}</span>
              </span>
              {!item.done && <span className="muted" aria-hidden="true">{open === item.key ? '⌃' : '›'}</span>}
            </button>
            {open === item.key && !item.done && (
              <div className="qj-form">
                {item.key === 'emergency' && <EmergencyForm onSaved={refresh} />}
                {item.key === 'address' && <AddressForm onSaved={refresh} />}
                {item.key === 'documents' && (
                  !docsQ.data || birthdayQ.isPending
                    ? <p className="muted">Loading…</p>
                    : <SignForm slug={slug} docs={docsQ.data} under18={isUnder18(birthdayQ.data ?? '', new Date())} submitLabel="Sign" onSigned={refresh} />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {next && open === null && <p><Button variant="primary" onClick={() => setOpen(next.key)}>{`Start with ${TITLES[next.key].toLowerCase()}`}</Button></p>}
      {status.held ? (
        <div className="qj-lock">
          <span aria-hidden="true">🔒</span>
          <span><b>Your door code</b><br /><span className="muted">Appears here when the {total === 1 ? 'thing' : 'things'} above {total === 1 ? 'is' : 'are'} done.</span></span>
        </div>
      ) : door ? (
        <DoorCard label={door.label ?? ''} code={door.code ?? ''} note={door.note ?? ''} />
      ) : null}
    </section>
  );
}

function EmergencyForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [v, setV] = useState({ name: '', phone: '', rel: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = checkEmergency({ ...EMPTY_DETAILS, emergencyName: v.name, emergencyPhone: v.phone, emergencyRelationship: v.rel });
    if (problem) return setMsg(problem);
    setBusy(true);
    setMsg(null);
    saveEmergency(v.name.trim(), normalisePhone(v.phone), v.rel.trim()).then(onSaved, (err: unknown) => setMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')).finally(() => setBusy(false));
  };
  return (
    <form onSubmit={submit} noValidate>
      <p className="muted">Someone we can call if you are ill or hurt at the gym.</p>
      <Field label="Their name" htmlFor="ready-ec-name"><Input id="ready-ec-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Their phone number" htmlFor="ready-ec-phone"><Input id="ready-ec-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      <Field label="How they are related to you" htmlFor="ready-ec-rel" hint="For example partner, parent, friend."><Input id="ready-ec-rel" value={v.rel} onChange={(e) => setV({ ...v, rel: e.target.value })} /></Field>
      {msg && <p className="join-msg bad" role="alert">{msg}</p>}
      <div className="join-nav"><span /><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
    </form>
  );
}

function AddressForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [v, setV] = useState({ line1: '', line2: '', town: '', postcode: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = checkAddress({ ...EMPTY_DETAILS, ...v });
    if (problem) return setMsg(problem);
    setBusy(true);
    setMsg(null);
    saveAddress(v.line1.trim(), v.line2.trim(), v.town.trim(), normalisePostcode(v.postcode)).then(onSaved, (err: unknown) => setMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')).finally(() => setBusy(false));
  };
  return (
    <form onSubmit={submit} noValidate>
      <Field label="Address line 1" htmlFor="ready-line1"><Input id="ready-line1" autoComplete="address-line1" value={v.line1} onChange={(e) => setV({ ...v, line1: e.target.value })} /></Field>
      <Field label="Address line 2 (optional)" htmlFor="ready-line2"><Input id="ready-line2" autoComplete="address-line2" value={v.line2} onChange={(e) => setV({ ...v, line2: e.target.value })} /></Field>
      <FieldRow>
        <Field label="Town or city" htmlFor="ready-town"><Input id="ready-town" autoComplete="address-level2" value={v.town} onChange={(e) => setV({ ...v, town: e.target.value })} /></Field>
        <Field label="Postcode" htmlFor="ready-postcode"><Input id="ready-postcode" autoComplete="postal-code" value={v.postcode} onChange={(e) => setV({ ...v, postcode: e.target.value })} /></Field>
      </FieldRow>
      {msg && <p className="join-msg bad" role="alert">{msg}</p>}
      <div className="join-nav"><span /><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
    </form>
  );
}
