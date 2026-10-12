import './shared.css';
import { Input } from '../ui/Field';
import { FIELDS, SIDES, type SetValues, type Tracking } from './calc';

/**
 * The boxes for one exercise's sets: one row per set, the boxes that kind of exercise needs. The member's logger and the
 * coach's builder both use it, so a target the coach sets lands in exactly the boxes the member fills in.
 */
export function SetGrid({ name, tracking, sets, onChange, onRemove, sided, onSide }: {
  name: string;
  tracking: Tracking;
  sets: SetValues[];
  onChange: (index: number, field: string, value: string) => void;
  onRemove: (index: number) => void;
  /** Left / right buttons under each set, for the member's logger. */
  sided?: boolean;
  onSide?: (index: number, side: string) => void;
}) {
  const fields = FIELDS[tracking];
  return (
    <div className="tr-sets">
      {sets.map((s, i) => (
        <div className="tr-set-wrap" key={i}>
          <div className="tr-set">
            <span className="muted tr-n">{i + 1}</span>
            {fields.map((f) => (
              <Input key={f.id} className="tr-box" inputMode={f.id === 'time' ? 'text' : 'decimal'} aria-label={`${name} set ${i + 1} ${f.hint}`} placeholder={f.label}
                value={s[f.id] ?? ''} onChange={(e) => onChange(i, f.id, e.target.value)} />
            ))}
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
