import { useMemo, useState } from 'react';
import { londonParts } from '../classes/calc';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { DataTable } from '../reports/DataTable';
import { useLibraryData } from '../reports/useReports';
import { downloadTable, fileBase, type Format } from '../reports/download';
import { pounds } from '../reports/library';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { DateInput, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ChartView } from './ChartView';
import { mergeBuilt } from './compare';
import { DATASETS } from './datasets';
import { FN_LABEL, OPS_FOR, build, chartsAllowed, defaultSpec, filtersForGroup, isNumeric, needsValue, rowsInGroup, sanitise, show, type ChartKind, type Field as DField, type Filter, type Fn, type Measure, type Op, type Spec } from './engine';
import { PRESETS, type Preset, comparePeriod, customPeriod, periodFilters, periodFor, rangeText, type Compare, type PeriodSel } from './period';
import { loadSaved, storeSaved, type SavedReport } from './saved';
import { STARTERS } from './starters';
import { trend, trendText } from './trend';
import '../reports/paper.css';
import '../charts/charts.css';
import '../reports/reports.css';
import './builder.css';

const FORMATS: { id: Format; label: string; ext: string }[] = [{ id: 'csv', label: 'CSV', ext: 'csv' }, { id: 'xlsx', label: 'Excel', ext: 'xlsx' }, { id: 'pdf', label: 'PDF', ext: 'pdf' }];
const CHART_LABEL: Record<ChartKind, string> = { table: 'Table', column: 'Columns', bar: 'Bars', line: 'Line', donut: 'Ring' };
const TYPE_TAG: Record<DField['type'], string> = { text: 'Abc', number: '123', money: '£', date: 'Date' };
export const BUILDER_PAPER_ROWS = 25;
const PRINT_ROWS = 200;
const DRILL_ROWS = 100;
const COUNT = '__count';

type Target = 'columns' | 'group' | 'values' | 'filter';
type Note = { text: string; good: boolean } | null;

/** A figure as the owner reads it: pounds for money, whole or two-decimal numbers otherwise. */
export function figure(n: number, type: DField['type']): string {
  return type === 'money' ? pounds(Math.round(n)) : (Math.round(n * 100) / 100).toLocaleString('en-GB');
}

/**
 * The report builder as a canvas: ready-made starting points, a list of fields to drag (or tap) into Group by, Values,
 * Columns and Filters, a big live visual with headline figures, click a bar to see the rows behind it, and a sheet of
 * paper to download. The owner can only use the fields each dataset offers.
 */
export function Builder() {
  const { gym } = useReadyAuth();
  // The builder picks its own dates, so it always loads everything and filters here.
  const q = useLibraryData(gym.gymId, 0, true);
  if (q.isPending) return <Card><Empty>Loading…</Empty></Card>;
  if (q.isError) return <Card><Empty>Could not load this report. Refresh to try again.</Empty></Card>;
  return <BuilderBody data={q.data} />;
}

function BuilderBody({ data }: { data: LibraryData }) {
  const { gym } = useReadyAuth();
  const first = DATASETS[0];
  const [spec, setSpec] = useState<Spec>(() => defaultSpec(first?.id ?? '', first?.fields ?? []));
  const [fine, setFine] = useState(false);
  const [showPaper, setShowPaper] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saved, setSaved] = useState<SavedReport[]>(() => loadSaved(gym.gymId, DATASETS));
  const [name, setName] = useState('');
  const [pickSaved, setPickSaved] = useState('');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const [starters, setStarters] = useState(false);
  const [sel, setSel] = useState<PeriodSel>({ preset: 'all' });
  const [compare, setCompare] = useState<Compare>('none');
  const [showDates, setShowDates] = useState(false);
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [dateError, setDateError] = useState('');
  const [openField, setOpenField] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ key: string; label: string } | null>(null);

  const ds = DATASETS.find((d) => d.id === spec.dataset) ?? DATASETS[0];
  const fields = useMemo(() => ds?.fields ?? [], [ds]);
  const rows = useMemo(() => (ds ? ds.rows(data, new Date()) : []), [ds, data]);
  const title = ds ? `${ds.label}${spec.mode === 'summary' ? ': summary' : ''}` : 'Report';
  const today = londonParts(new Date()).date;
  const period = periodFor(sel, today);
  const dateField = ds?.dateField;
  const cmp = spec.mode === 'summary' && dateField ? comparePeriod(period, compare) : null;
  const periodLabel = period.from ? rangeText(period.from, period.to) : 'All time';
  const subtitle = `${gym.gymName}${dateField ? ` · ${periodLabel}${cmp ? ` compared with ${cmp.label}` : ''}` : ''}${spec.filters.length ? ` · ${spec.filters.length} ${spec.filters.length === 1 ? 'filter' : 'filters'}` : ''}`;
  const specFor = (p: typeof period): Spec => ({ ...spec, filters: [...spec.filters, ...(dateField ? periodFilters(dateField, p) : [])] });
  const effSpec = useMemo(() => specFor(period), [spec, period.from, period.to, dateField]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmpSpec = useMemo(() => (cmp ? specFor(cmp) : null), [spec, cmp?.from, cmp?.to, dateField]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupFieldType = fields.find((f) => f.id === spec.groupBy)?.type;
  const builtA = useMemo(() => build(effSpec, rows, fields, title, subtitle), [effSpec, rows, fields, title, subtitle]);
  const builtB = useMemo(() => (cmpSpec ? build(cmpSpec, rows, fields, title, subtitle) : null), [cmpSpec, rows, fields, title, subtitle]);
  const built = useMemo(() => (builtB ? mergeBuilt(builtA, builtB, periodLabel, cmp?.label ?? '', groupFieldType === 'date') : builtA), [builtA, builtB, periodLabel, cmp?.label, groupFieldType]);
  const allowed = chartsAllowed(spec).filter((k) => !(cmp && k === 'donut'));
  const chart = allowed.includes(spec.chart) ? spec.chart : 'table';
  const byId = new Map(fields.map((f) => [f.id, f]));
  const numericFields = fields.filter((f) => isNumeric(f.type));
  const groupField = spec.groupBy ? byId.get(spec.groupBy) : undefined;

  const change = (patch: Partial<Spec>) => { setNote(null); setSpec((s) => ({ ...s, ...patch })); };
  const startFrom = (st: { spec: Spec; period: Preset }) => { setNote(null); setSpec(st.spec); setSel({ preset: st.period }); setCompare('none'); setStarters(false); setPickSaved(''); };
  const setDataset = (id: string) => { const d = DATASETS.find((x) => x.id === id); if (d) { setNote(null); setSpec(defaultSpec(d.id, d.fields)); } };
  const setMeasure = (i: number, patch: Partial<Measure>) => change({ measures: spec.measures.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const setFilter = (i: number, patch: Partial<Filter>) => change({ filters: spec.filters.map((f, k) => (k === i ? { ...f, ...patch } : f)) });

  /** Put a field into one of the boxes. Dropping and tapping do exactly the same thing. */
  const addTo = (target: Target, id: string) => {
    setOpenField(null);
    if (target === 'values' && id === COUNT) return change({ measures: [...spec.measures.filter((m) => m.fn !== 'count'), { fn: 'count', field: null } as Measure].slice(0, 4) });
    const f = byId.get(id);
    if (!f) return;
    if (target === 'columns') return change({ columns: spec.columns.includes(id) ? spec.columns : [...spec.columns, id] });
    if (target === 'group') return change({ groupBy: id });
    if (target === 'values') {
      if (!isNumeric(f.type)) return setNote({ text: `${f.label} is not a number, so it cannot be added up. Use "Number of rows" to count it, or put it in Group by.`, good: false });
      return change({ measures: [...spec.measures, { fn: 'sum', field: id } as Measure].slice(0, 4) });
    }
    change({ filters: [...spec.filters, { field: id, op: (OPS_FOR[f.type][0]?.[0] ?? 'is') as Op, value: '' }] });
  };
  const drop = (target: Target) => (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) addTo(target, id); };
  const over = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const moveCol = (i: number, by: -1 | 1) => { const c = spec.columns.slice(); const a = c[i]; const b = c[i + by]; if (a === undefined || b === undefined) return; c[i] = b; c[i + by] = a; change({ columns: c }); };

  const doDownload = async (format: Format) => {
    setBusy(true);
    setNote(null);
    try {
      await downloadTable(built.table, format, fileBase(gym.gymName, built.table.title, new Date()));
      setNote({ text: `Downloaded ${built.table.rows.length} ${built.table.rows.length === 1 ? 'row' : 'rows'} as ${FORMATS.find((f) => f.id === format)?.label ?? format}. Charts are not part of the file.`, good: true });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'The download failed. Please try again.', good: false });
    } finally {
      setBusy(false);
    }
  };
  const useDates = () => {
    const p = customPeriod(fromDraft, toDraft);
    if (!p) return setDateError(!fromDraft || !toDraft ? 'Pick both dates.' : fromDraft > toDraft ? 'The first date must not be after the second.' : 'Those dates are not valid.');
    setSel({ from: fromDraft, to: toDraft });
    setDateError('');
  };
  const save = () => {
    const n = name.trim();
    if (!n) return setNote({ text: 'Give the report a name to save it.', good: false });
    const next = [...saved.filter((s) => s.name.toLowerCase() !== n.toLowerCase()), { name: n, spec, period: sel, compare }];
    setSaved(next);
    storeSaved(gym.gymId, next);
    setPickSaved(n);
    setNote({ text: `Saved "${n}" on this device.`, good: true });
    setShowSave(false);
  };
  const loadOne = (n: string) => {
    setPickSaved(n);
    const s = saved.find((x) => x.name === n);
    const ok = s ? sanitise(s.spec, DATASETS) : null;
    if (ok && s) { setSpec(ok); setSel(s.period); setCompare(s.compare); setName(n); setNote(null); setStarters(false); }
  };
  const removeOne = () => {
    const next = saved.filter((s) => s.name !== pickSaved);
    setSaved(next);
    storeSaved(gym.gymId, next);
    setPickSaved('');
    setNote({ text: 'Saved report removed from this device.', good: true });
  };
  const narrowTo = () => {
    if (!drill || !groupField) return;
    const extra = filtersForGroup(groupField, spec.dateBy, drill.key);
    setSpec((s) => ({ ...s, filters: [...s.filters, ...extra], groupBy: null, mode: 'list', columns: fields.slice(0, 6).map((f) => f.id), chart: 'table' }));
    setDrill(null);
    setNote({ text: `Narrowed the report to ${drill.label}. It is now a list of those rows.`, good: true });
  };
  const drillRows = drill ? rowsInGroup(effSpec, rows, fields, drill.key) : [];
  const drillFields = fields.slice(0, 6);

  const fieldButton = (id: string, label: string, tag: string, personal?: boolean) => (
    <li key={id}>
      <button type="button" className="bld-field" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'copy'; }}
        aria-expanded={openField === id} aria-label={`${label}. Drag it into a box, or tap to choose where it goes.`} onClick={() => setOpenField(openField === id ? null : id)}>
        <span className="bld-grip" aria-hidden="true">⋮⋮</span><span className="bld-fname">{label}{personal && <span className="tag warn bld-tag">personal</span>}</span><span className="bld-ftype">{tag}</span>
      </button>
      {openField === id && (
        <div className="bld-where" role="group" aria-label={`Where should ${label} go?`}>
          {spec.mode === 'list'
            ? <Button onClick={() => addTo('columns', id)}>Add as a column</Button>
            : (<>
              {id !== COUNT && <Button onClick={() => addTo('group', id)}>Group by</Button>}
              {(id === COUNT || isNumeric(byId.get(id)?.type ?? 'text')) && <Button onClick={() => addTo('values', id)}>Add to Values</Button>}
            </>)}
          {id !== COUNT && <Button onClick={() => addTo('filter', id)}>Filter by</Button>}
        </div>
      )}
    </li>
  );

  const measureOptions: { value: string; label: string }[] = [
    { value: 'list:', label: 'Every row, as a list' },
    { value: 'count:', label: 'Number of rows' },
    ...numericFields.map((f) => ({ value: `sum:${f.id}`, label: `Total ${f.label}` })),
  ];
  const m0 = spec.measures[0];
  const m0Value = spec.mode === 'list' ? 'list:' : m0 ? `${m0.fn}:${m0.field ?? ''}` : 'count:';
  if (m0 && !measureOptions.some((o) => o.value === m0Value)) measureOptions.push({ value: m0Value, label: `${FN_LABEL[m0.fn]}${m0.field ? ` of ${byId.get(m0.field)?.label ?? ''}` : ''}` });
  const pickMeasure = (v: string) => {
    if (v === 'list:') return change({ mode: 'list', chart: 'table' });
    const [fn, field] = v.split(':');
    const m = (fn === 'count' ? { fn: 'count', field: null } : { fn: fn as Fn, field: field ?? null }) as Measure;
    change({ mode: 'summary', chart: spec.mode === 'list' || spec.chart === 'table' ? 'column' : spec.chart, measures: spec.measures.length ? spec.measures.map((x, k) => (k === 0 ? m : x)) : [m] });
  };

  const activeFilters = spec.filters.map((f, i) => {
    const field = byId.get(f.field);
    const op = OPS_FOR[field?.type ?? 'text'].find(([id]) => id === f.op)?.[1] ?? f.op;
    return { i, text: `${field?.label ?? f.field} ${op.toLowerCase()}${needsValue(f.op) ? ` ${f.value || '…'}` : ''}` };
  });
  const listing = spec.mode === 'list' || chart === 'table';
  const chipText = ('preset' in sel ? period.label : periodLabel) + (cmp ? ` vs ${cmp.label}` : '');

  return (
    <div className="bld2">
      <div className="bld-bar">
        <Button aria-expanded={starters} onClick={() => setStarters((v) => !v)}>Start from a ready-made report {starters ? '▴' : '▾'}</Button>
        <div className="bld-bar-right">
          {saved.length > 0 && (
            <>
              <Select aria-label="My saved reports" value={pickSaved} onChange={(e) => loadOne(e.target.value)}>
                <option value="">My saved reports…</option>
                {saved.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </Select>
              {pickSaved && <Button onClick={removeOne}>Remove</Button>}
            </>
          )}
          <Button onClick={() => { setNote(null); setShowSave(true); }}>Save</Button>
        </div>
      </div>
      {starters && (
        <ul className="bld-starters">
          {STARTERS.map((s) => (
            <li key={s.id}><button type="button" className="bld-starter" onClick={() => startFrom(s)}><b>{s.title}</b><span>{s.text}</span></button></li>
          ))}
        </ul>
      )}

      <Card className="bld-main">
        <div className="bld-sentence">
          <span>Show</span>
          <Select aria-label="Show" className="bld-pill" value={m0Value} onChange={(e) => pickMeasure(e.target.value)}>
            {measureOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {spec.mode === 'summary' && (
            <>
              <span>by</span>
              <Select aria-label="Split by" className="bld-pill" value={spec.groupBy ?? ''} onChange={(e) => change({ groupBy: e.target.value || null })}>
                <option value="">Nothing (one total)</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Select>
            </>
          )}
          <span>from</span>
          <Select aria-label="Look at" className="bld-pill" value={spec.dataset} onChange={(e) => setDataset(e.target.value)}>
            {DATASETS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
          {dateField && (
            <>
              <span>for</span>
              <button type="button" className="bld-pill-btn" aria-label={`Dates: ${chipText}. Change.`} onClick={() => { setNote(null); setShowDates(true); }}>{chipText} ▾</button>
            </>
          )}
        </div>
        <p className="muted bld-help">Change a highlighted word to change the report. {ds?.description}{dateField ? '' : ' It has no dates, so it is not filtered by date.'}</p>
        {activeFilters.length > 0 && (
          <ul className="bld-active" aria-label="Active filters">
            {activeFilters.map((f) => (
              <li key={f.i}><span>{f.text}</span><button type="button" aria-label={`Remove filter ${f.i + 1}: ${f.text}`} onClick={() => change({ filters: spec.filters.filter((_, k) => k !== f.i) })}>✕</button></li>
            ))}
          </ul>
        )}

        {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}

        {spec.mode === 'summary' && (
          <ul className="stat-grid" aria-label="Headline figures">
            {builtA.totals.map((t, i) => {
              const vals = builtA.groups.map((g) => g.values[i] ?? 0);
              const before = builtB?.totals[i];
              const tr = before !== undefined ? trend([before, t]) : groupField?.type === 'date' ? trend(vals) : null;
              const type = builtA.measureTypes[i] ?? 'number';
              const against = before !== undefined ? `vs ${cmp?.label ?? ''}` : `${builtA.groups[builtA.groups.length - 1]?.label ?? ''} vs ${builtA.groups[builtA.groups.length - 2]?.label ?? ''}`;
              return (
                <li className="card stat" key={i}>
                  <span className="muted">{builtA.measureLabels[i]}</span>
                  <span className="stat-num">{figure(t, type)}</span>
                  {tr && <span className={`stat-delta ${tr.direction}`}>{trendText(tr)} <span>{against}</span></span>}
                </li>
              );
            })}
          </ul>
        )}

        {allowed.length > 1 && (
          <div className="bld-charts" role="radiogroup" aria-label="Chart">
            {allowed.map((k) => <button key={k} type="button" role="radio" aria-checked={chart === k} className={`bld-seg-btn${chart === k ? ' on' : ''}`} onClick={() => change({ chart: k })}>{CHART_LABEL[k]}</button>)}
          </div>
        )}

        {!listing ? (
          <ChartView chart={chart} built={built} onOpen={(g) => setDrill({ key: g.key, label: g.label })} />
        ) : (
          <div className="bld-result" aria-label="Report table">
            <div className="muted small">{built.table.rows.length} {built.table.rows.length === 1 ? 'row' : 'rows'}</div>
            <DataTable table={{ ...built.table, rows: built.table.rows.slice(0, BUILDER_PAPER_ROWS) }} />
            {built.table.rows.length > BUILDER_PAPER_ROWS && <p className="muted small">Showing the first {BUILDER_PAPER_ROWS} of {built.table.rows.length} rows. Downloads and the printable report have every row.</p>}
          </div>
        )}

        <div className="bld-actions">
          <span className="bld-actions-label">Get this report</span>
          {FORMATS.map((f) => <Button key={f.id} disabled={busy || built.table.rows.length === 0} onClick={() => void doDownload(f.id)}>{busy ? 'Preparing…' : `Download ${f.label}`}</Button>)}
          <Button disabled={built.table.rows.length === 0} onClick={() => setShowPaper(true)}>Print report</Button>
        </div>
      </Card>

      <div className="bld-fine">
        <Button aria-expanded={fine} onClick={() => setFine((v) => !v)}>Filters, columns and fields {fine ? '▴' : '▾'}</Button>
        {fine && (
          <div className="bld-fine-body">
            <Card>
              <p className="muted bld-help">Drag a field into a box, or tap a field to choose where it goes.</p>
            <div className="bld-wells">
              {spec.mode === 'list' ? (
                <div className="bld-well" onDragOver={over} onDrop={drop('columns')} aria-label="Columns box">
                  <div className="paper-label">Columns</div>
                  <ol className="bld-chips">
                    {spec.columns.map((c, i) => (
                      <li className="bld-chip" key={c}>
                        <span>{byId.get(c)?.label}</span>
                        <span className="bld-move">
                          <Button aria-label={`Move ${byId.get(c)?.label} left`} disabled={i === 0} onClick={() => moveCol(i, -1)}>◀</Button>
                          <Button aria-label={`Move ${byId.get(c)?.label} right`} disabled={i === spec.columns.length - 1} onClick={() => moveCol(i, 1)}>▶</Button>
                          <Button aria-label={`Remove column ${byId.get(c)?.label}`} disabled={spec.columns.length === 1} onClick={() => change({ columns: spec.columns.filter((x) => x !== c) })}>✕</Button>
                        </span>
                      </li>
                    ))}
                  </ol>
                  {spec.columns.length === 0 && <div className="muted small">Drag fields here</div>}
                </div>
              ) : (
                <>
                  <div className="bld-well" onDragOver={over} onDrop={drop('group')} aria-label="Group by box">
                    <div className="paper-label">Group by</div>
                    {groupField ? (
                      <div className="bld-chip"><span>{groupField.label}</span><Button aria-label={`Remove group by ${groupField.label}`} onClick={() => change({ groupBy: null })}>✕</Button></div>
                    ) : <div className="muted small">Drag a field here to split the figures</div>}
                    {groupField?.type === 'date' && (
                      <Select aria-label="Group dates by" value={spec.dateBy} onChange={(e) => change({ dateBy: e.target.value === 'day' ? 'day' : 'month' })}>
                        <option value="month">Month</option><option value="day">Day</option>
                      </Select>
                    )}
                  </div>
                  <div className="bld-well" onDragOver={over} onDrop={drop('values')} aria-label="Values box">
                    <div className="paper-label">Values</div>
                    {spec.measures.map((m, i) => (
                      <div className="bld-row bld-measure" key={i}>
                        <Select aria-label={`Figure ${i + 1}: what to work out`} value={m.fn} onChange={(e) => { const fn = e.target.value as Fn; setMeasure(i, { fn, field: fn === 'count' ? null : fn === 'distinct' ? (m.field && byId.has(m.field) ? m.field : fields[0]?.id ?? null) : m.field && isNumeric(byId.get(m.field)?.type ?? 'text') ? m.field : numericFields[0]?.id ?? null }); }}>
                          {(Object.keys(FN_LABEL) as Fn[]).filter((fn) => fn === 'count' || fn === 'distinct' || numericFields.length > 0).map((fn) => <option key={fn} value={fn}>{FN_LABEL[fn]}</option>)}
                        </Select>
                        {m.fn !== 'count' && (
                          <Select aria-label={`Figure ${i + 1}: of which field`} value={m.field ?? ''} onChange={(e) => setMeasure(i, { field: e.target.value })}>
                            {(m.fn === 'distinct' ? fields : numericFields).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                          </Select>
                        )}
                        <Button aria-label={`Remove figure ${i + 1}`} disabled={spec.measures.length === 1} onClick={() => change({ measures: spec.measures.filter((_, k) => k !== i) })}>✕</Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="bld-well" onDragOver={over} onDrop={drop('filter')} aria-label="Filters box">
                <div className="paper-label">Filters</div>
                {spec.filters.length === 0 && <div className="muted small">Drag a field here to only include some rows</div>}
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
                      <Button aria-label={`Remove filter ${i + 1}`} onClick={() => change({ filters: spec.filters.filter((_, k) => k !== i) })}>✕</Button>
                    </div>
                  );
                })}
              </div>
            </div>
            </Card>
            <Card>
              <div className="paper-label">Fields</div>
              <ul className="bld-field-list">
                {spec.mode === 'summary' && fieldButton(COUNT, 'Number of rows', '#')}
                {fields.map((f) => fieldButton(f.id, f.label, TYPE_TAG[f.type], f.sensitive))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      {showDates && (
        <Modal title="Choose dates" onClose={() => setShowDates(false)}>
          <SectionTitle title="Choose dates" action={<Button onClick={() => setShowDates(false)}>Done</Button>} />
          <div className="bld-dates">
            <div>
              <div className="paper-label">Quick choices</div>
              <div className="bld-quick" role="group" aria-label="Quick choices">
                {PRESETS.map(([id, label]) => <button key={id} type="button" className={`bld-seg-btn${'preset' in sel && sel.preset === id ? ' on' : ''}`} aria-pressed={'preset' in sel && sel.preset === id} onClick={() => { setSel({ preset: id }); setDateError(''); }}>{label}</button>)}
              </div>
            </div>
            <div>
              <div className="paper-label">Or pick two dates</div>
              <div className="bld-row">
                <DateInput aria-label="From date" value={fromDraft} onChange={(e) => { setFromDraft(e.target.value); setDateError(''); }} />
                <span className="muted">to</span>
                <DateInput aria-label="To date" value={toDraft} onChange={(e) => { setToDraft(e.target.value); setDateError(''); }} />
                <Button onClick={useDates}>Use these dates</Button>
              </div>
              {dateError && <div className="msg error" role="alert">{dateError}</div>}
            </div>
            <div>
              <div className="paper-label">Compare with</div>
              <div className="bld-quick" role="radiogroup" aria-label="Compare with">
                {([['none', 'No comparison'], ['previous', 'The period before'], ['year', 'Same time last year']] as const).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={compare === id} disabled={id !== 'none' && (!period.from || spec.mode === 'list')} className={`bld-seg-btn${compare === id ? ' on' : ''}`} onClick={() => setCompare(id)}>{label}</button>
                ))}
              </div>
              <p className="muted small">{!period.from ? 'Pick a period to compare it with another.' : spec.mode === 'list' ? 'Comparing works on summaries, not on a list of rows.' : cmp ? `Comparing ${periodLabel} with ${cmp.label}.` : 'The chart will show both periods side by side.'}</p>
            </div>
          </div>
        </Modal>
      )}

      {showSave && (
        <Modal title="Save this report" onClose={() => setShowSave(false)}>
          <SectionTitle title="Save this report" />
          <p className="muted small">It is kept on this device only.</p>
          <Input aria-label="Save this report" placeholder="Name this report" value={name} onChange={(e) => { setName(e.target.value); setNote(null); }} />
          {note && !note.good && <div className="msg error" role="alert">{note.text}</div>}
          <div className="drill-actions"><Button variant="primary" onClick={save}>Save report</Button><Button onClick={() => setShowSave(false)}>Cancel</Button></div>
        </Modal>
      )}

      {showPaper && (
        <Modal title="Printable report" onClose={() => setShowPaper(false)}>
          <div className="paper-print">
            <div className="paper" aria-label="What you will download">
              <div className="paper-gym">{gym.gymName}</div>
              <h3 className="paper-title">{built.table.title}</h3>
              <div className="paper-sub">{built.table.subtitle}</div>
              <div className="paper-count">{built.table.rows.length} {built.table.rows.length === 1 ? 'row' : 'rows'}</div>
              <DataTable table={{ ...built.table, rows: built.table.rows.slice(0, PRINT_ROWS) }} />
              {built.table.rows.length > PRINT_ROWS && <p className="paper-more">Showing the first {PRINT_ROWS} of {built.table.rows.length} rows. The download has every row.</p>}
            </div>
          </div>
          <div className="drill-actions"><Button variant="primary" onClick={() => window.print()}>Print</Button><Button onClick={() => setShowPaper(false)}>Close</Button></div>
        </Modal>
      )}

      {drill && (
        <Modal title={`Rows behind ${drill.label}`} onClose={() => setDrill(null)}>
          <SectionTitle title={`Rows behind ${drill.label}`} action={<Button onClick={() => setDrill(null)}>Close</Button>} />
          <div className="muted small">{drillRows.length} {drillRows.length === 1 ? 'row' : 'rows'}</div>
          <div className="drill-actions"><Button variant="primary" onClick={narrowTo}>Filter the report to this</Button></div>
          <DataTable table={{ title: drill.label, subtitle: '', headers: drillFields.map((f) => f.label), rows: drillRows.slice(0, DRILL_ROWS).map((r) => drillFields.map((f) => show(r[f.id] ?? null, f.type))) }} />
          {drillRows.length > DRILL_ROWS && <p className="muted small">Showing the first {DRILL_ROWS} of {drillRows.length} rows.</p>}
        </Modal>
      )}
    </div>
  );
}
