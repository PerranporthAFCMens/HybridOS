import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { ColumnChart } from '../charts/ColumnChart';
import { Donut, type Slice } from '../charts/Donut';
import { LineChart } from '../charts/LineChart';
import { OTHER_COLOR, seriesColor } from '../charts/palette';
import { compact } from '../charts/scale';
import type { LibraryData } from '../data/reportLibrary';
import { Bars } from '../reports/Bars';
import { DataTable } from '../reports/DataTable';
import { downloadTable, fileBase, type Format } from '../reports/download';
import { Button } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { DateInput, Field, Input, Select } from '../ui/Field';
import { DATASETS } from './datasets';
import { FN_LABEL, OPS_FOR, build, chartsAllowed, defaultSpec, isNumeric, needsValue, sanitise, type ChartKind, type Filter, type Fn, type Measure, type Op, type Spec } from './engine';
import { loadSaved, storeSaved, type SavedReport } from './saved';
import '../reports/paper.css';
import '../charts/charts.css';
import './builder.css';

const FORMATS: { id: Format; label: string; ext: string }[] = [{ id: 'csv', label: 'CSV', ext: 'csv' }, { id: 'xlsx', label: 'Excel', ext: 'xlsx' }, { id: 'pdf', label: 'PDF', ext: 'pdf' }];
const CHART_LABEL: Record<ChartKind, string> = { table: 'Table', column: 'Columns', bar: 'Bars', line: 'Line', donut: 'Ring' };
export const BUILDER_PAPER_ROWS = 25;
const MAX_CATEGORIES = 60;

/**
 * Build your own report: choose what to look at, the columns or the figures, split it by something, filter it,
 * pick a chart, see it on paper and download it. Choices are limited to the fields each dataset offers.
 */
export function Builder({ data, rangeLabel }: { data: LibraryData; rangeLabel: string }) {
  const { gym } = useReadyAuth();
  const first = DATASETS[0];
  const [spec, setSpec] = useState<Spec>(() => defaultSpec(first?.id ?? '', first?.fields ?? []));
  const [format, setFormat] = useState<Format>('xlsx');
  const [saved, setSaved] = useState<SavedReport[]>(() => loadSaved(gym.gymId, DATASETS));
  const [name, setName] = useState('');
  const [pickSaved, setPickSaved] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const ds = DATASETS.find((d) => d.id === spec.dataset) ?? DATASETS[0];
  const fields = useMemo(() => ds?.fields ?? [], [ds]);
  const rows = useMemo(() => (ds ? ds.rows(data, new Date()) : []), [ds, data]);
  const title = ds ? `${ds.label}${spec.mode === 'summary' ? ': summary' : ''}` : 'Report';
  const subtitle = `${gym.gymName} · ${rangeLabel}${spec.filters.length ? ` · ${spec.filters.length} ${spec.filters.length === 1 ? 'filter' : 'filters'}` : ''}`;
  const built = useMemo(() => build(spec, rows, fields, title, subtitle), [spec, rows, fields, title, subtitle]);
  const allowed = chartsAllowed(spec);
  const chart = allowed.includes(spec.chart) ? spec.chart : 'table';
  const change = (patch: Partial<Spec>) => { setNote(null); setSpec((s) => ({ ...s, ...patch })); };
  const byId = new Map(fields.map((f) => [f.id, f]));
  const numericFields = fields.filter((f) => isNumeric(f.type));
  const chosen = FORMATS.find((f) => f.id === format) ?? FORMATS[0];

  const setDataset = (id: string) => { const d = DATASETS.find((x) => x.id === id); if (d) { setNote(null); setSpec(defaultSpec(d.id, d.fields)); } };
  const move = (i: number, by: -1 | 1) => { const c = spec.columns.slice(); const j = i + by; const a = c[i]; const b = c[j]; if (a === undefined || b === undefined) return; c[i] = b; c[j] = a; change({ columns: c }); };
  const setMeasure = (i: number, patch: Partial<Measure>) => change({ measures: spec.measures.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const setFilter = (i: number, patch: Partial<Filter>) => change({ filters: spec.filters.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const addFilter = () => { const f = fields[0]; if (f) change({ filters: [...spec.filters, { field: f.id, op: (OPS_FOR[f.type][0]?.[0] ?? 'is') as Op, value: '' }] }); };
  const groupField = spec.groupBy ? byId.get(spec.groupBy) : undefined;

  const doDownload = async () => {
    setBusy(true);
    setNote(null);
    try {
      await downloadTable(built.table, format, fileBase(gym.gymName, built.table.title, new Date()));
      setNote({ text: `Downloaded ${built.table.rows.length} ${built.table.rows.length === 1 ? 'row' : 'rows'} as ${chosen?.label ?? format}. Charts are not part of the file.`, good: true });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'The download failed. Please try again.', good: false });
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const n = name.trim();
    if (!n) return setNote({ text: 'Give the report a name to save it.', good: false });
    const next = [...saved.filter((s) => s.name.toLowerCase() !== n.toLowerCase()), { name: n, spec }];
    setSaved(next);
    storeSaved(gym.gymId, next);
    setPickSaved(n);
    setNote({ text: `Saved "${n}" on this device.`, good: true });
  };
  const loadOne = (n: string) => {
    setPickSaved(n);
    const s = saved.find((x) => x.name === n);
    const ok = s ? sanitise(s.spec, DATASETS) : null;
    if (ok) { setSpec(ok); setName(n); setNote(null); }
  };
  const removeOne = () => {
    const next = saved.filter((s) => s.name !== pickSaved);
    setSaved(next);
    storeSaved(gym.gymId, next);
    setPickSaved('');
    setNote({ text: 'Saved report removed from this device.', good: true });
  };

  return (
    <div className="bld-grid">
      <Card className="bld-controls">
        <SectionTitle title="Report builder" />
        {saved.length > 0 && (
          <Field label="My saved reports" htmlFor="bld-saved">
            <div className="bld-row">
              <Select id="bld-saved" value={pickSaved} onChange={(e) => loadOne(e.target.value)}>
                <option value="">Choose one…</option>
                {saved.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </Select>
              {pickSaved && <Button onClick={removeOne}>Remove</Button>}
            </div>
          </Field>
        )}

        <Field label="What do you want to look at?" htmlFor="bld-dataset" hint={ds?.description}>
          <Select id="bld-dataset" value={spec.dataset} onChange={(e) => setDataset(e.target.value)}>
            {DATASETS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </Field>

        <div className="paper-field" role="radiogroup" aria-label="How to show it">
          <div className="paper-label">How to show it</div>
          <div className="bld-seg">
            {([['list', 'List the rows'], ['summary', 'Summarise (group and count)']] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={spec.mode === id} className={`format-pick${spec.mode === id ? ' on' : ''}`} onClick={() => change({ mode: id, chart: id === 'list' ? 'table' : spec.chart })}>
                <b>{label}</b>
              </button>
            ))}
          </div>
        </div>

        {spec.mode === 'list' ? (
          <div className="bld-section">
            <div className="paper-label">Columns</div>
            <ol className="bld-cols">
              {spec.columns.map((c, i) => (
                <li key={c}>
                  <span>{byId.get(c)?.label}{byId.get(c)?.sensitive && <span className="tag warn bld-tag">personal</span>}</span>
                  <span className="bld-move">
                    <Button aria-label={`Move ${byId.get(c)?.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>Up</Button>
                    <Button aria-label={`Move ${byId.get(c)?.label} down`} disabled={i === spec.columns.length - 1} onClick={() => move(i, 1)}>Down</Button>
                    <Button aria-label={`Remove column ${byId.get(c)?.label}`} disabled={spec.columns.length === 1} onClick={() => change({ columns: spec.columns.filter((x) => x !== c) })}>Remove</Button>
                  </span>
                </li>
              ))}
            </ol>
            {fields.some((f) => !spec.columns.includes(f.id)) && (
              <Select aria-label="Add a column" value="" onChange={(e) => { if (e.target.value) change({ columns: [...spec.columns, e.target.value] }); }}>
                <option value="">Add a column…</option>
                {fields.filter((f) => !spec.columns.includes(f.id)).map((f) => <option key={f.id} value={f.id}>{f.label}{f.sensitive ? ' (personal)' : ''}</option>)}
              </Select>
            )}
          </div>
        ) : (
          <>
            <div className="bld-section">
              <Field label="Group by" htmlFor="bld-group">
                <Select id="bld-group" value={spec.groupBy ?? ''} onChange={(e) => change({ groupBy: e.target.value || null })}>
                  <option value="">Nothing (one total row)</option>
                  {fields.map((f) => <option key={f.id} value={f.id}>{f.label}{f.sensitive ? ' (personal)' : ''}</option>)}
                </Select>
              </Field>
              {groupField?.type === 'date' && (
                <Field label="Group dates by" htmlFor="bld-dateby">
                  <Select id="bld-dateby" value={spec.dateBy} onChange={(e) => change({ dateBy: e.target.value === 'day' ? 'day' : 'month' })}>
                    <option value="month">Month</option>
                    <option value="day">Day</option>
                  </Select>
                </Field>
              )}
            </div>
            <div className="bld-section">
              <div className="paper-label">Show</div>
              {spec.measures.map((m, i) => (
                <div className="bld-row bld-measure" key={i}>
                  <Select aria-label={`Figure ${i + 1}: what to work out`} value={m.fn} onChange={(e) => setMeasure(i, { fn: e.target.value as Fn, field: e.target.value === 'count' ? null : m.field ?? numericFields[0]?.id ?? null })}>
                    {(Object.keys(FN_LABEL) as Fn[]).filter((fn) => fn === 'count' || numericFields.length > 0).map((fn) => <option key={fn} value={fn}>{FN_LABEL[fn]}</option>)}
                  </Select>
                  {m.fn !== 'count' && (
                    <Select aria-label={`Figure ${i + 1}: of which field`} value={m.field ?? ''} onChange={(e) => setMeasure(i, { field: e.target.value })}>
                      {numericFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </Select>
                  )}
                  <Button aria-label={`Remove figure ${i + 1}`} disabled={spec.measures.length === 1} onClick={() => change({ measures: spec.measures.filter((_, k) => k !== i) })}>Remove</Button>
                </div>
              ))}
              {spec.measures.length < 4 && numericFields.length > 0 && (
                <Button onClick={() => change({ measures: [...spec.measures, { fn: 'sum', field: numericFields[0]?.id ?? null }] })}>Add a figure</Button>
              )}
            </div>
          </>
        )}

        <div className="bld-section">
          <div className="paper-label">Only include rows where…</div>
          {spec.filters.map((f, i) => {
            const field = byId.get(f.field);
            const ops = OPS_FOR[field?.type ?? 'text'];
            return (
              <div className="bld-filter" key={i}>
                <Select aria-label={`Filter ${i + 1}: field`} value={f.field} onChange={(e) => { const nf = byId.get(e.target.value); setFilter(i, { field: e.target.value, op: (OPS_FOR[nf?.type ?? 'text'][0]?.[0] ?? 'is') as Op, value: '' }); }}>
                  {fields.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </Select>
                <Select aria-label={`Filter ${i + 1}: condition`} value={f.op} onChange={(e) => setFilter(i, { op: e.target.value as Op })}>
                  {ops.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </Select>
                {needsValue(f.op) && (field?.type === 'date'
                  ? <DateInput aria-label={`Filter ${i + 1}: value`} value={f.value} onChange={(e) => setFilter(i, { value: e.target.value })} />
                  : <Input aria-label={`Filter ${i + 1}: value`} value={f.value} inputMode={field && isNumeric(field.type) ? 'decimal' : 'text'} placeholder={field?.type === 'money' ? 'Pounds, e.g. 12.50' : ''} onChange={(e) => setFilter(i, { value: e.target.value })} />)}
                <Button aria-label={`Remove filter ${i + 1}`} onClick={() => change({ filters: spec.filters.filter((_, k) => k !== i) })}>Remove</Button>
              </div>
            );
          })}
          <Button onClick={addFilter}>Add a filter</Button>
        </div>

        {allowed.length > 1 && (
          <div className="paper-field" role="radiogroup" aria-label="Chart">
            <div className="paper-label">Show as</div>
            <div className="bld-charts">
              {allowed.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={chart === k} className={`format-pick${chart === k ? ' on' : ''}`} onClick={() => change({ chart: k })}><b>{CHART_LABEL[k]}</b></button>
              ))}
            </div>
          </div>
        )}

        <div className="bld-section">
          <Field label="Save this report" htmlFor="bld-name" hint="Saved on this device only.">
            <div className="bld-row"><Input id="bld-name" placeholder="e.g. Monthly income" value={name} onChange={(e) => { setName(e.target.value); setNote(null); }} /><Button onClick={save}>Save</Button></div>
          </Field>
        </div>
      </Card>

      <div className="bld-out">
        {chart !== 'table' && <ChartView chart={chart} built={built} />}

        <div className="paper-layout bld-paper-layout">
          <div className="paper" aria-label="What you will download">
            <div className="paper-gym">{gym.gymName}</div>
            <h3 className="paper-title">{built.table.title}</h3>
            <div className="paper-sub">{built.table.subtitle}</div>
            <div className="paper-count">{built.table.rows.length} {built.table.rows.length === 1 ? 'row' : 'rows'}</div>
            <DataTable table={{ ...built.table, rows: built.table.rows.slice(0, BUILDER_PAPER_ROWS) }} />
            {built.table.rows.length > BUILDER_PAPER_ROWS && <p className="paper-more">Showing the first {BUILDER_PAPER_ROWS} of {built.table.rows.length} rows. The download has every row.</p>}
          </div>
          <div className="paper-controls">
            <div className="paper-field" role="radiogroup" aria-label="File format">
              <div className="paper-label">File format</div>
              <div className="paper-formats">
                {FORMATS.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={format === f.id} className={`format-pick${format === f.id ? ' on' : ''}`} onClick={() => { setFormat(f.id); setNote(null); }}><b>{f.label}</b></button>
                ))}
              </div>
            </div>
            <div className="muted small paper-file">File name: <span>{`${fileBase(gym.gymName, built.table.title, new Date())}.${chosen?.ext ?? ''}`}</span></div>
            <Button variant="primary" className="wide-btn" disabled={busy || built.table.rows.length === 0} onClick={() => void doDownload()}>{busy ? 'Preparing…' : `Download ${chosen?.label ?? ''}`}</Button>
            {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartView({ chart, built }: { chart: ChartKind; built: ReturnType<typeof build> }) {
  const first = built.measureTypes[0] ?? 'number';
  // Only figures in the same unit as the first share one chart.
  const idx = built.measureTypes.flatMap((t, i) => (t === first ? [i] : []));
  const scale = (n: number) => (first === 'money' ? n / 100 : n);
  const fmt = (n: number) => (first === 'money' ? `£${compact(n)}` : compact(n));
  const groups = built.groups.slice(0, MAX_CATEGORIES);
  const cats = groups.map((g) => g.label);
  const series = idx.map((i, k) => ({ name: built.measureLabels[i] ?? '', color: seriesColor(k), values: groups.map((g) => scale(g.values[i] ?? 0)) }));
  const label = built.table.title;
  const mixed = idx.length < built.measureTypes.length;
  return (
    <Card>
      <SectionTitle title="Chart" action={groups.length < built.groups.length ? <span className="muted">First {MAX_CATEGORIES} of {built.groups.length}</span> : undefined} />
      {mixed && <p className="muted small">Figures in different units cannot share one chart, so only the first kind is drawn. The table shows them all.</p>}
      {chart === 'column' && <ColumnChart label={label} categories={cats} series={series} format={fmt} />}
      {chart === 'line' && <LineChart label={label} categories={cats} series={series} format={fmt} />}
      {chart === 'bar' && (
        <Bars label={label} rows={groups.map((g) => ({ label: g.label, value: Math.round(scale(g.values[idx[0] ?? 0] ?? 0) * 100) / 100 }))} suffix="" onOpen={() => undefined} />
      )}
      {chart === 'donut' && <DonutView groups={groups} i={idx[0] ?? 0} scale={scale} fmt={fmt} label={label} />}
    </Card>
  );
}

function DonutView({ groups, i, scale, fmt, label }: { groups: { label: string; values: number[] }[]; i: number; scale: (n: number) => number; fmt: (n: number) => string; label: string }) {
  const items = groups.map((g) => ({ label: g.label, value: Math.max(0, scale(g.values[i] ?? 0)) })).filter((x) => x.value > 0);
  const top = items.slice(0, 7);
  const rest = items.slice(7).reduce((n, x) => n + x.value, 0);
  const slices: Slice[] = [...top.map((x, k) => ({ ...x, color: seriesColor(k) })), ...(rest > 0 ? [{ label: 'Other', value: rest, color: OTHER_COLOR }] : [])];
  const total = items.reduce((n, x) => n + x.value, 0);
  return <Donut label={label} slices={slices} centreLabel={fmt(total)} format={fmt} />;
}

