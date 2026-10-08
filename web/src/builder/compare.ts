import type { Built } from './engine';

/**
 * Two runs of the same report (this period and the one to compare with) as one, so a chart can draw both.
 * Groups are matched by position when the report is by date (month 1 against month 1) and by name otherwise.
 */
export function mergeBuilt(a: Built, b: Built, labelA: string, labelB: string, byDate: boolean): Built {
  const n = a.measureLabels.length;
  const keys: { key: string; label: string; a: number; b: number }[] = [];
  if (byDate) {
    const len = Math.max(a.groups.length, b.groups.length);
    for (let i = 0; i < len; i++) keys.push({ key: a.groups[i]?.key ?? `b${i}`, label: a.groups[i]?.label ?? b.groups[i]?.label ?? '', a: i, b: i });
  } else {
    const seen = new Set<string>();
    for (const g of a.groups) { seen.add(g.key); keys.push({ key: g.key, label: g.label, a: a.groups.findIndex((x) => x.key === g.key), b: b.groups.findIndex((x) => x.key === g.key) }); }
    for (const g of b.groups) if (!seen.has(g.key)) keys.push({ key: g.key, label: g.label, a: -1, b: b.groups.findIndex((x) => x.key === g.key) });
  }
  const groups = keys.map((k) => ({
    key: k.key,
    label: k.label,
    values: [...Array.from({ length: n }, (_, i) => a.groups[k.a]?.values[i] ?? 0), ...Array.from({ length: n }, (_, i) => b.groups[k.b]?.values[i] ?? 0)],
  }));
  const measureLabels = [...a.measureLabels.map((l) => `${l} (${labelA})`), ...b.measureLabels.map((l) => `${l} (${labelB})`)];
  const measureTypes = [...a.measureTypes, ...b.measureTypes];
  const cell = (v: number, t: string) => (t === 'money' ? '£' + (Math.round(v) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v * 100) / 100);
  return {
    table: {
      ...a.table,
      headers: [a.table.headers[0] ?? '', ...measureLabels],
      rows: groups.map((g) => [g.label, ...g.values.map((v, i) => cell(v, measureTypes[i] ?? 'number'))]),
    },
    groups,
    totals: [...a.totals, ...b.totals],
    measureLabels,
    measureTypes,
    rowCount: a.rowCount,
  };
}
