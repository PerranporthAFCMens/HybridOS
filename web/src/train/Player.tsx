import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { completeWorkout, getMyAssignment, listLastTimes, listMyPbs, markStarted, removeExercise, saveExercise, type LastTime } from '../data/train';
import { getMyClassWorkout } from '../data/classWorkouts';
import { Button } from '../ui/Button';
import { pbKey, wonMessage, type Won } from './pb';
import { bestWeights, hasPercent, planFor, resolveTarget } from './percent';
import { guessTracking } from './activities';
import { ExercisePicker } from './ExercisePicker';
import { Checkbox, Input, Select } from '../ui/Field';
import { SetGrid } from './SetGrid';
import { REASONS, assignmentNote, blankSets, buildResult, fromDbSet, hasEntered, prepareFinish, readSnapshot, resultJson, setText, type PlayedActivity, type ScoreDef, type SetValues, type Tracking } from './calc';

interface Act extends PlayedActivity { key: string; plan: string; planNote: string; block: string; target: SetValues[]; scores?: ScoreDef[]; entryId?: string; savedText?: string }
interface Draft { acts: Act[]; rpe: string; notes: string; sessionId?: string | null }

const draftKey = (gymId: string, id: string) => `hybrid-train-draft:${gymId}:${id}`;
const readDraft = (key: string): Draft | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft | null;
    return raw && Array.isArray(raw.acts) ? raw : null;
  } catch {
    return null;
  }
};
const TRACK_CHOICES: [Tracking, string][] = [['strength', 'Weight and reps'], ['reps', 'Reps'], ['time', 'Time'], ['distance', 'Distance'], ['calories', 'Calories']];

/** Why it was different: a chip. Optional, and never a judgement. */
function Reasons({ act, onPatch }: { act: Act; onPatch: (p: Partial<Act>) => void }) {
  return (
    <div className="tr-reasons" role="group" aria-label={`Why ${act.name} was different`}>
      <div className="muted small">What happened? (optional)</div>
      <div className="tr-chips">
        {REASONS.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={act.reason === k} className={`tr-chip${act.reason === k ? ' on' : ''}`} onClick={() => onPatch({ reason: act.reason === k ? undefined : k })}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/** Open a coach's workout, a class workout (start your own blank one), fill in the numbers, finish. */
export function Player() {
  const { id = 'new', sessionId } = useParams();
  const { gym, userId } = useReadyAuth();
  const isClass = !!sessionId;
  const isNew = id === 'new' && !isClass;
  const plan = useQuery({ queryKey: ['m-assignment', gym.gymId, id], queryFn: () => getMyAssignment(userId, gym.gymId, id), enabled: !isNew && !isClass });
  const cls = useQuery({ queryKey: ['m-class-workout', gym.gymId, userId, sessionId], queryFn: () => getMyClassWorkout(userId, gym.gymId, sessionId ?? ''), enabled: isClass });
  const last = useQuery({ queryKey: ['m-last', gym.gymId, userId], queryFn: () => listLastTimes(userId, gym.gymId) });
  const [again, setAgain] = useState(false);
  if (isClass) {
    if (cls.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
    if (cls.isError || !cls.data) return <div className="mem-screen"><h1 className="mem-title">Workout not found</h1><div className="mem-card muted">It may not be available yet, or you were not in that class. <Link to="/m/train">Back to Workouts</Link></div></div>;
    if (cls.data.done && !again && !readDraft(draftKey(gym.gymId, `class-${sessionId}`))) {
      return (
        <div className="mem-screen">
          <Link to="/m/train" className="mem-back">‹ Workouts</Link>
          <h1 className="mem-title">{cls.data.title}</h1>
          <div className="mem-card" role="status">You have already recorded this class. <div className="mem-actions"><Link className="btn primary" to="/m/train">Back to Workouts</Link><Button onClick={() => setAgain(true)}>Record it again</Button></div></div>
        </div>
      );
    }
    if (last.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
    return <Logger key={`class-${sessionId}`} id={`class-${sessionId}`} classSessionId={sessionId} title={cls.data.title} snapshot={cls.data.snapshot} source="" last={last.data ?? new Map()} />;
  }
  if (!isNew && plan.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
  if (!isNew && (plan.isError || !plan.data)) return <div className="mem-screen"><h1 className="mem-title">Workout not found</h1><div className="mem-card muted">It may have been finished or removed. <Link to="/m/train">Back to Train</Link></div></div>;
  if (last.isPending) return <div className="mem-screen"><div className="mem-card muted">Loading…</div></div>;
  return <Logger key={id} id={id} title={plan.data?.title ?? ''} snapshot={plan.data?.snapshot ?? null} source={plan.data?.source ?? ''} last={last.data ?? new Map()} />;
}

function Logger({ id, classSessionId, title, snapshot, source, last }: { id: string; classSessionId?: string; title: string; snapshot: unknown; source: string; last: Map<string, LastTime> }) {
  const { gym, userId } = useReadyAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isClass = !!classSessionId;
  const isNew = id === 'new';
  // Only a workout a coach assigned has an assignment to mark started and finished; a class workout is the member's own record.
  const assigned = !isNew && !isClass;
  const key = draftKey(gym.gymId, id);
  const initial = useMemo<Draft>(() => {
    const saved = readDraft(key);
    if (saved) return saved;
    const acts: Act[] = readSnapshot(snapshot).activities.map((a) => ({ key: a.key, name: a.name, originalName: a.name, tracking: a.tracking, sets: blankSets(a.tracking), done: false, skipped: false, note: '', plan: a.plan, planNote: a.note, block: a.block, target: a.target, scores: a.scores }));
    return { acts, rpe: '', notes: '' };
  }, [key, snapshot]);
  const [acts, setActs] = useState<Act[]>(initial.acts);
  const [rpe, setRpe] = useState(initial.rpe);
  const [notes, setNotes] = useState(initial.notes);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [adding, setAdding] = useState({ name: '', tracking: 'strength' as Tracking });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initial.sessionId ?? null);
  const [won, setWon] = useState<Won[]>([]);
  const [pbIssue, setPbIssue] = useState<string | null>(null);
  const [cardError, setCardError] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [manualTracking, setManualTracking] = useState(false);
  const own = useMemo(() => [...last.values()].map((l) => l.name), [last]);
  // The member's heaviest recorded lift per exercise: what a percentage in the coach's plan is a percentage of.
  const pbs = useQuery({ queryKey: ['m-pbs', gym.gymId, userId], queryFn: () => listMyPbs(userId, gym.gymId) });
  const bests = useMemo(() => bestWeights(pbs.data ?? []), [pbs.data]);
  const bestFor = (a: Act) => bests.get(pbKey(a.name)) ?? null;

  useEffect(() => { if (assigned) void markStarted(id); }, [id, assigned]);
  // Once the workout is finished the draft is cleared for good: a later render must never write it back.
  const finished = useRef(false);
  useEffect(() => {
    if (finished.current) return;
    try { localStorage.setItem(key, JSON.stringify({ acts, rpe, notes, sessionId } satisfies Draft)); } catch { /* the draft is a convenience */ }
  }, [key, acts, rpe, notes, sessionId]);

  const patch = (k: string, p: Partial<Act>) => setActs((list) => list.map((a) => (a.key === k ? { ...a, ...p } : a)));
  const setSet = (k: string, i: number, field: string, value: string) => setActs((list) => list.map((a) => (a.key === k ? { ...a, sets: a.sets.map((s, j) => (j === i ? { ...s, [field]: value } : s)) } : a)));
  /** Take one set out (at least one set always stays). */
  // An exercise the member added (not one the coach sent) can be taken out completely; the coach's can only be skipped.
  const isOwn = (a: Act) => a.originalName === '';
  const removeSet = (k: string, i: number) => setActs((list) => list.map((a) => (a.key === k && a.sets.length > 1 ? { ...a, sets: a.sets.filter((_, j) => j !== i) } : a)));
  const lastFor = (a: Act) => last.get(a.originalName.trim().toLowerCase());
  const copyLast = (a: Act) => {
    const l = lastFor(a);
    if (l) patch(a.key, { sets: l.sets.map((s) => fromDbSet(a.tracking, s)), sided: l.sets.some((s) => s.side) || a.sided });
  };
  /** "As set": say so, and put the coach's numbers in any empty boxes so one tap and Save is all it takes. */
  const asSet = (a: Act) => {
    if (a.outcome === 'as_set') return patch(a.key, { outcome: undefined });
    const empty = !hasEntered(a);
    patch(a.key, { outcome: 'as_set', ...(empty && a.target.length ? { sets: resolveTarget(a.target, bestFor(a)) } : {}) });
  };
  const addExercise = () => {
    const name = adding.name.trim();
    if (!name) return;
    setActs((list) => [...list, { key: `n${Date.now()}`, name, originalName: '', tracking: adding.tracking, sets: blankSets(adding.tracking), done: false, skipped: false, note: '', plan: '', planNote: '', block: '', target: [] }]);
    setAdding({ name: '', tracking: adding.tracking });
    setManualTracking(false);
  };
  const typeName = (name: string) => setAdding((x) => ({ name, tracking: manualTracking ? x.tracking : guessTracking(name) }));

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['m-assignments'] }), qc.invalidateQueries({ queryKey: ['m-week'] }), qc.invalidateQueries({ queryKey: ['m-sessions'] }), qc.invalidateQueries({ queryKey: ['m-last'] }), qc.invalidateQueries({ queryKey: ['m-pbs'] }), qc.invalidateQueries({ queryKey: ['m-class-workouts'] }), qc.invalidateQueries({ queryKey: ['m-class-workout'] })]);
  const titleFor = (first: string) => title || first || 'Workout';

  /** Save one exercise now. */
  const saveOne = async (a: Act, quiet = false): Promise<boolean> => {
    setCardError((e) => ({ ...e, [a.key]: '' }));
    const r = prepareFinish([a]);
    if (!r.ok) { setCardError((e) => ({ ...e, [a.key]: r.message })); return false; }
    const entry = r.entries[0];
    if (!entry) { if (!quiet) setCardError((e) => ({ ...e, [a.key]: 'Add some numbers first.' })); return false; }
    setSaving(a.key);
    try {
      const res = await saveExercise({ gymId: gym.gymId, userId, sessionId, title: titleFor(entry.name), position: acts.filter((x) => x.entryId).length, assignmentId: assigned ? id : null, classSessionId: classSessionId ?? null }, entry);
      setSessionId(res.sessionId);
      patch(a.key, { entryId: res.entryId, savedText: a.sets.map((s) => setText(a.tracking, s)).filter(Boolean).join(', ') });
      setWon((w) => [...w, ...res.won]);
      if (res.pbError) setPbIssue(res.pbError);
      return true;
    } catch (e) {
      setCardError((m) => ({ ...m, [a.key]: e instanceof Error ? e.message : 'Could not save that exercise.' }));
      return false;
    } finally {
      setSaving(null);
    }
  };

  /** Take a saved exercise back so it can be changed. */
  const change = async (a: Act) => {
    if (!a.entryId) return;
    setSaving(a.key);
    try {
      await removeExercise(a.entryId);
      patch(a.key, { entryId: undefined, savedText: undefined });
    } catch (e) {
      setCardError((m) => ({ ...m, [a.key]: e instanceof Error ? e.message : 'Could not change that exercise.' }));
    } finally {
      setSaving(null);
    }
  };

  /** Take an exercise the member added themselves out of the workout, saved or not. */
  const drop = async (a: Act) => {
    setSaving(a.key);
    try {
      if (a.entryId) await removeExercise(a.entryId);
      setActs((list) => list.filter((x) => x.key !== a.key));
    } catch (e) {
      setCardError((m) => ({ ...m, [a.key]: e instanceof Error ? e.message : 'Could not remove that exercise.' }));
    } finally {
      setSaving(null);
    }
  };

  const finish = async () => {
    setError('');
    const overview = prepareFinish(acts.map((a) => (a.entryId ? { ...a, sets: [] } : a)));
    if (!overview.ok) return setError(overview.message);
    const pending = acts.filter((a) => !a.entryId && !a.skipped);
    setBusy(true);
    let session = sessionId;
    const newWins: Won[] = [];
    try {
      let anySaved = acts.some((a) => a.entryId);
      for (const a of pending) {
        const r = prepareFinish([a]);
        if (!r.ok) return setError(r.message);
        const entry = r.entries[0];
        if (!entry) continue;
        const res = await saveExercise({ gymId: gym.gymId, userId, sessionId: session, title: titleFor(entry.name), position: acts.filter((x) => x.entryId).length + (anySaved ? 1 : 0), assignmentId: assigned ? id : null, classSessionId: classSessionId ?? null }, entry);
        session = res.sessionId;
        anySaved = true;
        newWins.push(...res.won);
        if (res.pbError) setPbIssue(res.pbError);
        patch(a.key, { entryId: res.entryId });
      }
      setSessionId(session);
      if (!assigned && !anySaved) return setError('Add some numbers first, or go back.');
      const firstName = acts.find((a) => a.name.trim())?.name.trim() ?? '';
      const result = await completeWorkout({ sessionId: session, title: titleFor(firstName), notes: notes.trim() || null, assignment: !assigned ? null : { id, rpe: rpe ? Number(rpe) : null, note: assignmentNote(notes, overview.skipped, overview.swapped), result: resultJson(buildResult(acts.map((a) => ({ ...a, entered: !!a.entryId || hasEntered(a) })))) } });
      finished.current = true;
      try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
      await refresh();
      const pb = wonMessage([...won, ...newWins]);
      navigate('/m/train', { state: { saved: result.marked ? 'Workout saved and marked as done.' : isClass ? 'Class workout saved.' : 'Workout saved.', pb, pbError: pbIssue } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the workout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mem-screen">
      <div>
        <Link to="/m/train" className="mem-back">‹ Workouts</Link>
        <h1 className="mem-title">{title || 'My workout'}</h1>
        {source && !isNew && !isClass && <div className="mem-hi">From your coach. These are suggestions: change, swap or skip anything.</div>}
        {isClass && <div className="mem-hi">From your class. Fill in what you did: change, swap or leave out anything. It is saved to your own history.</div>}
      </div>

      {acts.length === 0 && <div className="mem-card muted">No exercises yet. Add the first one below.</div>}
      {acts.map((a, idx) => {
        const l = lastFor(a);
        const prev = idx > 0 ? acts[idx - 1] : undefined;
        return (
          <section key={a.key} className={`mem-card tr-act${a.skipped ? ' skipped' : ''}`} aria-label={a.name}>
            {a.block && a.block !== prev?.block && <div className="mem-eyebrow">{a.block}</div>}
            <div className="mem-row">
              <div>
                <b className="tr-name">{a.name}</b>
                {a.originalName && a.originalName !== a.name && <div className="muted small">Swapped from {a.originalName}</div>}
                {a.plan && <div className="muted small">Suggested: {planFor(a.tracking, a.target, bestFor(a), a.plan)}</div>}
                {hasPercent(a.target) && bestFor(a) === null && <div className="muted small">You have no best recorded for {a.name} yet, so fill in the weight you use.</div>}
                {a.planNote && <div className="muted small">Coach: {a.planNote}</div>}
              </div>
              {a.skipped && <Button onClick={() => patch(a.key, { skipped: false })} aria-label={`Undo not this time for ${a.name}`}>Undo</Button>}
            </div>
            {!isOwn(a) && !a.skipped && (
              <div className="tr-outcome" role="radiogroup" aria-label={`How ${a.name} went`}>
                <Button role="radio" aria-checked={a.outcome === 'as_set'} variant={a.outcome === 'as_set' ? 'primary' : 'secondary'} onClick={() => asSet(a)}>As set</Button>
                {!isClass && <Button role="radio" aria-checked={a.outcome === 'changed'} variant={a.outcome === 'changed' ? 'primary' : 'secondary'} onClick={() => patch(a.key, { outcome: a.outcome === 'changed' ? undefined : 'changed' })}>I changed it</Button>}
              </div>
            )}
            {!isClass && !isOwn(a) && (a.skipped || a.outcome === 'changed' || a.name.trim() !== a.originalName.trim()) && <Reasons act={a} onPatch={(p) => patch(a.key, p)} />}
            {a.skipped ? <div className="muted">Not this time. That is fine.</div> : a.entryId ? (
              <div className="tr-saved">
                <span className="tr-ok">Saved</span>
                {a.savedText && <div className="muted">{a.savedText}</div>}
                <Button disabled={saving === a.key} onClick={() => void change(a)} aria-label={`Change ${a.name}`}>Change</Button>
                {isOwn(a) && <Button disabled={saving === a.key} onClick={() => void drop(a)} aria-label={`Remove ${a.name}`}>Remove</Button>}
              </div>
            ) : a.tracking === 'instruction' ? (
              <Checkbox label="Done" checked={a.done} onChange={(v) => patch(a.key, { done: v })} />
            ) : (
              <>
                {l && l.sets.length > 0 && <div className="muted small">Last time: {l.sets.map((s) => setText(a.tracking, fromDbSet(a.tracking, s))).filter(Boolean).join(', ')}</div>}
                <SetGrid name={a.name} tracking={a.tracking} scores={a.scores ?? []} sets={a.sets} sided={a.sided} onChange={(i, f, v) => setSet(a.key, i, f, v)} onRemove={(i) => removeSet(a.key, i)} onSide={(i, v) => setSet(a.key, i, 'side', v)} />
                <div className="mem-actions tr-tools">
                  <Button onClick={() => patch(a.key, { sets: [...a.sets, {}] })} aria-label={`Add a set to ${a.name}`}>+ Set</Button>
                  <Button onClick={() => patch(a.key, { sided: !a.sided })} aria-pressed={!!a.sided} aria-label={`Left and right for ${a.name}`}>{a.sided ? 'Left / right: on' : 'Left / right'}</Button>
                  {l && l.sets.length > 0 && <Button onClick={() => copyLast(a)} aria-label={`Copy last time for ${a.name}`}>Copy last time</Button>}
                </div>
                <Button variant="primary" disabled={saving === a.key} onClick={() => void saveOne(a)} aria-label={`Save ${a.name}`}>{saving === a.key ? 'Saving…' : 'Save exercise'}</Button>
              </>
            )}
            {cardError[a.key] && <div className="mem-error" role="alert">{cardError[a.key]}</div>}
            {!a.skipped && !a.entryId && (
              <div className="mem-actions tr-tools">
                <Button onClick={() => setSwapping(swapping === a.key ? null : a.key)} aria-expanded={swapping === a.key} aria-label={`Swap ${a.name}`}>Swap</Button>
                {isOwn(a)
                  ? <Button onClick={() => void drop(a)} aria-label={`Remove ${a.name}`}>Remove</Button>
                  : <Button onClick={() => patch(a.key, { skipped: true })} aria-label={`Skip ${a.name}`}>Not this time</Button>}
              </div>
            )}
            {swapping === a.key && !a.skipped && !a.entryId && (
              <ExercisePicker label={`Swap ${a.name} for`} placeholder="What did you do instead?" value={a.name} own={own} onChange={(v) => patch(a.key, { name: v })} onPick={(n) => patch(a.key, { name: n })} />
            )}
            <Input aria-label={`Your note on ${a.name}`} placeholder="Your note, like how it felt (optional)" maxLength={300} value={a.note} onChange={(e) => patch(a.key, { note: e.target.value })} />
          </section>
        );
      })}

      <section className="mem-card" aria-label="Add an exercise">
        <h2>Add an exercise</h2>
        <ExercisePicker label="Exercise name" placeholder="Start typing, like squat or row" value={adding.name} own={own} onChange={typeName} onPick={typeName} />
        <Select aria-label="What to record" value={adding.tracking} onChange={(e) => { setManualTracking(true); setAdding({ ...adding, tracking: e.target.value as Tracking }); }}>
          {TRACK_CHOICES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </Select>
        <Button disabled={!adding.name.trim()} onClick={addExercise}>Add exercise</Button>
      </section>

      <section className="mem-card" aria-label="Finish">
        {assigned && (
          <Select aria-label="How hard was it" value={rpe} onChange={(e) => setRpe(e.target.value)}>
            <option value="">How hard was it? (optional)</option>
            {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}{i === 0 ? ' · very easy' : i === 9 ? ' · all out' : ''}</option>)}
          </Select>
        )}
        <Input aria-label="Notes" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <div className="mem-error" role="alert">{error}</div>}
        {pbIssue && <div className="mem-error" role="alert">A personal best could not be saved: {pbIssue}</div>}
        <Button variant="primary" disabled={busy} onClick={() => void finish()}>{busy ? 'Saving…' : 'Finish workout'}</Button>
        <Link to="/m/train" className="btn secondary">Leave for now</Link>
      </section>
    </div>
  );
}
