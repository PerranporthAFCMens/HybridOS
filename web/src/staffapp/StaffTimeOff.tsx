import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BLOCK_KINDS, blockText, bookedText, emptyBlockForm, kindLabel, slotText, validateBlock, type BlockForm, type BlockKind } from '../rota/calc';
import { useClashes, useMyBlocks, useRotaWrites } from '../rota/useRota';
import { londonParts } from '../classes/calc';
import { Button } from '../ui/Button';
import { Checkbox, DateInput, Field, FieldRow, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import type { StaffCtx } from './StaffShell';

/** Time off for the person signed in: block out time (live straight away, no approval) and take it off again. Only their own. */
export function StaffTimeOff() {
  const ctx = useOutletContext<StaffCtx>();
  const mine = useMyBlocks(ctx.gymId, ctx.userId);
  const clashes = useClashes(ctx.gymId, ctx.userId);
  const writes = useRotaWrites(ctx.gymId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const today = londonParts(new Date()).date;
  const list = mine.data ?? [];
  const booked = clashes.data?.clashes ?? [];
  return (
    <div className="mem-screen">
      <h1 className="mem-title">Time off</h1>
      <p className="muted">Block out time and you cannot be put on a class or booked for personal training then. It takes effect straight away and you can take it off again.</p>
      <Button variant="primary" className="wide-btn" onClick={() => { setMessage(''); setAdding(true); }}>Block out time</Button>
      {message && <div className="msg" role="status">{message}</div>}

      {booked.length > 0 && (
        <section className="mem-card" aria-label="Already booked">
          <h2>Already booked in your time off</h2>
          <p className="muted small">These were booked before. Nothing has been cancelled; the owner can see this list and will swap you or cancel. Tell them if you want to be sure.</p>
          <ul className="staff-roster">
            {booked.map((c) => <li key={c.key}><b>{c.title}</b><span className="muted small">{slotText(c.startsAt, c.endsAt)}{bookedText(c) ? ` · ${bookedText(c)}` : ''}</span></li>)}
          </ul>
        </section>
      )}

      <section className="mem-card" aria-label="My time off">
        <h2>My time off</h2>
        {mine.isPending && <p className="muted small">Loading…</p>}
        {mine.isError && <p className="mem-error" role="alert">Could not load your time off. Refresh to try again.</p>}
        {mine.data && list.length === 0 && <p className="muted">Nothing blocked out.</p>}
        <ul className="staff-roster">
          {list.map((b) => (
            <li key={b.id}>
              <div className="staff-person"><b>{blockText(b)}</b><span className="tag">{kindLabel(b.kind)}</span></div>
              {b.reason && <span className="muted small">{b.reason}</span>}
              {removing === b.id ? (
                <div className="staff-att">
                  <Button variant="primary" disabled={writes.removeBlock.isPending} onClick={() => writes.removeBlock.mutate(b.id, { onSuccess: () => { setRemoving(null); setMessage('Removed. You can be booked then again.'); }, onError: (e) => { setRemoving(null); setMessage(`Could not remove: ${e.message}`); } })}>Yes, remove it</Button>
                  <Button onClick={() => setRemoving(null)}>Keep</Button>
                </div>
              ) : (
                <div className="staff-att"><Button aria-label={`Remove ${blockText(b)}`} onClick={() => setRemoving(b.id)}>Remove</Button></div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {adding && <AddBlock ctx={ctx} date={today} onClose={() => setAdding(false)} onDone={(t) => { setAdding(false); setMessage(t); }} />}
    </div>
  );
}

function AddBlock({ ctx, date, onClose, onDone }: { ctx: StaffCtx; date: string; onClose: () => void; onDone: (m: string) => void }) {
  const writes = useRotaWrites(ctx.gymId);
  const [form, setForm] = useState<BlockForm>(() => emptyBlockForm(ctx.userId, date));
  const [problem, setProblem] = useState('');
  const set = <K extends keyof BlockForm>(k: K, v: BlockForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    setProblem('');
    const check = validateBlock({ ...form, userId: ctx.userId });
    if (!check.ok) return setProblem(check.message);
    writes.addBlock.mutate({ userId: ctx.userId, startsAt: check.startsAt, endsAt: check.endsAt, kind: form.kind, reason: check.reason }, {
      onSuccess: () => onDone('Saved. You cannot be booked in that time.'),
      onError: (e) => setProblem(`Could not save: ${e.message}`),
    });
  };
  return (
    <Modal title="Block out time" onClose={onClose}>
      <h2 className="staff-modal-title">Block out time</h2>
      <Field label="What is it" htmlFor="my-kind">
        <Select id="my-kind" value={form.kind} onChange={(e) => set('kind', e.target.value as BlockKind)}>
          {BLOCK_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      <Checkbox label="Whole days" checked={form.wholeDay} onChange={(v) => set('wholeDay', v)} />
      <FieldRow>
        <Field label={form.wholeDay ? 'First day' : 'Day'} htmlFor="my-from"><DateInput id="my-from" value={form.fromDate} onChange={(e) => set('fromDate', e.target.value)} /></Field>
        {form.wholeDay && <Field label="Last day" htmlFor="my-to"><DateInput id="my-to" value={form.toDate} onChange={(e) => set('toDate', e.target.value)} /></Field>}
      </FieldRow>
      {!form.wholeDay && (
        <FieldRow>
          <Field label="From" htmlFor="my-from-time"><Input id="my-from-time" type="time" value={form.fromTime} onChange={(e) => set('fromTime', e.target.value)} /></Field>
          <Field label="To" htmlFor="my-to-time"><Input id="my-to-time" type="time" value={form.toTime} onChange={(e) => set('toTime', e.target.value)} /></Field>
        </FieldRow>
      )}
      <Field label="Reason (optional)" htmlFor="my-reason" hint="Only you and the owner see it.">
        <Input id="my-reason" maxLength={200} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
      </Field>
      {problem && <p className="mem-error" role="alert">{problem}</p>}
      <Button variant="primary" className="wide-btn" disabled={writes.addBlock.isPending} onClick={save}>{writes.addBlock.isPending ? 'Saving…' : 'Save'}</Button>
      <Button className="wide-btn" onClick={onClose}>Cancel</Button>
    </Modal>
  );
}
