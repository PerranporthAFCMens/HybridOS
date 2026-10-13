import { SCORE_KINDS } from '../train/calc';
import { Field, Input, Select } from '../ui/Field';

/**
 * An exercise scored two ways (an AMRAP in rounds and reps, a for-time in time and reps...). The coach names each score and says what
 * kind of number it is; the member gets one box per score. The two must be different kinds.
 */
export function ScoresEditor({ name, scores, onChange }: { name: string; scores: { name: string; kind: string }[]; onChange: (scores: { name: string; kind: string }[]) => void }) {
  const two = [scores[0] ?? { name: '', kind: 'rounds' }, scores[1] ?? { name: '', kind: 'reps' }];
  const set = (i: number, patch: Partial<{ name: string; kind: string }>) => onChange(two.map((sc, j) => (j === i ? { ...sc, ...patch } : sc)));
  return (
    <div className="wk-scores" role="group" aria-label={`${name} scores`}>
      <div className="muted small">The member records two scores for this exercise, one box each. Name them and say what kind of number each is.</div>
      {two.map((sc, i) => (
        <div className="wk-score-row" key={i}>
          <Field label={`Score ${i + 1} name`} htmlFor={`${name}-sc${i}-n`}><Input id={`${name}-sc${i}-n`} maxLength={40} placeholder={i === 0 ? 'Rounds' : 'Reps'} value={sc.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
          <Field label={`Score ${i + 1} kind`} htmlFor={`${name}-sc${i}-k`}>
            <Select id={`${name}-sc${i}-k`} value={sc.kind} onChange={(e) => set(i, { kind: e.target.value })}>
              {SCORE_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
        </div>
      ))}
    </div>
  );
}
