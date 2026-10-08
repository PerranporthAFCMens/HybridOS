import { useState } from 'react';
import { ChartShell, type TableView } from './ChartShell';
import { arcPath, shares, sliceAngles } from './scale';

export interface Slice { label: string; value: number; color: string }

const SIZE = 168;
const OUTER = 78;
const INNER = 52;

/**
 * Part of a whole: a ring with a 2px surface gap between slices, the total in the middle, and a key that
 * is also the list of values and shares (and is clickable, like the slices). Keep to six slices or fewer;
 * fold the tail into "Other" before calling this.
 */
export function Donut({
  label, slices, centreLabel, format = (n) => String(n), onSelect, emptyText = 'Nothing to show yet.',
}: {
  label: string;
  slices: Slice[];
  centreLabel: string;
  format?: (n: number) => string;
  onSelect?: (index: number) => void;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const pct = shares(slices.map((s) => s.value));
  const angles = sliceAngles(slices.map((s) => s.value), 2 / OUTER);
  const arcs = slices.map((s, i) => {
    const { a0, a1 } = angles[i] ?? { a0: 0, a1: 0 };
    return { i, d: s.value > 0 ? arcPath(SIZE / 2, SIZE / 2, OUTER, INNER, a0, Math.min(a1, a0 + Math.PI * 2 - 0.001)) : '' };
  });
  const table: TableView = { headers: ['', 'Value', 'Share'], rows: slices.map((s, i) => [s.label, format(s.value), `${pct[i]}%`]) };
  const centre = hover !== null && slices[hover] ? { big: format(slices[hover].value), small: slices[hover].label } : { big: format(total), small: centreLabel };

  return (
    <ChartShell label={label} legend={[]} table={table}>
      {total === 0 ? <p className="chart-empty-note">{emptyText}</p> : (
        <div className="donut">
          <svg width={SIZE} height={SIZE} role="group" aria-label={label} className="donut-svg">
            {arcs.map((x) => x.d && (
              <path
                key={x.i} d={x.d} fill={slices[x.i]?.color} className={hover === x.i ? 'chart-mark lift' : 'chart-mark'}
                onPointerEnter={() => setHover(x.i)} onPointerLeave={() => setHover(null)} onClick={() => onSelect?.(x.i)}
                style={{ cursor: onSelect ? 'pointer' : undefined }}
              />
            ))}
            <text x={SIZE / 2} y={SIZE / 2 - 2} textAnchor="middle" className="donut-big">{centre.big}</text>
            <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="chart-tick">{centre.small.length > 18 ? `${centre.small.slice(0, 17)}…` : centre.small}</text>
          </svg>
          <ul className="donut-key">
            {slices.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button" className="donut-row" disabled={!onSelect} onClick={() => onSelect?.(i)}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${s.label}: ${format(s.value)}, ${pct[i]}%${onSelect ? '. Show the rows.' : ''}`}
                >
                  <span className="chart-swatch" style={{ background: s.color }} aria-hidden="true" />
                  <span className="donut-name">{s.label}</span>
                  <b>{format(s.value)}</b>
                  <span className="donut-pct">{pct[i]}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartShell>
  );
}
