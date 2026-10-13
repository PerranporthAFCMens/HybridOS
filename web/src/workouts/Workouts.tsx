import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadBlocks, type TemplateRow } from '../data/workouts';
import { AssignWorkoutsDialog } from './AssignWorkouts';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { DateInput, Field, Input, Select, Textarea } from '../ui/Field';
import { ExercisePicker } from '../train/ExercisePicker';
import { SetGrid } from '../train/SetGrid';
import type { Tracking } from '../train/calc';
import { Modal } from '../ui/Modal';
import { TRACKING, addExercise, defaultScores, emptyWorkout, formScores, hasChanged, moveItem, trackingLabel, validateWodDate, validateWorkout, type BlockForm, type WorkoutForm } from './calc';
import { ScoresEditor } from './ScoresEditor';
import { useTemplates, useWorkoutWrites } from './useWorkouts';
import '../members/members.css';
import './workouts.css';

type Note = { text: string; good: boolean } | null;

export function Workouts() {
  const { gym } = useReadyAuth();
  const q = useTemplates(gym.gymId);
  const [open, setOpen] = useState<{ t: TemplateRow | null } | null>(null);
  const [note, setNote] = useState<Note>(null);
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Classes and workouts</div>
          <h1>Workout builder</h1>
          <div className="muted">Give a workout a name, add the exercises, and send it to a member or publish it as the gym workout of the day.</div>
        </div>
        {!open && <Button variant="primary" onClick={() => { setNote(null); setOpen({ t: null }); }}>New workout</Button>}
      </header>
      {note && !open && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      {q.isError && <Card><Empty>Could not load the workout library. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading the workout library…</Empty></Card>}
      {!open && q.data && (
        <Card>
          <SectionTitle title="Workout library" />
          {q.data.length === 0 && <Empty>No workouts yet. Build your first one.</Empty>}
          <ul className="team-list">
            {q.data.map((t) => (
              <li className="team-item" key={t.id}>
                <div className="team-main">
                  <b>{t.title}</b>
                  {(t.focusTags.length > 0 || t.estimatedMinutes) && <div className="muted small">{[t.focusTags.join(' · '), t.estimatedMinutes ? `${t.estimatedMinutes} min` : ''].filter(Boolean).join(' · ')}</div>}
                </div>
                <div className="team-actions"><Button aria-label={`Open ${t.title}`} onClick={() => { setNote(null); setOpen({ t }); }}>Open</Button></div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {open && <Editor key={open.t?.id ?? 'new'} template={open.t} onClose={(n) => { setOpen(null); if (n) setNote(n); }} />}
    </>
  );
}

/** Build or edit a workout. `onSaved` lets another screen (a class) use the workout the moment it is saved. */
export function Editor({ template, onClose, onSaved }: { template: TemplateRow | null; onClose: (n?: Note) => void; onSaved?: (t: TemplateRow) => void }) {
  const { gym, userId } = useReadyAuth();
  const w = useWorkoutWrites(gym.gymId, userId);
  const loaded = useQuery({ queryKey: ['workout-blocks', template?.id], queryFn: () => loadBlocks(template?.id ?? ''), enabled: !!template, gcTime: 0 });
  if (template && loaded.isPending) return <Card><Empty>Loading the workout…</Empty></Card>;
  if (template && loaded.isError) return <Card><Empty>Could not load this workout. Go back and try again.</Empty><Button onClick={() => onClose()}>Back to the library</Button></Card>;
  return <EditorForm template={template} initialBlocks={loaded.data ?? []} w={w} onClose={onClose} onSaved={onSaved} />;
}

function EditorForm({ template, initialBlocks, w, onClose, onSaved }: { template: TemplateRow | null; initialBlocks: BlockForm[]; w: ReturnType<typeof useWorkoutWrites>; onClose: (n?: Note) => void; onSaved?: (t: TemplateRow) => void }) {
  const startForm: WorkoutForm = template
    ? { title: template.title, type: template.workoutType, tags: template.focusTags.join(', '), minutes: template.estimatedMinutes === null ? '' : String(template.estimatedMinutes), description: template.description ?? '', visibility: template.visibility }
    : emptyWorkout;
  const [saved, setSaved] = useState({ form: startForm, blocks: initialBlocks });
  const [form, setForm] = useState<WorkoutForm>(startForm);
  const [blocks, setBlocks] = useState<BlockForm[]>(initialBlocks);
  const [id, setId] = useState<string | null>(template?.id ?? null);
  const [current, setCurrent] = useState<TemplateRow | null>(template);
  const [note, setNote] = useState<Note>(null);
  const [dialog, setDialog] = useState<'assign' | 'wod' | null>(null);
  const [asking, setAsking] = useState(false);
  const [adding, setAdding] = useState('');
  const dirty = hasChanged(saved, { form, blocks });
  const set = <K extends keyof WorkoutForm>(k: K, v: WorkoutForm[K]) => { setNote(null); setForm((f) => ({ ...f, [k]: v })); };
  const setBlock = (bi: number, patch: Partial<BlockForm>) => { setNote(null); setBlocks((l) => l.map((b, i) => (i === bi ? { ...b, ...patch } : b))); };
  const setAct = (bi: number, ai: number, patch: Partial<BlockForm['activities'][number]>) => { setNote(null); setBlocks((l) => l.map((b, i) => (i === bi ? { ...b, activities: b.activities.map((a, j) => (j === ai ? { ...a, ...patch } : a)) } : b))); };

  const save = () => {
    const c = validateWorkout(form, blocks);
    if (!c.ok) return setNote({ text: c.message, good: false });
    setNote(null);
    w.save.mutate({ id, input: c.input, blocks: c.blocks }, {
      onSuccess: async (newId) => {
        const fresh = await loadBlocks(newId);
        setId(newId);
        setBlocks(fresh);
        setSaved({ form, blocks: fresh });
        const savedRow: TemplateRow = { id: newId, title: c.input.title, description: c.input.description, workoutType: c.input.workoutType, focusTags: c.input.focusTags, estimatedMinutes: c.input.estimatedMinutes, visibility: c.input.visibility === 'gym' ? 'gym' : 'private' };
        setCurrent(savedRow);
        onSaved?.(savedRow);
        setNote({ text: 'Workout saved.', good: true });
      },
      onError: (e) => setNote({ text: `${e.message} Your changes are still here; press Save workout to try again.`, good: false }),
    });
  };
  const archive = () => {
    if (!id) return;
    setAsking(false);
    w.archive.mutate(id, { onSuccess: () => onClose({ text: `${form.title.trim() || 'The workout'} was archived. Members who were already given it keep their copy.`, good: true }), onError: (e) => setNote({ text: e.message, good: false }) });
  };
  const usable = !!id && !dirty && !!current;

  return (
    <>
      <Card>
        <SectionTitle title={id ? 'Edit workout' : 'New workout'} action={<Button onClick={() => onClose()}>Back to the library</Button>} />
        <Field label="Workout name" htmlFor="wk-title"><Input id="wk-title" maxLength={120} placeholder="Leg Day" value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Note for the member (optional)" htmlFor="wk-desc"><Textarea id="wk-desc" maxLength={2000} placeholder="What this session is for, or how to scale it" value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
      </Card>

      <Card>
        <SectionTitle title="Exercises" />
        {blocks.every((b) => b.activities.length === 0) && <Empty>Add the first exercise below.</Empty>}
        {blocks.map((b, bi) => (
          <div key={b.key}>
            {blocks.length > 1 && b.activities.length > 0 && <div className="eyebrow">{b.title}</div>}
            {b.activities.map((a, ai) => {
              const label = a.name.trim() || `Exercise ${ai + 1}`;
              const tracking = (TRACKING as readonly string[]).includes(a.tracking) ? (a.tracking as Tracking) : 'strength';
              return (
                <div className="wk-activity" key={a.key}>
                  <div className="wk-block-head">
                    <b>{label}</b>
                    <div className="wk-move">
                      <Button aria-label={`Move ${label} up`} disabled={ai === 0} onClick={() => setBlock(bi, { activities: moveItem(b.activities, ai, -1) })}>Up</Button>
                      <Button aria-label={`Move ${label} down`} disabled={ai === b.activities.length - 1} onClick={() => setBlock(bi, { activities: moveItem(b.activities, ai, 1) })}>Down</Button>
                      <Button aria-label={`Remove ${label}`} onClick={() => setBlock(bi, { activities: b.activities.filter((_, j) => j !== ai) })}>Remove</Button>
                    </div>
                  </div>
                  <Field label="Record" htmlFor={`wk-a${a.key}-t`}><Select id={`wk-a${a.key}-t`} value={a.tracking} onChange={(e) => setAct(bi, ai, { tracking: e.target.value, ...(e.target.value === 'scores' && formScores(a.extra).length === 0 ? { extra: { ...a.extra, scores: defaultScores() } } : {}) })}>{TRACKING.map((t) => <option key={t} value={t}>{trackingLabel(t)}</option>)}</Select></Field>
                  {a.prescription && <div className="muted small">Earlier wording: {a.prescription}. Fill in the sets below to replace it.</div>}
                  {tracking === 'scores' && <ScoresEditor name={label} scores={formScores(a.extra)} onChange={(scores) => setAct(bi, ai, { extra: { ...a.extra, scores } })} />}
                  {tracking !== 'instruction' && tracking !== 'scores' && (
                    <>
                      <SetGrid name={label} tracking={tracking} plan sets={a.sets} onChange={(i, f, v) => setAct(bi, ai, { sets: a.sets.map((x, j) => (j === i ? { ...x, [f]: v } : x)) })} onRemove={(i) => setAct(bi, ai, { sets: a.sets.filter((_, j) => j !== i) })} />
                      {tracking === 'strength' && <div className="muted small">Weight: type kilos, or a percentage of the member's best like 80% (their app turns it into kilos from their heaviest lift for this exercise). Reps: a number, a range like 8-12, or max.</div>}
                      <Button aria-label={`Add a set to ${label}`} onClick={() => setAct(bi, ai, { sets: [...a.sets, { ...(a.sets[a.sets.length - 1] ?? {}) }] })}>+ Set (same as the last)</Button>
                    </>
                  )}
                  <Field label="Note for the member" htmlFor={`wk-a${a.key}-c`}><Input id={`wk-a${a.key}-c`} placeholder="A cue or how to scale it (optional)" value={a.notes} onChange={(e) => setAct(bi, ai, { notes: e.target.value })} /></Field>
                </div>
              );
            })}
          </div>
        ))}
        <div className="wk-add">
          <ExercisePicker label="Add an exercise" placeholder="Start typing, like squat or row" value={adding} own={[]} onChange={setAdding} onPick={setAdding} />
          <Button disabled={!adding.trim()} onClick={() => { setNote(null); setBlocks((l) => addExercise(l, adding.trim())); setAdding(''); }}>Add exercise</Button>
        </div>
      </Card>

      {asking && (
        <div className="notice wk-confirm" role="alertdialog" aria-label="Confirm">
          <span>Archive this workout? It leaves the library. Members who were already given it keep their copy.</span>
          <Button variant="primary" onClick={archive}>Yes, archive</Button><Button onClick={() => setAsking(false)}>Keep</Button>
        </div>
      )}
      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      {id && dirty && <p className="muted small">You have unsaved changes. Save the workout before assigning it or publishing it.</p>}
      <div className="membership-actions wk-actions">
        <Button variant="primary" disabled={w.save.isPending} onClick={save}>{w.save.isPending ? 'Saving…' : 'Save workout'}</Button>
        <Button disabled={!usable} onClick={() => setDialog('assign')}>Assign to member</Button>
        <Button disabled={!usable} onClick={() => setDialog('wod')}>Publish as WOD</Button>
        {id && <Button onClick={() => { setNote(null); setAsking(true); }}>Archive</Button>}
      </div>
      {dialog === 'assign' && current && <AssignWorkoutsDialog preselect={current.id} onClose={(n) => { setDialog(null); if (n) setNote(n); }} />}
      {dialog === 'wod' && current && <WodDialog t={current} w={w} onClose={(n) => { setDialog(null); if (n) setNote(n); }} />}
    </>
  );
}

function WodDialog({ t, w, onClose }: { t: TemplateRow; w: ReturnType<typeof useWorkoutWrites>; onClose: (n?: Note) => void }) {
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date()));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const go = () => {
    const bad = validateWodDate(date);
    if (bad) return setError(bad);
    setError('');
    w.wod.mutate({ id: t.id, date, message: message.trim() || null }, {
      onSuccess: () => onClose({ text: `${t.title} published as the workout of the day for ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}.`, good: true }),
      onError: (e) => setError(e.message),
    });
  };
  return (
    <Modal title="Publish workout of the day" onClose={() => onClose()}>
      <SectionTitle title="Publish workout of the day" action={<Button onClick={() => onClose()}>Close</Button>} />
      <p className="muted small">Members see <b>{t.title}</b> as the gym workout for the chosen day. Publishing again for the same day replaces the earlier one.</p>
      <Field label="Date" htmlFor="wod-date"><DateInput id="wod-date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Message (optional)" htmlFor="wod-msg"><Textarea id="wod-msg" placeholder="A note to members" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
      <Button variant="primary" className="wide-btn" disabled={w.wod.isPending} onClick={go}>{w.wod.isPending ? 'Publishing…' : 'Publish WOD'}</Button>
    </Modal>
  );
}
