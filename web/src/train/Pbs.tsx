import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { dayOf, dayLabel } from '../member/calc';
import { deletePb, listMyPbs, savePbs } from '../data/train';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { METRIC_CHOICES, manualCandidate, pbValueText, type Metric, type StoredPb } from './pb';

/** Everything the member holds a record for, with a way to add one by hand and to remove one. */
export function Pbs() {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['m-pbs', gym.gymId, userId], queryFn: () => listMyPbs(userId, gym.gymId) });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', metric: 'weight' as Metric, value: '' });
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [remove, setRemove] = useState<StoredPb | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const { c, error } = manualCandidate(form.name, form.metric, form.value);
    if (!c) return setMessage({ text: error ?? 'Check the details.', good: false });
    setBusy(true);
    setMessage(null);
    try {
      const won = await savePbs(userId, gym.gymId, [c], new Date().toISOString());
      await qc.invalidateQueries({ queryKey: ['m-pbs'] });
      setMessage(won.length ? { text: `Saved: ${won[0]?.text ?? ''}.`, good: true } : { text: 'You already have a better one for that, so nothing was changed.', good: true });
      if (won.length) { setForm({ name: '', metric: form.metric, value: '' }); setAdding(false); }
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save that.', good: false });
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setBusy(true);
    try {
      await deletePb(remove.id);
      await qc.invalidateQueries({ queryKey: ['m-pbs'] });
      setRemove(null);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not remove that.', good: false });
      setRemove(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Train</Link>
        <h1 className="mem-title">Personal bests</h1>
        <div className="mem-hi">Saved automatically when a workout beats them. You can add one by hand too.</div>
      </div>
      {message && <div className={message.good ? 'mem-card mem-ok' : 'mem-error'} role={message.good ? 'status' : 'alert'}>{message.text}</div>}

      {adding ? (
        <section className="mem-card" aria-label="Add a personal best">
          <h2>Add a personal best</h2>
          <Input aria-label="Exercise or event" placeholder="Exercise or event, like Deadlift or 5k" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select aria-label="What it measures" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as Metric })}>
            {METRIC_CHOICES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
          <Input aria-label="Value" inputMode={form.metric === 'time' ? 'text' : 'decimal'} placeholder={form.metric === 'time' ? 'Time, like 24:18' : 'Value'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <div className="mem-actions">
            <Button variant="primary" disabled={busy} onClick={() => void add()}>Save</Button>
            <Button onClick={() => { setAdding(false); setMessage(null); }}>Cancel</Button>
          </div>
        </section>
      ) : <Button onClick={() => { setAdding(true); setMessage(null); }}>Add a personal best</Button>}

      {q.isPending && <div className="mem-card muted">Loading…</div>}
      {q.isError && <div className="mem-card muted">Could not load your personal bests.</div>}
      {q.data?.length === 0 && <div className="mem-card muted">No personal bests yet. Log a workout and they appear here.</div>}
      {q.data?.map((p) => (
        <article className="mem-card pb-card" key={p.id} aria-label={p.name}>
          <div className="mem-row">
            <div>
              <div className="mem-eyebrow">{p.metric}</div>
              <b className="tr-name">{p.name}</b>
              <div className="muted small">{dayLabel(dayOf(p.achievedAt))}{p.dir === 'lower' ? ' · lower is better' : ''}</div>
            </div>
            <div className="pb-value">{pbValueText(p.metric, p.unit, p.value)}</div>
          </div>
          <Button onClick={() => setRemove(p)} aria-label={`Remove ${p.name} ${p.metric}`}>Remove</Button>
        </article>
      ))}

      {remove && (
        <Modal title="Remove personal best" onClose={() => setRemove(null)}>
          <h3>Remove {remove.name}?</h3>
          <p className="muted">{pbValueText(remove.metric, remove.unit, remove.value)} will be deleted from your list.</p>
          <div className="mem-actions">
            <Button variant="primary" disabled={busy} onClick={() => void confirmRemove()}>Remove</Button>
            <Button onClick={() => setRemove(null)}>Keep it</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
