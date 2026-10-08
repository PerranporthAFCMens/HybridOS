import { useState } from 'react';
import { ChartShell, Tooltip, type TableView } from './ChartShell';
import { compact, labelStep, niceTicks, roundedTop } from './scale';
import { useWidth } from './useWidth';

export interface ColumnSeries { name: string; color: string; values: number[] }

const LEFT = 40;
const RIGHT = 8;
const TOP = 22;
const BOTTOM = 26;
const GAP = 2;
const MAX_THICK = 24;

/**
 * Columns for a measure over categories (usually periods). Stacked (parts of a whole) or grouped (side by
 * side). Thin columns grown from one baseline, 4px rounded at the data end, a 2px surface gap between
 * touching marks, hairline grid. Hover or focus shows every series at that category; click or Enter
 * opens the rows behind it.
 */
export function ColumnChart({
  label, categories, series, stacked = false, format = compact, height = 200, onSelect, emptyText = 'Nothing to show for this period.', maxThick = MAX_THICK, valueLabels = false,
}: {
  label: string;
  categories: string[];
  series: ColumnSeries[];
  stacked?: boolean;
  format?: (n: number) => string;
  height?: number;
  onSelect?: (category: number) => void;
  emptyText?: string;
  /** Widest a column may be (default 24). */
  maxThick?: number;
  /** Write each figure above its column when there is one series and room for it. */
  valueLabels?: boolean;
}) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState<{ i: number; x: number } | null>(null);
  const n = categories.length;
  const totals = categories.map((_, i) => (stacked ? series.reduce((s, x) => s + (x.values[i] ?? 0), 0) : Math.max(0, ...series.map((x) => x.values[i] ?? 0))));
  const max = Math.max(0, ...totals);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(40, width - LEFT - RIGHT);
  const innerH = height - TOP - BOTTOM;
  const slot = innerW / Math.max(1, n);
  const y = (v: number) => TOP + innerH - (v / top) * innerH;
  const k = series.length;
  const thick = stacked ? Math.min(maxThick, slot * 0.6) : Math.min(maxThick, (slot * 0.7 - GAP * (k - 1)) / k);
  const labelled = valueLabels && !stacked && k === 1 && n <= 14 && slot >= 44;
  const groupW = stacked ? thick : thick * k + GAP * (k - 1);
  const step = labelStep(slot, Math.max(...categories.map((c) => c.length), 1) * 6.2);
  const table: TableView = { headers: ['', ...series.map((s) => s.name)], rows: categories.map((c, i) => [c, ...series.map((s) => format(s.values[i] ?? 0))]) };

  const show = (i: number) => setTip({ i, x: LEFT + slot * i + slot / 2 });
  const rows = (i: number) => series.map((s) => ({ color: s.color, name: s.name, value: format(s.values[i] ?? 0) }));
  const describe = (i: number) => `${categories[i]}: ${series.map((s) => `${s.name} ${format(s.values[i] ?? 0)}`).join(', ')}${onSelect ? '. Show the rows.' : ''}`;

  return (
    <ChartShell label={label} legend={series.map((s) => ({ name: s.name, color: s.color }))} table={table}>
      <div className="chart-plot" ref={ref} onPointerLeave={() => setTip(null)}>
        <svg width={width} height={height} role="group" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-axis' : 'chart-grid'} />
              <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">{compact(t)}</text>
            </g>
          ))}
          {categories.map((c, i) => {
            const cx = LEFT + slot * i + slot / 2;
            const x0 = cx - groupW / 2;
            let acc = 0;
            return (
              <g key={`${c}-${i}`}>
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v <= 0) return null;
                  if (stacked) {
                    const yTop = y(acc + v);
                    const yBase = y(acc);
                    const isTop = !series.slice(si + 1).some((o) => (o.values[i] ?? 0) > 0);
                    const h = Math.max(1, yBase - yTop - (acc > 0 ? GAP : 0));
                    acc += v;
                    return isTop
                      ? <path key={s.name} d={roundedTop(x0, yTop, thick, h, 4)} fill={s.color} className={tip?.i === i ? 'chart-mark lift' : 'chart-mark'} />
                      : <rect key={s.name} x={x0} y={yTop} width={thick} height={h} fill={s.color} className={tip?.i === i ? 'chart-mark lift' : 'chart-mark'} />;
                  }
                  const xs = x0 + si * (thick + GAP);
                  const h = Math.max(1, y(0) - y(v));
                  return (
                    <g key={s.name}>
                      <path d={roundedTop(xs, y(v), thick, h, 4)} fill={s.color} className={tip?.i === i ? 'chart-mark lift' : 'chart-mark'} />
                      {labelled && <text x={xs + thick / 2} y={y(v) - 6} textAnchor="middle" className="chart-end">{format(v)}</text>}
                    </g>
                  );
                })}
                {i % step === 0 && <text x={cx} y={height - 8} textAnchor="middle" className="chart-tick">{c}</text>}
              </g>
            );
          })}
          {max === 0 && <text x={width / 2} y={TOP + innerH / 2} textAnchor="middle" className="chart-empty">{emptyText}</text>}
          {categories.map((c, i) => (
            <rect
              key={`hit-${c}-${i}`}
              x={LEFT + slot * i} y={TOP} width={slot} height={innerH + BOTTOM - 4}
              fill="transparent" className={onSelect ? 'chart-hit click' : 'chart-hit'}
              tabIndex={0} role={onSelect ? 'button' : 'img'} aria-label={describe(i)}
              onPointerEnter={() => show(i)} onPointerMove={() => show(i)} onFocus={() => show(i)} onBlur={() => setTip(null)}
              onClick={() => onSelect?.(i)}
              onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(i); } }}
            />
          ))}
        </svg>
        {tip && <Tooltip x={tip.x} y={TOP} width={width} title={categories[tip.i] ?? ''} rows={rows(tip.i)} />}
      </div>
    </ChartShell>
  );
}
