import { barWidth } from './calc';

/** A list of clickable bars; each opens the rows behind it. */
export function Bars({ rows, suffix = '', label, onOpen, format }: { rows: { label: string; value: number }[]; suffix?: string; label: string; onOpen: (label: string) => void; format?: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const show = (v: number) => (format ? format(v) : `${v}${suffix}`);
  return (
    <div className="bar-list" role="list" aria-label={label}>
      {rows.map((r) => (
        <div role="listitem" key={r.label}>
          <button type="button" className="bar-row" onClick={() => onOpen(r.label)} aria-label={`${r.label}: ${show(r.value)}. Show what is behind this.`}>
            <span className="bar-label">{r.label}</span>
            <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${barWidth(r.value, max)}%` }} /></span>
            <b>{show(r.value)}</b>
          </button>
        </div>
      ))}
    </div>
  );
}
