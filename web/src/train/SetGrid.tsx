import './shared.css';
import { Input, Select } from '../ui/Field';
import { FIELDS, SIDES, joinDuration, splitDuration, type SetValues, type Tracking } from './calc';

const HOURS = Array.from({ length: 13 }, (_, i) => i);
const SIXTY = Array.from({ length: 60 }, (_, i) => i);

/** A time is chosen, not typed: hours, minutes and seconds, so there is nothing to misread. */
function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) {
  const { h, m, s } = splitDuration(value);
  return (
    <div className="tr-time" role="group" aria-label={label}>
      <Select aria-label={`${label} hours`} value={h} onChange={(e) => onChange(joinDuration(Number(e.target.value), m, s))}>
        {HOURS.map((n) => <option key={n} value={n}>{n} hr</option>)}
      </Select>
      <Select aria-label={`${label} minutes`} value={m} onChange={(e) => onChange(joinDuration(h, Number(e.target.value), s))}>
        {SIXTY.map((n) => <option key={n} value={n}>{n} min</option>)}
      </Select>
      <Select aria-label={`${label} seconds`} value={s} onChange={(e) => onChange(joinDuration(h, m, Number(e.target.value)))}>
        {SIXTY.map((n) => <option key={n} value={n}>{n} sec</option>)}
      </Select>
    </div>
  );
}

/**
 * The boxes for one exercise's sets: one row per set, the boxes that kind of exercise needs. The member's logger and the
 * coach's builder both use it, so a target the coach sets lands in exactly the boxes the member fills in.
 */
export function SetGrid({ name, tracking, sets, onChange, onRemove, sided, onSide, percent }: {
  name: string;
  tracking: Tracking;
  sets: SetValues[];
  onChange: (index: number, field: string, value: string) => void;
  onRemove: (index: number) => void;
  /** Left / right buttons under each set, for the member's logger. */
  sided?: boolean;
  onSide?: (index: number, side: string) => void;
  /** The coach's builder: the weight box also takes a percentage of the member's best, like 80%. */
  percent?: boolean;
}) {
  const fields = FIELDS[tracking];
  return (
    <div className="tr-sets">
      {sets.map((s, i) => (
        <div className="tr-set-wrap" key={i}>
          <div className="tr-set">
            <span className="muted tr-n">{i + 1}</span>
            {fields.map((f) => {
              const pct = percent && f.id === 'weight';
              if (f.id === 'time') return <TimePicker key={f.id} label={`${name} set ${i + 1} Time`} value={s.time ?? ''} onChange={(text) => onChange(i, 'time', text)} />;
              return (
              <Input key={f.id} className="tr-box" inputMode={pct ? 'text' : 'decimal'} aria-label={`${name} set ${i + 1} ${f.hint}`} placeholder={pct ? 'kg or %' : f.label}
                value={s[f.id] ?? ''} onChange={(e) => onChange(i, f.id, e.target.value)} />
              );
            })}
            {sets.length > 1 && <button type="button" className="tr-del" aria-label={`Remove set ${i + 1} from ${name}`} onClick={() => onRemove(i)}>✕</button>}
          </div>
          {sided && onSide && (
            <div className="tr-side" role="radiogroup" aria-label={`${name} set ${i + 1} side`}>
              {SIDES.map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={s.side === v} className={`tr-side-btn${s.side === v ? ' on' : ''}`} onClick={() => onSide(i, s.side === v ? '' : v)}>{label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
