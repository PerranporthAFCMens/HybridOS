import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadAssignableMembers, loadBlocks, type TemplateRow } from '../data/workouts';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Checkbox, DateInput, Field, FieldRow, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { BLOCK_TYPES, TRACKING, WEEK_DAYS, WORKOUT_TYPES, blockLabel, dueAt, emptyWorkout, hasChanged, moveItem, newActivity, newBlock, programmeDates, trackingLabel, validateWodDate, validateWorkout, type BlockForm, type WorkoutForm } from './calc';
import { dayText as ukDay } from '../builder/period';
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
          <div className="muted">Build reusable multi-activity sessions for personal training assignments and the gym workout of the day.</div>
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
                  <div className="tags"><span className="tag">{t.workoutType}</span><span className={`tag ${t.visibility === 'gym' ? 'good' : ''}`}>{t.visibility === 'gym' ? 'Gym members' : 'Staff only'}</span></div>
                  <div className="muted small">{[t.focusTags.join(' · '), t.estimatedMinutes ? `${t.estimatedMinutes} min` : ''].filter(Boolean).join(' · ') || 'No focus tags'}</div>
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

function Editor({ template, onClose }: { template: TemplateRow | null; onClose: (n?: Note) => void }) {
  const { gym, userId } = useReadyAuth();
  const w = useWorkoutWrites(gym.gymId, userId);
  const loaded = useQuery({ queryKey: ['workout-blocks', template?.id], queryFn: () => loadBlocks(template?.id ?? ''), enabled: !!template, gcTime: 0 });
  if (template && loaded.isPending) return <Card><Empty>Loading the workout…</Empty></Card>;
  if (template && loaded.isError) return <Card><Empty>Could not load this workout. Go back and try again.</Empty><Button onClick={() => onClose()}>Back to the library</Button></Card>;
  return <EditorForm template={template} initialBlocks={loaded.data ?? []} w={w} onClose={onClose} />;
}

function EditorForm({ template, initialBlocks, w, onClose }: { template: TemplateRow | null; initialBlocks: BlockForm[]; w: ReturnType<typeof useWorkoutWrites>; onClose: (n?: Note) => void }) {
  const { gym } = useReadyAuth();
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
        setCurrent({ id: newId, title: c.input.title, description: c.input.description, workoutType: c.input.workoutType, focusTags: c.input.focusTags, estimatedMinutes: c.input.estimatedMinutes, visibility: c.input.visibility === 'gym' ? 'gym' : 'private' });
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
        <SectionTitle title={id ? 'Edit workout' : 'Create a workout'} action={<Button onClick={() => onClose()}>Back to the library</Button>} />
        <FieldRow>
          <Field label="Workout name" htmlFor="wk-title"><Input id="wk-title" maxLength={120} placeholder="Leg Day" value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Workout type" htmlFor="wk-type"><Select id="wk-type" value={form.type} onChange={(e) => set('type', e.target.value)}>{WORKOUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Focus tags" htmlFor="wk-tags" hint="Separate with commas."><Input id="wk-tags" placeholder="Legs, Strength" value={form.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
          <Field label="Estimated minutes" htmlFor="wk-min"><Input id="wk-min" type="number" inputMode="numeric" min="1" max="600" value={form.minutes} onChange={(e) => set('minutes', e.target.value)} /></Field>
        </FieldRow>
        <Field label="Coach description" htmlFor="wk-desc"><Textarea id="wk-desc" maxLength={2000} placeholder="Session intent, scaling guidance or overview" value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Visibility" htmlFor="wk-vis"><Select id="wk-vis" value={form.visibility} onChange={(e) => set('visibility', e.target.value === 'gym' ? 'gym' : 'private')}><option value="private">Staff only</option><option value="gym">Gym members</option></Select></Field>
      </Card>

      <Card>
        <SectionTitle title="Workout blocks" action={<Button onClick={() => { setNote(null); setBlocks((l) => [...l, newBlock()]); }}>Add block</Button>} />
        <p className="muted small">Warm-up, strength, conditioning, finisher and more.</p>
        {blocks.length === 0 && <Empty>Add a block to start building the session.</Empty>}
        {blocks.map((b, bi) => (
          <div className="wk-block" key={b.key}>
            <div className="wk-block-head">
              <b>Block {bi + 1}</b>
              <div className="wk-move">
                <Button aria-label={`Move block ${bi + 1} up`} disabled={bi === 0} onClick={() => setBlocks((l) => moveItem(l, bi, -1))}>Up</Button>
                <Button aria-label={`Move block ${bi + 1} down`} disabled={bi === blocks.length - 1} onClick={() => setBlocks((l) => moveItem(l, bi, 1))}>Down</Button>
                <Button aria-label={`Remove block ${bi + 1}`} onClick={() => setBlocks((l) => l.filter((_, i) => i !== bi))}>Remove</Button>
              </div>
            </div>
            <FieldRow>
              <Field label="Block name" htmlFor={`wk-b${b.key}-t`}><Input id={`wk-b${b.key}-t`} value={b.title} onChange={(e) => setBlock(bi, { title: e.target.value })} /></Field>
              <Field label="Format" htmlFor={`wk-b${b.key}-f`}><Select id={`wk-b${b.key}-f`} value={b.blockType} onChange={(e) => setBlock(bi, { blockType: e.target.value })}>{BLOCK_TYPES.map((t) => <option key={t} value={t}>{blockLabel(t)}</option>)}</Select></Field>
              <Field label="Rounds (optional)" htmlFor={`wk-b${b.key}-r`}><Input id={`wk-b${b.key}-r`} type="number" inputMode="numeric" min="1" value={b.rounds} onChange={(e) => setBlock(bi, { rounds: e.target.value })} /></Field>
            </FieldRow>
            <Field label="Block instructions" htmlFor={`wk-b${b.key}-i`}><Input id={`wk-b${b.key}-i`} placeholder="4 rounds, controlled tempo…" value={b.instructions} onChange={(e) => setBlock(bi, { instructions: e.target.value })} /></Field>
            {b.activities.map((a, ai) => (
              <div className="wk-activity" key={a.key}>
                <div className="wk-block-head">
                  <b>Activity {ai + 1}</b>
                  <div className="wk-move">
                    <Button aria-label={`Move activity ${ai + 1} of block ${bi + 1} up`} disabled={ai === 0} onClick={() => setBlock(bi, { activities: moveItem(b.activities, ai, -1) })}>Up</Button>
                    <Button aria-label={`Move activity ${ai + 1} of block ${bi + 1} down`} disabled={ai === b.activities.length - 1} onClick={() => setBlock(bi, { activities: moveItem(b.activities, ai, 1) })}>Down</Button>
                    <Button aria-label={`Remove activity ${ai + 1} of block ${bi + 1}`} onClick={() => setBlock(bi, { activities: b.activities.filter((_, j) => j !== ai) })}>Remove</Button>
                  </div>
                </div>
                <FieldRow>
                  <Field label="Exercise or activity" htmlFor={`wk-a${a.key}-n`}><Input id={`wk-a${a.key}-n`} placeholder="Back squat" value={a.name} onChange={(e) => setAct(bi, ai, { name: e.target.value })} /></Field>
                  <Field label="Track by" htmlFor={`wk-a${a.key}-t`}><Select id={`wk-a${a.key}-t`} value={a.tracking} onChange={(e) => setAct(bi, ai, { tracking: e.target.value })}>{TRACKING.map((t) => <option key={t} value={t}>{trackingLabel(t)}</option>)}</Select></Field>
                  <Field label="Prescription" htmlFor={`wk-a${a.key}-p`}><Input id={`wk-a${a.key}-p`} placeholder="4 x 6 @ 80kg" value={a.prescription} onChange={(e) => setAct(bi, ai, { prescription: e.target.value })} /></Field>
                </FieldRow>
                <Field label="Coach notes" htmlFor={`wk-a${a.key}-c`}><Input id={`wk-a${a.key}-c`} placeholder="Optional cue or scaling note" value={a.notes} onChange={(e) => setAct(bi, ai, { notes: e.target.value })} /></Field>
              </div>
            ))}
            <Button aria-label={`Add activity to block ${bi + 1}`} onClick={() => setBlock(bi, { activities: [...b.activities, newActivity()] })}>Add activity</Button>
          </div>
        ))}
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
      {dialog === 'assign' && current && <AssignDialog t={current} w={w} gymId={gym.gymId} onClose={(n) => { setDialog(null); if (n) setNote(n); }} />}
      {dialog === 'wod' && current && <WodDialog t={current} w={w} onClose={(n) => { setDialog(null); if (n) setNote(n); }} />}
    </>
  );
}

function AssignDialog({ t, w, gymId, onClose }: { t: TemplateRow; w: ReturnType<typeof useWorkoutWrites>; gymId: string; onClose: (n?: Note) => void }) {
  const q = useQuery({ queryKey: ['assignable-members', gymId], queryFn: () => loadAssignableMembers(gymId) });
  const [member, setMember] = useState('');
  const [mode, setMode] = useState<'once' | 'weekly'>('once');
  const [due, setDue] = useState('');
  const [from, setFrom] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState('4');
  const [error, setError] = useState('');
  const chosen = member || q.data?.[0]?.userId || '';
  const dates = mode === 'weekly' ? programmeDates(from, days, Number(weeks)) : null;
  const who = q.data?.find((m) => m.userId === chosen)?.name ?? 'the member';
  const go = () => {
    if (!chosen) return setError('Choose a member.');
    let dues: (string | null)[];
    if (mode === 'once') dues = [dueAt(due)];
    else {
      if (!dates) return setError('Choose the date to start from.');
      if (dates.length === 0) return setError('Choose at least one day of the week.');
      dues = dates.map((d) => dueAt(d));
    }
    setError('');
    w.assign.mutate({ t, member: chosen, dues }, {
      onSuccess: () => onClose({ text: dues.length === 1 ? `${t.title} assigned to ${who}.` : `${t.title} assigned to ${who} on ${dues.length} days.`, good: true }),
      onError: (e) => setError(e.message),
    });
  };
  const toggle = (i: number) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort((a, b) => a - b)));
  return (
    <Modal title="Assign workout" onClose={() => onClose()}>
      <SectionTitle title="Assign workout" action={<Button onClick={() => onClose()}>Close</Button>} />
      <p className="muted small">Personal training assignment: <b>{t.title}</b>. The member gets a copy as it is now. It is a suggestion they can change, swap or skip.</p>
      {q.isPending && <Empty>Loading members…</Empty>}
      {q.isError && <Empty>Could not load members.</Empty>}
      {q.data && q.data.length === 0 && <Empty>No active members with an app login yet.</Empty>}
      {q.data && q.data.length > 0 && (
        <>
          <Field label="Member" htmlFor="as-member"><Select id="as-member" value={chosen} onChange={(e) => setMember(e.target.value)}>{q.data.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</Select></Field>
          <Field label="How often" htmlFor="as-mode"><Select id="as-mode" value={mode} onChange={(e) => setMode(e.target.value === 'weekly' ? 'weekly' : 'once')}><option value="once">Once</option><option value="weekly">Every week on chosen days</option></Select></Field>
          {mode === 'once' ? (
            <Field label="Due date (optional)" htmlFor="as-due"><DateInput id="as-due" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          ) : (
            <>
              <Field label="Start date" htmlFor="as-from"><DateInput id="as-from" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <div role="group" aria-label="Days of the week" className="assign-days">
                {WEEK_DAYS.map((d, i) => <Checkbox key={d} label={d} checked={days.includes(i)} onChange={() => toggle(i)} />)}
              </div>
              <Field label="For how many weeks" htmlFor="as-weeks"><Select id="as-weeks" value={weeks} onChange={(e) => setWeeks(e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}</Select></Field>
              <p className="muted small" role="status">{dates && dates.length > 0 ? `${dates.length} ${dates.length === 1 ? 'workout' : 'workouts'}, from ${ukDay(dates[0] ?? '')} to ${ukDay(dates[dates.length - 1] ?? '')}.` : 'Choose a start date and the days.'}</p>
            </>
          )}
          <div className="assign-msg">{error && <span className="msg error" role="alert">{error}</span>}</div>
          <Button variant="primary" className="wide-btn" disabled={w.assign.isPending} onClick={go}>{w.assign.isPending ? 'Assigning…' : mode === 'weekly' && dates && dates.length > 1 ? `Assign ${dates.length} workouts` : 'Assign workout'}</Button>
        </>
      )}
    </Modal>
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
