// The report builder's engine: given a dataset (flat rows with typed fields) and a "spec" (what the owner chose),
// work out the table and the chart series. Pure functions, no database. The owner can only pick from the fields
// each dataset offers, so nothing here ever runs anything the owner typed.
import { ukDate } from '../reports/calc';
import { pounds } from '../reports/library';
import type { Cell, ReportTable } from '../reports/download';

export type FieldType = 'text' | 'number' | 'money' | 'date';
export interface Field { id: string; label: string; type: FieldType; /** Personal details: shown with a note, owner and admin only. */ sensitive?: boolean }
export type Row = Record<string, string | number | null>;

export type Fn = 'count' | 'distinct' | 'sum' | 'avg' | 'min' | 'max';
export const FN_LABEL: Record<Fn, string> = { count: 'Count of rows', distinct: 'Different values', sum: 'Total', avg: 'Average', min: 'Lowest', max: 'Highest' };

export interface Measure { fn: Fn; field: string | null }
export type Op = 'is' | 'is_not' | 'contains' | 'eq' | 'gt' | 'lt' | 'on_or_after' | 'on_or_before' | 'blank' | 'not_blank';
export interface Filter { field: string; op: Op; value: string }
export type ChartKind = 'table' | 'column' | 'bar' | 'line' | 'donut';
export type DateBy = 'day' | 'month';

export interface Spec {
  dataset: string;
  mode: 'list' | 'summary';
  /** List mode: the columns to show, in order. */
  columns: string[];
  /** Summary mode: what to group by, and how to group dates. */
  groupBy: string | null;
  dateBy: DateBy;
  measures: Measure[];
  filters: Filter[];
  chart: ChartKind;
}

export const OPS_FOR: Record<FieldType, [Op, string][]> = {
  text: [['is', 'is'], ['is_not', 'is not'], ['contains', 'contains'], ['blank', 'is empty'], ['not_blank', 'is not empty']],
  number: [['eq', 'equals'], ['gt', 'is more than'], ['lt', 'is less than'], ['blank', 'is empty'], ['not_blank', 'is not empty']],
  money: [['eq', 'equals'], ['gt', 'is more than'], ['lt', 'is less than'], ['blank', 'is empty'], ['not_blank', 'is not empty']],
  date: [['on_or_after', 'is on or after'], ['on_or_before', 'is on or before'], ['blank', 'is empty'], ['not_blank', 'is not empty']],
};
export const needsValue = (op: Op) => op !== 'blank' && op !== 'not_blank';

export const isNumeric = (t: FieldType) => t === 'number' || t === 'money';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
};

/** Money typed in pounds ("12.50") to pence; null when it is not a number. */
export function poundsToPence(text: string): number | null {
  const n = Number(text.replace(/[£,\s]/g, ''));
  return text.trim() !== '' && Number.isFinite(n) ? Math.round(n * 100) : null;
}

const norm = (v: string | number | null) => (v === null ? '' : String(v)).trim().toLowerCase();

/** Does a row pass one filter? A filter with a value that cannot be read passes everything (the screen warns instead). */
export function passes(row: Row, f: Filter, field: Field | undefined): boolean {
  if (!field) return true;
  const v = row[f.field] ?? null;
  if (f.op === 'blank') return v === null || v === '';
  if (f.op === 'not_blank') return !(v === null || v === '');
  if (field.type === 'text') {
    if (f.op === 'is') return norm(v) === f.value.trim().toLowerCase();
    if (f.op === 'is_not') return norm(v) !== f.value.trim().toLowerCase();
    if (f.op === 'contains') return norm(v).includes(f.value.trim().toLowerCase());
    return true;
  }
  if (field.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.value)) return true;
    if (v === null || v === '') return false;
    return f.op === 'on_or_after' ? String(v) >= f.value : f.op === 'on_or_before' ? String(v) <= f.value : true;
  }
  const target = field.type === 'money' ? poundsToPence(f.value) : f.value.trim() === '' ? null : Number(f.value);
  if (target === null || !Number.isFinite(target)) return true;
  if (typeof v !== 'number') return false;
  return f.op === 'eq' ? v === target : f.op === 'gt' ? v > target : f.op === 'lt' ? v < target : true;
}

export function applyFilters(rows: Row[], filters: Filter[], fields: Field[]): Row[] {
  const byId = new Map(fields.map((f) => [f.id, f]));
  return rows.filter((r) => filters.every((f) => passes(r, f, byId.get(f.field))));
}

/** A cell as the owner reads it. */
export function show(value: string | number | null, type: FieldType): Cell {
  if (value === null || value === '') return '';
  if (type === 'money') return typeof value === 'number' ? pounds(value) : value;
  if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? ukDate(`${value}T12:00:00Z`) : String(value);
  return value;
}

export interface Built {
  table: ReportTable;
  /** Chart-ready groups (summary mode with at least one measure). `key` is what was grouped on (so a bar can be opened). */
  groups: { key: string; label: string; values: number[] }[];
  /** Each figure worked out over all the rows that passed the filters (the big headline numbers). */
  totals: number[];
  measureLabels: string[];
  measureTypes: FieldType[];
  /** How many rows passed the filters. */
  rowCount: number;
}

export const measureLabel = (m: Measure, fields: Field[]) => {
  if (m.fn === 'count') return 'Number of rows';
  const f = fields.find((x) => x.id === m.field);
  return `${FN_LABEL[m.fn]} of ${f?.label ?? '?'}`;
};

function groupKey(row: Row, field: Field, by: DateBy): string {
  const v = row[field.id];
  if (v === null || v === undefined || v === '') return '';
  if (field.type === 'date') return by === 'month' ? String(v).slice(0, 7) : String(v);
  return String(v);
}

function groupLabel(key: string, field: Field, by: DateBy): string {
  if (key === '') return 'Not set';
  if (field.type === 'date') return by === 'month' ? monthLabel(key) : (show(key, 'date') as string);
  return key;
}

function measure(rows: Row[], m: Measure): number {
  if (m.fn === 'count' || !m.field) return rows.length;
  if (m.fn === 'distinct') {
    const f = m.field;
    return new Set(rows.map((r) => r[f]).filter((v) => v !== null && v !== undefined && v !== '').map(String)).size;
  }
  const nums = rows.map((r) => r[m.field as string]).filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return m.fn === 'sum' ? sum : m.fn === 'avg' ? sum / nums.length : m.fn === 'min' ? Math.min(...nums) : Math.max(...nums);
}

/** Turns what the owner chose into a table (and the groups a chart can draw). */
export function build(spec: Spec, allRows: Row[], fields: Field[], title: string, subtitle: string): Built {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const rows = applyFilters(allRows, spec.filters, fields);

  if (spec.mode === 'list') {
    const cols = spec.columns.map((c) => byId.get(c)).filter((f): f is Field => !!f);
    return {
      table: { title, subtitle, headers: cols.map((c) => c.label), rows: rows.map((r) => cols.map((c) => show(r[c.id] ?? null, c.type))) },
      groups: [], totals: [], measureLabels: [], measureTypes: [], rowCount: rows.length,
    };
  }

  const ms = spec.measures.length ? spec.measures : [{ fn: 'count' as Fn, field: null }];
  const gf = spec.groupBy ? byId.get(spec.groupBy) : undefined;
  const mtype = (m: Measure): FieldType => (m.fn === 'count' || m.fn === 'distinct' ? 'number' : byId.get(m.field ?? '')?.type ?? 'number');
  const labels = ms.map((m) => measureLabel(m, fields));
  const types = ms.map(mtype);
  const cell = (n: number, t: FieldType): Cell => (t === 'money' ? pounds(Math.round(n)) : Math.round(n * 100) / 100);

  if (!gf) {
    const values = ms.map((m) => measure(rows, m));
    return { table: { title, subtitle, headers: labels, rows: [values.map((v, i) => cell(v, types[i] ?? 'number'))] }, groups: [{ key: '', label: 'All rows', values }], totals: values, measureLabels: labels, measureTypes: types, rowCount: rows.length };
  }

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r, gf, spec.dateBy);
    buckets.set(k, [...(buckets.get(k) ?? []), r]);
  }
  let keys = [...buckets.keys()];
  // Dates run oldest to newest; everything else by the first measure, biggest first.
  if (gf.type === 'date') keys = keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  else keys = keys.sort((a, b) => measure(buckets.get(b) ?? [], ms[0] as Measure) - measure(buckets.get(a) ?? [], ms[0] as Measure) || (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  const groups = keys.map((k) => ({ key: k, label: groupLabel(k, gf, spec.dateBy), values: ms.map((m) => measure(buckets.get(k) ?? [], m)) }));
  return {
    table: { title, subtitle, headers: [gf.label, ...labels], rows: groups.map((g) => [g.label, ...g.values.map((v, i) => cell(v, types[i] ?? 'number'))]) },
    groups, totals: ms.map((m) => measure(rows, m)), measureLabels: labels, measureTypes: types, rowCount: rows.length,
  };
}

/** Which chart kinds make sense for this spec. */
export function chartsAllowed(spec: Spec): ChartKind[] {
  if (spec.mode === 'list' || !spec.groupBy) return ['table'];
  const kinds: ChartKind[] = ['table', 'column', 'bar'];
  const field = spec.groupBy;
  if (field) kinds.push('line');
  if (spec.measures.length <= 1) kinds.push('donut');
  return kinds;
}

export function defaultSpec(dataset: string, fields: Field[]): Spec {
  return {
    dataset, mode: 'list', columns: fields.slice(0, 5).map((f) => f.id), groupBy: null, dateBy: 'month',
    measures: [{ fn: 'count', field: null }], filters: [], chart: 'table',
  };
}

/** A saved spec read back safely: anything that no longer exists is dropped. */
export function sanitise(raw: unknown, datasets: { id: string; fields: Field[] }[]): Spec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Spec>;
  const ds = datasets.find((d) => d.id === r.dataset);
  if (!ds) return null;
  const ids = new Set(ds.fields.map((f) => f.id));
  const base = defaultSpec(ds.id, ds.fields);
  const columns = Array.isArray(r.columns) ? r.columns.filter((c): c is string => typeof c === 'string' && ids.has(c)) : base.columns;
  const fns: Fn[] = ['count', 'distinct', 'sum', 'avg', 'min', 'max'];
  const measures = Array.isArray(r.measures)
    ? r.measures.filter((m): m is Measure => !!m && fns.includes(m.fn) && (m.fn === 'count' || (typeof m.field === 'string' && ids.has(m.field))))
    : base.measures;
  const filters = Array.isArray(r.filters) ? r.filters.filter((f): f is Filter => !!f && typeof f.field === 'string' && ids.has(f.field) && typeof f.value === 'string' && typeof f.op === 'string') : [];
  const charts: ChartKind[] = ['table', 'column', 'bar', 'line', 'donut'];
  return {
    dataset: ds.id,
    mode: r.mode === 'summary' ? 'summary' : 'list',
    columns: columns.length ? columns : base.columns,
    groupBy: typeof r.groupBy === 'string' && ids.has(r.groupBy) ? r.groupBy : null,
    dateBy: r.dateBy === 'day' ? 'day' : 'month',
    measures: measures.length ? measures : base.measures,
    filters,
    chart: charts.includes(r.chart as ChartKind) ? (r.chart as ChartKind) : 'table',
  };
}

/** The rows (after the filters) that fall in one group of a summary: what is behind a bar. */
export function rowsInGroup(spec: Spec, allRows: Row[], fields: Field[], key: string): Row[] {
  const gf = fields.find((f) => f.id === spec.groupBy);
  const rows = applyFilters(allRows, spec.filters, fields);
  return gf ? rows.filter((r) => groupKey(r, gf, spec.dateBy) === key) : rows;
}

function lastDayOfMonth(key: string): string {
  const [y = 0, m = 1] = key.split('-').map(Number);
  return `${key}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** The filters that narrow a whole report down to one group (what "filter the report to this" adds). */
export function filtersForGroup(field: Field, dateBy: DateBy, key: string): Filter[] {
  if (key === '') return [{ field: field.id, op: 'blank', value: '' }];
  if (field.type === 'date') {
    return dateBy === 'month'
      ? [{ field: field.id, op: 'on_or_after', value: `${key}-01` }, { field: field.id, op: 'on_or_before', value: lastDayOfMonth(key) }]
      : [{ field: field.id, op: 'on_or_after', value: key }, { field: field.id, op: 'on_or_before', value: key }];
  }
  if (field.type === 'text') return [{ field: field.id, op: 'is', value: key }];
  return [{ field: field.id, op: 'eq', value: field.type === 'money' ? String(Number(key) / 100) : key }];
}
