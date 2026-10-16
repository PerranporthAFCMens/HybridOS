import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClassForm } from '../classes/ClassForm';
import { useReadyAuth } from '../auth/AuthProvider';
import { getBlocksOfClasses, type ClassBlock } from '../data/classBlocks';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { DateInput, Field, Input } from '../ui/Field';
import { BlockBenchmarks } from '../classes/BlockBenchmarks';
import { blockLabel, blockLastDay, blockState, validateBlock } from '../classes/blocks';
import { useBlockClasses, useBlocks, useBlockWrites } from '../classes/useBlocks';
import { useBlockBenchmarks } from '../classes/useBenchmarks';
import { WorkoutGrid } from './WorkoutGrid';
import { WEEKDAYS, classNames, daysFor, pickClasses, programmeSteps } from './calc';
import '../members/members.css';
import '../classes/classes.css';
import './programmes.css';

const todayDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const dateText = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

/**
 * Programmes: a block of weeks, run as four steps (name it, pick the classes, add the workouts, set the tests). Each step says what is
 * done and what is next. A programme never creates classes; it attaches the ones already on the timetable.
 */
export function Programmes() {
  const { gym, userId } = useReadyAuth();
  const q = useBlocks(gym.gymId);
  const w = useBlockWrites(gym.gymId, userId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', startsOn: todayDay(), weeks: '6' });
  const [error, setError] = useState('');
  const open = q.data?.find((b) => b.id === openId) ?? null;

  const create = () => {
    const c = validateBlock(form);
    if (!c.ok) return setError(c.message);
    setError('');
    w.create.mutate(c, { onSuccess: (id) => { setAdding(false); setOpenId(id); setForm({ name: '', startsOn: todayDay(), weeks: '6' }); }, onError: (e) => setError(e.message) });
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Classes and workouts</div>
          <h1>{open ? open.name : 'Programmes'}</h1>
          <div className="muted">{open ? `${dateText(open.startsOn)} to ${dateText(blockLastDay(open.startsOn, open.weeks))}` : 'A programme is a run of weeks, like six weeks of Hybrid Uppers. You set it up in four steps.'}</div>
        </div>
        {open ? <Button onClick={() => setOpenId(null)}>Back to programmes</Button> : !adding && <Button variant="primary" onClick={() => { setAdding(true); setError(''); }}>New programme</Button>}
      </header>

      {open ? <ProgrammePage key={open.id} block={open} onGone={() => setOpenId(null)} /> : (
        <>
          {q.isPending && <Card><Empty>Loading programmes…</Empty></Card>}
          {q.isError && <Card><Empty>Could not load programmes. Refresh to try again.</Empty></Card>}
          {adding && (
            <Card>
              <SectionTitle title="Step 1: name it" />
              <div className="block-form">
                <Field label="Programme name" htmlFor="pg-name"><Input id="pg-name" maxLength={80} placeholder="Hybrid Uppers" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Starts on" htmlFor="pg-start"><DateInput id="pg-start" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
                <Field label="Number of weeks" htmlFor="pg-weeks"><Input id="pg-weeks" type="number" inputMode="numeric" min="1" max="52" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} /></Field>
                <div className="cw-actions">
                  <Button variant="primary" disabled={w.create.isPending} onClick={create}>{w.create.isPending ? 'Creating…' : 'Create programme'}</Button>
                  <Button onClick={() => { setAdding(false); setError(''); }}>Cancel</Button>
                </div>
              </div>
              {error && <div className="msg error" role="alert">{error}</div>}
            </Card>
          )}
          {q.data?.length === 0 && !adding && <Card><Empty>No programmes yet. Press New programme to start.</Empty></Card>}
          <ul className="team-list">
            {q.data?.map((b) => {
              const st = blockState(b.startsOn, b.weeks, todayDay());
              return (
                <li className="team-item" key={b.id}>
                  <div className="team-main">
                    <b>{b.name}</b>
                    <div className="muted small">{dateText(b.startsOn)} to {dateText(blockLastDay(b.startsOn, b.weeks))} · {b.weeks} {b.weeks === 1 ? 'week' : 'weeks'}</div>
                    <div className="tags"><span className={`tag ${st.state === 'running' ? 'good' : ''}`.trim()}>{st.state === 'running' ? `Week ${st.week} of ${b.weeks}` : st.state === 'upcoming' ? 'Not started' : 'Finished'}</span></div>
                  </div>
                  <div className="team-actions"><Button aria-label={`Open ${b.name}`} onClick={() => setOpenId(b.id)}>Open</Button></div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function ProgrammePage({ block, onGone }: { block: ClassBlock; onGone: () => void }) {
  const { gym, userId } = useReadyAuth();
  const w = useBlockWrites(gym.gymId, userId);
  const q = useBlockClasses(gym.gymId, block);
  const tests = useBlockBenchmarks(gym.gymId, block.id);
  const classes = useMemo(() => q.data ?? [], [q.data]);
  const ids = classes.map((c) => c.session.session_id);
  const others = useQuery({ queryKey: ['programme-others', gym.gymId, block.id, ids.join(',')], queryFn: () => getBlocksOfClasses(ids), enabled: ids.length > 0 });
  const otherBlock = useMemo(() => new Map([...(others.data ?? new Map<string, ClassBlock>()).entries()].filter(([, b]) => b.id !== block.id).map(([id, b]) => [id, b.name])), [others.data, block.id]);

  const names = classNames(classes);
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[] | null>(null);
  const chosenName = name && names.includes(name) ? name : '';
  // Pick a class name and its usual days start ticked; the coach can change them.
  const chosenDays = days ?? (chosenName ? daysFor(classes, chosenName) : []);
  const pick = pickClasses(classes, chosenName, chosenDays, otherBlock);
  const steps = programmeSteps(classes, tests.data?.length ?? 0);
  const [form, setForm] = useState({ name: block.name, startsOn: block.startsOn, weeks: String(block.weeks) });
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const qc = useQueryClient();
  const dirtyDetails = form.name !== block.name || form.startsOn !== block.startsOn || form.weeks !== String(block.weeks);
  const missing = classes.filter((c) => c.inBlock && c.workout === 'none');
  const inBlock = classes.filter((c) => c.inBlock).length;

  const saveDetails = () => {
    const c = validateBlock(form);
    if (!c.ok) return setNote({ text: c.message, good: false });
    setNote(null);
    w.update.mutate({ id: block.id, ...c }, { onSuccess: () => setNote({ text: 'Saved.', good: true }), onError: (e) => setNote({ text: e.message, good: false }) });
  };
  const attach = () => {
    setNote(null);
    w.classes.mutate({ blockId: block.id, add: pick.toAdd, remove: [] }, { onSuccess: () => setNote({ text: `Added ${pick.toAdd.length} ${pick.toAdd.length === 1 ? 'class' : 'classes'} to ${block.name}.`, good: true }), onError: (e) => setNote({ text: e.message, good: false }) });
  };
  const toggleDay = (d: number) => setDays(chosenDays.includes(d) ? chosenDays.filter((x) => x !== d) : [...chosenDays, d]);

  return (
    <>
      <ol className="prog-steps" aria-label="Steps">
        {steps.map((s) => (
          <li key={s.n} className={`prog-step ${s.state}`}>
            <small>{s.state === 'done' ? '✓ Done' : s.state === 'current' ? '● You are here' : s.state === 'optional' ? 'Optional' : 'Next'}</small>
            <b>{s.n} {s.title}</b>
            <small>{s.detail}</small>
          </li>
        ))}
      </ol>

      <Card>
        <SectionTitle title="1 Name it" />
        <div className="block-form">
          <Field label="Programme name" htmlFor="pp-name"><Input id="pp-name" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Starts on" htmlFor="pp-start"><DateInput id="pp-start" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
          <Field label="Number of weeks" htmlFor="pp-weeks"><Input id="pp-weeks" type="number" inputMode="numeric" min="1" max="52" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })} /></Field>
          {dirtyDetails && <Button variant="primary" disabled={w.update.isPending} onClick={saveDetails}>{w.update.isPending ? 'Saving…' : 'Save details'}</Button>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="2 Pick the classes" />
        <p className="muted small">Choose a class already on the timetable and the days it runs, and every match in these weeks is added. Not there yet? Schedule it here.</p>
        {q.isPending && <p className="muted small">Loading classes…</p>}
        {q.isError && <p className="muted small">Could not load the classes. Go back and open the programme again.</p>}
        <div className="team-actions"><Button variant={names.length === 0 ? 'primary' : 'secondary'} onClick={() => setScheduling(true)}>Schedule a new class</Button></div>
        {q.data && names.length === 0 && <p className="muted small">There are no classes on the timetable in these weeks yet. Schedule one above, or add them on the Timetable.</p>}
        {names.length > 0 && (
          <>
            <p className="prog-label">Which class</p>
            <div className="prog-pick" role="group" aria-label="Which class">
              {names.map((n) => <Button key={n} variant={n === chosenName ? 'primary' : 'secondary'} aria-pressed={n === chosenName} onClick={() => { setName(n); setDays(null); setNote(null); }}>{n}</Button>)}
            </div>
            {chosenName && (
              <>
                <p className="prog-label">On which days</p>
                <div className="prog-pick" role="group" aria-label="On which days">
                  {WEEKDAYS.map((d) => <Button key={d.day} variant={chosenDays.includes(d.day) ? 'primary' : 'secondary'} aria-pressed={chosenDays.includes(d.day)} onClick={() => toggleDay(d.day)}>{d.label}</Button>)}
                </div>
                <p className="prog-summary"><b>{pick.matching.length} {pick.matching.length === 1 ? 'class matches' : 'classes match'}</b> in these {block.weeks} {block.weeks === 1 ? 'week' : 'weeks'}.
                  {pick.alreadyIn > 0 && <> {pick.alreadyIn} already in this programme.</>}
                  {pick.elsewhere.length > 0 && <> <span className="warn-text">{pick.elsewhere.length} already in another programme ({[...new Set(pick.elsewhere.map((e) => e.block))].join(', ')}) and will be skipped.</span></>}
                </p>
                <Button variant="primary" disabled={pick.toAdd.length === 0 || w.classes.isPending} onClick={attach}>{w.classes.isPending ? 'Adding…' : pick.toAdd.length === 0 ? 'Nothing new to add' : `Add ${pick.toAdd.length} ${pick.toAdd.length === 1 ? 'class' : 'classes'} to this programme`}</Button>
              </>
            )}
          </>
        )}
      </Card>

      {scheduling && (
        <ClassForm
          initial={{ date: block.startsOn, repeat: true, weeks: String(Math.min(52, Math.max(2, block.weeks))) }}
          onClose={() => setScheduling(false)}
          onSaved={(_at, savedName) => {
            setScheduling(false);
            void qc.invalidateQueries({ queryKey: ['block-classes', gym.gymId] });
            setName(savedName);
            setDays(null);
            setNote({ text: `${savedName} is on the timetable. Check the days below and add it to ${block.name}.`, good: true });
          }}
        />
      )}

      <Card>
        <SectionTitle title="3 Add the workouts" />
        {inBlock === 0 ? <p className="muted small">Attach some classes first (step 2).</p> : (
          <>
            <p className="muted small">{inBlock - missing.length} of {inBlock} classes have a workout. Tap a week to choose its workout, or use one workout for every week of a class.</p>
            <WorkoutGrid block={block} classes={classes} />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle title="4 Set the tests (optional)" />
        <BlockBenchmarks block={block} />
      </Card>

      {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
      <div className="cw-actions block-end">
        {!asking ? <Button onClick={() => setAsking(true)}>Delete this programme</Button> : (
          <>
            <span className="muted small">Delete {blockLabel(block.name, null, block.weeks)}? The classes and their workouts stay; they just stop being part of a programme.</span>
            <Button variant="primary" onClick={() => w.remove.mutate(block.id, { onSuccess: onGone, onError: (e) => setNote({ text: e.message, good: false }) })}>Yes, delete it</Button>
            <Button onClick={() => setAsking(false)}>Keep</Button>
          </>
        )}
      </div>
    </>
  );
}
