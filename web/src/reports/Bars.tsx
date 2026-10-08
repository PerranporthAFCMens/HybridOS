import { barWidth } from './calc';

/** A list of clickable bars; each opens the rows behind it. */
export function Bars({ rows, suffix = '', label, onOpen }: { rows: { label: string; value: number }[]; suffix?: string; label: string; onOpen: (label: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bar-list" role="list" aria-label={label}>
      {rows.map((r) => (
        <div role="listitem" key={r.label}>
          <button type="button" className="bar-row" onClick={() => onOpen(r.label)} aria-label={`${r.label}: ${r.value}${suffix}. Show what is behind this.`}>
            <span className="bar-label">{r.label}</span>
            <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${barWidth(r.value, max)}%` }} /></span>
            <b>{r.value}{suffix}</b>
          </button>
        </div>
      ))}
    </div>
  );
}
