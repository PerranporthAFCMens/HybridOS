import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadHours, saveHours } from '../data/resources';
import { Button } from '../ui/Button';
import { Empty, SectionTitle } from '../ui/Card';
import { Checkbox, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { WEEK } from '../staff/calc';
import { hoursFromRows, validateHours, type HoursForm, type HoursRow, type ResourceRow } from './calc';
import '../staff/staff.css';

/** Opening hours of one room or piece of equipment: when classes may use it. */
export function Hours({ resource, onClose }: { resource: ResourceRow; onClose: () => void }) {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['resource-hours', gym.gymId, resource.id], queryFn: () => loadHours(gym.gymId, resource.id) });
  return (
    <Modal title={`Opening hours: ${resource.name}`} onClose={onClose}>
      <SectionTitle title={`Opening hours: ${resource.name}`} action={<Button onClick={onClose}>Close</Button>} />
      {q.isError && <Empty>Could not load the opening hours. Close this and try again.</Empty>}
      {q.isPending && <Empty>Loading…</Empty>}
      {q.isSuccess && <HoursForm resource={resource} initial={hoursFromRows(q.data)} onDone={onClose} />}
    </Modal>
  );
}

function HoursForm({ resource, initial, onDone }: { resource: ResourceRow; initial: HoursForm; onDone: () => void }) {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<HoursForm>(initial);
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (rows: HoursRow[]) => saveHours(gym.gymId, resource.id, rows),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['resource-hours', gym.gymId, resource.id] }), qc.invalidateQueries({ queryKey: ['scheduling-rules', gym.gymId] })]);
      onDone();
    },
  });
  const setDay = (weekday: number, patch: Partial<HoursForm[number]>) => setForm((f) => ({ ...f, [weekday]: { ...f[weekday], ...patch } as HoursForm[number] }));
  const submit = () => {
    const check = validateHours(form);
    if (!check.ok) return setError(check.message);
    setError('');
    save.mutate(check.rows, { onError: (e) => setError(e.message) });
  };
  return (
    <>
      <p className="muted small">The normal hours this {resource.type === 'equipment' ? 'equipment' : 'space'} can be scheduled. Classes outside these hours are refused by the gym checks.</p>
      {WEEK.map((d) => {
        const h = form[d.weekday] ?? { on: true, start: '06:00', end: '22:00' };
        return (
          <div className="day-row" key={d.weekday}>
            <Checkbox label={d.name} checked={h.on} onChange={(on) => setDay(d.weekday, { on })} />
            <Input aria-label={`${d.name} opens`} type="time" value={h.start} disabled={!h.on} onChange={(e) => setDay(d.weekday, { start: e.target.value })} />
            <Input aria-label={`${d.name} closes`} type="time" value={h.end} disabled={!h.on} onChange={(e) => setDay(d.weekday, { end: e.target.value })} />
          </div>
        );
      })}
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save opening hours'}</Button>
    </>
  );
}
