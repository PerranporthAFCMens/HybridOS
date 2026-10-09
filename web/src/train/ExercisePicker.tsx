import { useState } from 'react';
import { Input } from '../ui/Field';
import { matchExercises } from './activities';

/** A name box that offers exercises as you type: yours first, then the gym's list. Tap one to fill the box. */
export function ExercisePicker({ value, onChange, onPick, own, label, placeholder }: { value: string; onChange: (v: string) => void; onPick: (name: string) => void; own: string[]; label: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const options = open ? matchExercises(value, own).filter((n) => n.toLowerCase() !== value.trim().toLowerCase()) : [];
  return (
    <div className="tr-pick">
      <Input aria-label={label} placeholder={placeholder} autoComplete="off" value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }} />
      {options.length > 0 && (
        <div className="tr-menu" role="listbox" aria-label={`${label} suggestions`}>
          {options.map((n) => (
            <button key={n} type="button" role="option" aria-selected="false" className="tr-option" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(n); setOpen(false); }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}
