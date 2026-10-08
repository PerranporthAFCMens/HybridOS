import { useState } from 'react';
import { ChartShell, Tooltip, type TableView } from './ChartShell';
import type { ColumnSeries } from './ColumnChart';
import { compact, labelStep, niceTicks } from './scale';
import { useWidth } from './useWidth';

const LEFT = 40;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 26;

/**
 * A trend over time. Lines are 2px; one series also gets a faint area wash; the latest point carries a
 * dot with a surface ring and its value (a direct label, kept to the end point only). A vertical hairline
 * follows the pointer to the nearest period and the readout lists every series there.
 */
export function LineChart({
  label, categories, series, format = compact, height = 200, onSelect, emptyText = 'Nothing to show for this period.',
}: {
  label: string;
  categories: string[];
  series: ColumnSeries[];
  format?: (n: number) => string;
  height?: number;
  onSelect?: (category: number) => void;
  emptyText?: string;
}) {
  const [ref, width] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const n = categories.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(40, width - LEFT - RIGHT);
  const innerH = height - TOP - BOTTOM;
  const x = (i: number) => LEFT + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => TOP + innerH - (v / top) * innerH;
  const step = labelStep(n <= 1 ? innerW : innerW / (n - 1), Math.max(...categories.map((c) => c.length), 1) * 6.2);
  const table: TableView = { headers: ['', ...series.map((s) => s.name)], rows: categories.map((c, i) => [c, ...series.map((s) => format(s.values[i] ?? 0))]) };
  const nearest = (clientX: number, el: SVGSVGElement) => {
    const px = clientX - el.getBoundingClientRect().left;
    return Math.max(0, Math.min(n - 1, Math.round(((px - LEFT) / innerW) * (n - 1))));
  };

  return (
    <ChartShell label={label} legend={series.map((s) => ({ name: s.name, color: s.color }))} table={table}>
      <div className="chart-plot" ref={ref} onPointerLeave={() => setAt(null)}>
        <svg
          width={width} height={height} role="group" aria-label={label}
          onPointerMove={(e) => setAt(nearest(e.clientX, e.currentTarget))}
          onClick={(e) => { if (onSelect) onSelect(nearest(e.clientX, e.currentTarget)); }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-axis' : 'chart-grid'} />
              <text x={LEFT - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">{compact(t)}</text>
            </g>
          ))}
          {categories.map((c, i) => (i % step === 0 ? <text key={`${c}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="chart-tick">{c}</text> : null))}
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
            const last = s.values.length - 1;
            return (
              <g key={s.name}>
                {series.length === 1 && n > 1 && <polygon points={`${x(0)},${y(0)} ${pts.join(' ')} ${x(last)},${y(0)}`} fill={s.color} opacity={0.1} />}
                {n > 1 && <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {last >= 0 && (
                  <>
                    <circle cx={x(last)} cy={y(s.values[last] ?? 0)} r={6} className="chart-ring" />
                    <circle cx={x(last)} cy={y(s.values[last] ?? 0)} r={4} fill={s.color} />
                    {si === 0 && <text x={x(last)} y={y(s.values[last] ?? 0) - 10} textAnchor="end" className="chart-end">{format(s.values[last] ?? 0)}</text>}
                  </>
                )}
              </g>
            );
          })}
          {at !== null && <line x1={x(at)} x2={x(at)} y1={TOP} y2={TOP + innerH} className="chart-cross" />}
          {at !== null && series.map((s) => <circle key={s.name} cx={x(at)} cy={y(s.values[at] ?? 0)} r={4} fill={s.color} className="chart-ring-stroke" />)}
          {max === 0 && <text x={width / 2} y={TOP + innerH / 2} textAnchor="middle" className="chart-empty">{emptyText}</text>}
          <rect x={LEFT} y={TOP} width={innerW} height={innerH + BOTTOM - 4} fill="transparent" className={onSelect ? 'chart-hit click' : 'chart-hit'} />
        </svg>
        {at !== null && <Tooltip x={x(at)} y={TOP} width={width} title={categories[at] ?? ''} rows={series.map((s) => ({ color: s.color, name: s.name, value: format(s.values[at] ?? 0) }))} />}
      </div>
    </ChartShell>
  );
}
