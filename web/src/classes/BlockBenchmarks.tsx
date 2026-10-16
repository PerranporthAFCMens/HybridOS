import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import type { ClassBlock } from '../data/classBlocks';
import { useMovements } from '../movements/useMovements';
import { Button } from '../ui/Button';
import { Checkbox, DateInput, Field, Select } from '../ui/Field';
import { getCoachesSeeResults, setCoachesSeeResults } from '../data/benchmarkSettings';
import { CoachBenchmarkResults } from './CoachBenchmarkResults';
import { betterText, canSwitchCoachView, defaultBetter, defaultTestDays, isBetter, validateBenchmark, type Better } from './benchmarks';
import { useBenchmarkWrites, useBlockBenchmarks } from './useBenchmarks';

const todayDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const dateText = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

/**
 * Benchmarks for a block: movements it tests twice, at the start and at the end. Members do the test as an ordinary workout with
 * that movement; their results and change are worked out from what they record, so nothing is entered here but the dates.
 */
export function BlockBenchmarks({ block }: { block: ClassBlock }) {
  const { gym, userId } = useReadyAuth();
  const q = useBlockBenchmarks(gym.gymId, block.id);
  const movements = useMovements(gym.gymId);
  const w = useBenchmarkWrites(gym.gymId, userId, block.id);
  const qc = useQueryClient();
  const see = useQuery({ queryKey: ['coach-see-results', gym.gymId], queryFn: () => getCoachesSeeResults(gym.gymId) });
  const switchSee = useMutation({
    mutationFn: (on: boolean) => setCoachesSeeResults(gym.gymId, on),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['coach-see-results'] }), qc.invalidateQueries({ queryKey: ['m-coach-see-results'] }), qc.invalidateQueries({ queryKey: ['coach-benchmark-results'] })]),
  });
  const days = defaultTestDays(block);
  const [form, setForm] = useState<{ movementId: string; startOn: string; endOn: string; better: Better }>({ movementId: '', ...days, better: 'higher' });
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const list = q.data ?? [];
  const used = new Set(list.map((b) => b.movementId));
  const choices = (movements.data ?? []).filter((m) => m.isActive && !used.has(m.id));

  const pick = (id: string) => {
    const m = movements.data?.find((x) => x.id === id);
    setForm((f) => ({ ...f, movementId: id, better: m ? defaultBetter(m.tracking) : f.better }));
  };
  const add = () => {
    const c = validateBenchmark(form, block, [...used]);
    if (!c.ok) return setNote({ text: c.message, good: false });
    setNote(null);
    w.add.mutate(c, { onSuccess: () => { setNote({ text: 'Benchmark added.', good: true }); setForm({ movementId: '', ...days, better: 'higher' }); }, onError: (e) => setNote({ text: e.message, good: false }) });
  };

  return (
    <section aria-label="Benchmarks">
      <h4 className="detail-heading">Benchmarks</h4>
      <p className="muted small">Pick movements this block tests at the start and again at the end. Members do each test as a normal workout with that movement, and see how they changed.</p>
      {q.isPending && <p className="muted small">Loading benchmarks…</p>}
      {q.isError && <p className="muted small">Could not load the benchmarks. Go back and open the block again.</p>}
      {q.data?.length === 0 && <p className="muted small">No benchmarks yet.</p>}
      <ul className="team-list">
        {list.map((b) => (
          <li className="team-item" key={b.id}>
            <div className="team-main">
              <b>{b.movementName}</b>
              <div className="muted small">Start test {dateText(b.startOn)} · End test {dateText(b.endOn)} · {betterText(b.better)}</div>
            </div>
            <div className="team-actions"><Button aria-label={`Remove ${b.movementName}`} disabled={w.remove.isPending} onClick={() => w.remove.mutate(b.id, { onError: (e) => setNote({ text: e.message, good: false }) })}>Remove</Button></div>
          </li>
        ))}
      </ul>
      {movements.data && choices.length === 0 ? (
        <p className="muted small">{(movements.data ?? []).length === 0 ? 'Add movements on the Movements page first.' : 'Every movement in your list is already a benchmark in this block.'}</p>
      ) : (
        <div className="block-form">
          <Field label="Movement to test" htmlFor="bm-move">
            <Select id="bm-move" value={form.movementId} onChange={(e) => pick(e.target.value)}>
              <option value="">Choose a movement</option>
              {choices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Start test opens" htmlFor="bm-start"><DateInput id="bm-start" value={form.startOn} onChange={(e) => setForm({ ...form, startOn: e.target.value })} /></Field>
          <Field label="End test opens" htmlFor="bm-end"><DateInput id="bm-end" value={form.endOn} onChange={(e) => setForm({ ...form, endOn: e.target.value })} /></Field>
          <Field label="Which result is better" htmlFor="bm-better">
            <Select id="bm-better" value={form.better} onChange={(e) => isBetter(e.target.value) && setForm({ ...form, better: e.target.value })}>
              <option value="higher">Higher (weight, reps, distance)</option>
              <option value="lower">Lower (a time)</option>
            </Select>
          </Field>
          <Button variant="primary" disabled={w.add.isPending} onClick={add}>{w.add.isPending ? 'Adding…' : 'Add benchmark'}</Button>
        </div>
      )}
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      {canSwitchCoachView(gym.role) && (
        <div>
          <Checkbox label="Coaches can see members' benchmark results" checked={see.data === true} disabled={see.isPending || switchSee.isPending} onChange={(on) => { setNote(null); switchSee.mutate(on, { onError: (e) => setNote({ text: e.message, good: false }) }); }} />
          <p className="muted small">Off by default. When it is on, members are told on their own progress card that their coaches can see these results.</p>
        </div>
      )}
      {see.data === true && <CoachBenchmarkResults blockId={block.id} gymId={gym.gymId} today={todayDay()} list={list} />}
    </section>
  );
}
