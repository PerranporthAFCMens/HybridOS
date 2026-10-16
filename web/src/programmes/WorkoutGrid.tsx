import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import type { BlockClass, ClassBlock } from '../data/classBlocks';
import { setClassWorkouts } from '../data/classWorkouts';
import type { TemplateRow } from '../data/workouts';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Editor } from '../workouts/Workouts';
import { useTemplates } from '../workouts/useWorkouts';
import { blockWeek, gymDay } from '../classes/blocks';
import { dayTitle } from '../classes/calc';
import { useClassWorkoutWrites } from '../classes/useClassWorkout';
import { gridRows, type GridRow } from './calc';

const stateText = (c: BlockClass) => (c.workout === 'none' ? 'No workout' : c.workout === 'draft' ? `Draft: ${c.workoutTitle}` : `Available: ${c.workoutTitle}`);

/**
 * Step 3 of a programme: a row for each class slot (like Mon 18:00 HIIT) and a button for each week. Tap a week to choose its workout,
 * or use the same one for every week in the row.
 */
export function WorkoutGrid({ block, classes }: { block: ClassBlock; classes: BlockClass[] }) {
  const rows = gridRows(classes, block.startsOn, block.weeks);
  const [open, setOpen] = useState<{ row: GridRow; cell: BlockClass } | null>(null);
  return (
    <>
      <div className="prog-grid">
        {rows.map((r) => (
          <div className="prog-row" key={r.key} role="group" aria-label={r.label}>
            <b className="prog-row-name">{r.label}</b>
            <div className="prog-cells">
              {r.cells.map((c, i) => c
                ? (
                  <button key={c.session.session_id} type="button" className={`prog-cell ${c.workout}`} aria-label={`${r.label}, week ${i + 1}: ${stateText(c)}`} onClick={() => setOpen({ row: r, cell: c })}>
                    <small>Week {i + 1}</small>
                    <span>{c.workout === 'none' ? '+ Add' : c.workoutTitle}</span>
                  </button>
                )
                : <div key={`gap-${i}`} className="prog-cell gap" aria-hidden="true"><small>Week {i + 1}</small><span>No class</span></div>)}
            </div>
          </div>
        ))}
      </div>
      {open && <CellPicker block={block} row={open.row} cell={open.cell} onClose={() => setOpen(null)} />}
    </>
  );
}

function CellPicker({ block, row, cell, onClose }: { block: ClassBlock; row: GridRow; cell: BlockClass; onClose: () => void }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const library = useTemplates(gym.gymId);
  const sessionId = cell.session.session_id;
  const writes = useClassWorkoutWrites(gym.gymId, userId, sessionId);
  const [chosen, setChosen] = useState('');
  const [building, setBuilding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const week = blockWeek(block.startsOn, block.weeks, gymDay(cell.session.starts_at));
  const done = () => qc.invalidateQueries({ queryKey: ['block-classes'] });
  const apply = useMutation({
    mutationFn: ({ ids, t }: { ids: string[]; t: TemplateRow }) => setClassWorkouts(gym.gymId, userId, ids, t),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['class-workout'] }); await done(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const everyWeek = row.cells.filter((c): c is BlockClass => c !== null).map((c) => c.session.session_id);
  const template = library.data?.find((x) => x.id === chosen) ?? null;
  const use = (ids: string[]) => {
    if (!template) return setError('Choose a workout first.');
    setError('');
    apply.mutate({ ids, t: template });
  };
  const fail = (e: Error) => setError(e.message);

  return (
    <Modal title={`${row.label}, week ${week ?? ''}`} onClose={onClose}>
      {building
        ? <Editor template={null} onClose={() => setBuilding(false)} onSaved={(t: TemplateRow) => apply.mutate({ ids: [sessionId], t })} />
        : (
          <>
            <h3>{row.label}</h3>
            <p className="muted small">Week {week} of {block.weeks} · {dayTitle(new Date(cell.session.starts_at))}</p>
            {cell.workout !== 'none' && (
              <>
                <div className="cw-line">
                  <b>{cell.workoutTitle}</b>
                  <span className={`tag ${cell.workout === 'available' ? 'good' : ''}`.trim()}>{cell.workout === 'available' ? 'Available' : 'Draft'}</span>
                </div>
                <div className="cw-actions">
                  <Button variant={cell.workout === 'available' ? 'secondary' : 'primary'} disabled={writes.available.isPending} onClick={() => { setError(''); writes.available.mutate(cell.workout !== 'available', { onSuccess: () => { void done(); onClose(); }, onError: fail }); }}>
                    {cell.workout === 'available' ? 'Take it back' : 'Make available to the class'}
                  </Button>
                  {!removing
                    ? <Button onClick={() => setRemoving(true)}>Remove</Button>
                    : (
                      <>
                        <Button variant="primary" onClick={() => writes.remove.mutate(undefined, { onSuccess: () => { void done(); onClose(); }, onError: fail })}>Yes, remove it</Button>
                        <Button onClick={() => setRemoving(false)}>Keep</Button>
                      </>
                    )}
                </div>
              </>
            )}
            <p className="prog-label">{cell.workout === 'none' ? 'Choose a workout' : 'Use a different workout'}</p>
            <div className="cw-pick">
              <Select aria-label="Workout from your library" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                <option value="">Choose a workout…</option>
                {library.data?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
              <div className="cw-actions">
                <Button variant="primary" disabled={apply.isPending} onClick={() => use([sessionId])}>{apply.isPending ? 'Adding…' : 'Use for this week'}</Button>
                {everyWeek.length > 1 && <Button disabled={apply.isPending} onClick={() => use(everyWeek)}>{`Use for all ${everyWeek.length} weeks of ${row.label}`}</Button>}
                <Button onClick={() => setBuilding(true)}>Build a new workout</Button>
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
            {error && <div className="msg error" role="alert">{error}</div>}
          </>
        )}
    </Modal>
  );
}
