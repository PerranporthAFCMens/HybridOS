import { ColumnChart } from '../charts/ColumnChart';
import { Donut, type Slice } from '../charts/Donut';
import { LineChart } from '../charts/LineChart';
import { OTHER_COLOR, seriesColor } from '../charts/palette';
import { compact } from '../charts/scale';
import { Bars } from '../reports/Bars';
import type { Built, ChartKind } from './engine';

const MAX_CATEGORIES = 60;
type Group = Built['groups'][number];

/** The big live visual. Figures in different units cannot share a chart, so only the first kind is drawn. */
export function ChartView({ chart, built, onOpen }: { chart: ChartKind; built: Built; onOpen: (g: Group) => void }) {
  const first = built.measureTypes[0] ?? 'number';
  const idx = built.measureTypes.flatMap((t, i) => (t === first ? [i] : []));
  const scale = (n: number) => (first === 'money' ? n / 100 : n);
  const fmt = (n: number) => (first === 'money' ? `£${compact(n)}` : compact(n));
  const groups = built.groups.slice(0, MAX_CATEGORIES);
  const cats = groups.map((g) => g.label);
  const series = idx.map((i, k) => ({ name: built.measureLabels[i] ?? '', color: seriesColor(k), values: groups.map((g) => scale(g.values[i] ?? 0)) }));
  const label = built.table.title;
  const open = (i: number) => { const g = groups[i]; if (g) onOpen(g); };
  const mixed = idx.length < built.measureTypes.length;
  return (
    <>
      {mixed && <p className="muted small">Figures in different units cannot share one chart, so only the first kind is drawn. The table shows them all.</p>}
      {groups.length < built.groups.length && <p className="muted small">Showing the first {MAX_CATEGORIES} of {built.groups.length}. The table has all of them.</p>}
      {chart === 'column' && <ColumnChart label={label} categories={cats} series={series} format={fmt} height={300} onSelect={open} />}
      {chart === 'line' && <LineChart label={label} categories={cats} series={series} format={fmt} height={300} onSelect={open} />}
      {chart === 'bar' && (
        <Bars label={label} rows={groups.map((g) => ({ label: g.label, value: Math.round(scale(g.values[idx[0] ?? 0] ?? 0) * 100) / 100 }))} onOpen={(l) => { const g = groups.find((x) => x.label === l); if (g) onOpen(g); }} />
      )}
      {chart === 'donut' && <DonutView groups={groups} i={idx[0] ?? 0} scale={scale} fmt={fmt} label={label} onOpen={onOpen} />}
    </>
  );
}

function DonutView({ groups, i, scale, fmt, label, onOpen }: { groups: Group[]; i: number; scale: (n: number) => number; fmt: (n: number) => string; label: string; onOpen: (g: Group) => void }) {
  const items = groups.map((g) => ({ g, label: g.label, value: Math.max(0, scale(g.values[i] ?? 0)) })).filter((x) => x.value > 0);
  const top = items.slice(0, 7);
  const rest = items.slice(7).reduce((n, x) => n + x.value, 0);
  const slices: Slice[] = [...top.map((x, k) => ({ label: x.label, value: x.value, color: seriesColor(k) })), ...(rest > 0 ? [{ label: 'Other', value: rest, color: OTHER_COLOR }] : [])];
  const total = items.reduce((n, x) => n + x.value, 0);
  return <Donut label={label} slices={slices} centreLabel={fmt(total)} format={fmt} onSelect={(k) => { const x = top[k]; if (x) onOpen(x.g); }} />;
}
