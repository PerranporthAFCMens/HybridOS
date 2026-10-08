import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { DataTable } from '../reports/DataTable';
import { downloadTable, fileBase, type Format } from '../reports/download';
import { pounds } from '../reports/library';
import { Button } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { DateInput, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { ChartView } from './ChartView';
import { DATASETS } from './datasets';
import { FN_LABEL, OPS_FOR, build, chartsAllowed, defaultSpec, filtersForGroup, isNumeric, needsValue, rowsInGroup, sanitise, show, type ChartKind, type Field as DField, type Filter, type Fn, type Measure, type Op, type Spec } from './engine';
import { loadSaved, storeSaved, type SavedReport } from './saved';
import { STARTERS } from './starters';
import '../reports/paper.css';
import '../charts/charts.css';
import './builder.css';

const FORMATS: { id: Format; label: string; ext: string }[] = [{ id: 'csv', label: 'CSV', ext: 'csv' }, { id: 'xlsx', label: 'Excel', ext: 'xlsx' }, { id: 'pdf', label: 'PDF', ext: 'pdf' }];
const CHART_LABEL: Record<ChartKind, string> = { table: 'Table', column: 'Columns', bar: 'Bars', line: 'Line', donut: 'Ring' };
const TYPE_TAG: Record<DField['type'], string> = { text: 'Abc', number: '123', money: '£', date: 'Date' };
export const BUILDER_PAPER_ROWS = 25;
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
export function Builder({ data, rangeLabel }: { data: LibraryData; rangeLabel: string }) {
  const { gym } = useReadyAuth();
  const first = DATASETS[0];
  const [spec, setSpec] = useState<Spec>(() => defaultSpec(first?.id ?? '', first?.fields ?? []));
  const [format, setFormat] = useState<Format>('xlsx');
  const [saved, setSaved] = useState<SavedReport[]>(() => loadSaved(gym.gymId, DATASETS));
  const [name, setName] = useState('');
  const [pickSaved, setPickSaved] = useState('');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const [starters, setStarters] = useState(true);
  const [openField, setOpenField] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ key: string; label: string } | null>(null);

  const ds = DATASETS.find((d) => d.id === spec.dataset) ?? DATASETS[0];
  const fields = useMemo(() => ds?.fields ?? [], [ds]);
  const rows = useMemo(() => (ds ? ds.rows(data, new Date()) : []), [ds, data]);
  const title = ds ? `${ds.label}${spec.mode === 'summary' ? ': summary' : ''}` : 'Report';
  const subtitle = `${gym.gymName} · ${rangeLabel}${spec.filters.length ? ` · ${spec.filters.length} ${spec.filters.length === 1 ? 'filter' : 'filters'}` : ''}`;
  const built = useMemo(() => build(spec, rows, fields, title, subtitle), [spec, rows, fields, title, subtitle]);
  const allowed = chartsAllowed(spec);
  const chart = allowed.includes(spec.chart) ? spec.chart : 'table';
  const byId = new Map(fields.map((f) => [f.id, f]));
  const numericFields = fields.filter((f) => isNumeric(f.type));
  const chosen = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const groupField = spec.groupBy ? byId.get(spec.groupBy) : undefined;

  const change = (patch: Partial<Spec>) => { setNote(null); setSpec((s) => ({ ...s, ...patch })); };
  const startFrom = (s: Spec) => { setNote(null); setSpec(s); setStarters(false); setPickSaved(''); };
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
    if (ok) { setSpec(ok); setName(n); setNote(null); setStarters(false); }
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
  const drillRows = drill ? rowsInGroup(spec, rows, fields, drill.key) : [];
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
    { value: 'count:', label: 'Number of rows' },
    ...numericFields.map((f) => ({ value: `sum:${f.id}`, label: `Total ${f.label}` })),
  ];
  const m0 = spec.measures[0];
  const m0Value = m0 ? `${m0.fn}:${m0.field ?? ''}` : 'count:';
  if (m0 && !measureOptions.some((o) => o.value === m0Value)) measureOptions.push({ value: m0Value, label: `${FN_LABEL[m0.fn]}${m0.field ? ` of ${byId.get(m0.field)?.label ?? ''}` : ''}` });
  const pickMeasure = (v: string) => {
    const [fn, field] = v.split(':');
    const m = (fn === 'count' ? { fn: 'count', field: null } : { fn: fn as Fn, field: field ?? null }) as Measure;
    change({ measures: spec.measures.length ? spec.measures.map((x, k) => (k === 0 ? m : x)) : [m] });
  };

  return (
    <div className="bld2">
      <div className="bld-bar">
        <div className="bld-bar-left">
          <Button aria-expanded={starters} onClick={() => setStarters((v) => !v)}>Start from a ready-made report {starters ? '▴' : '▾'}</Button>
          {saved.length > 0 && (
            <>
              <Select aria-label="My saved reports" value={pickSaved} onChange={(e) => loadOne(e.target.value)}>
                <option value="">My saved reports…</option>
                {saved.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </Select>
              {pickSaved && <Button onClick={removeOne}>Remove</Button>}
            </>
          )}
        </div>
        <div className="bld-bar-right">
          <Input aria-label="Save this report" placeholder="Name this report to save it" value={name} onChange={(e) => { setName(e.target.value); setNote(null); }} />
          <Button onClick={save}>Save</Button>
        </div>
      </div>
      {starters && (
        <ul className="bld-starters">
          {STARTERS.map((s) => (
            <li key={s.id}><button type="button" className="bld-starter" onClick={() => startFrom(s.spec)}><b>{s.title}</b><span className="muted small">{s.text}</span></button></li>
          ))}
        </ul>
      )}

      <div className="bld2-main">
        <div className="bld-canvas">
          <Card>
            <div className="bld-sentence">
              <span>Look at</span>
              <Select aria-label="Look at" className="bld-pill" value={spec.dataset} onChange={(e) => setDataset(e.target.value)}>
                {DATASETS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
              {spec.mode === 'summary' ? (
                <>
                  <span>and show</span>
                  <Select aria-label="Show" className="bld-pill" value={m0Value} onChange={(e) => pickMeasure(e.target.value)}>
                    {measureOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  <span>by</span>
                  <Select aria-label="Split by" className="bld-pill" value={spec.groupBy ?? ''} onChange={(e) => change({ groupBy: e.target.value || null })}>
                    <option value="">Nothing (one total)</option>
                    {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </Select>
                </>
              ) : <span>and list the rows</span>}
              <span>for {rangeLabel.toLowerCase()}</span>
            </div>
            {ds?.description && <p className="muted small bld-desc">{ds.description}</p>}
            <div className="bld-toolbar">
              <div className="bld-seg" role="radiogroup" aria-label="How to show it">
                {([['list', 'List the rows'], ['summary', 'Summarise']] as const).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={spec.mode === id} className={`format-pick${spec.mode === id ? ' on' : ''}`} onClick={() => change({ mode: id, chart: id === 'list' ? 'table' : spec.chart })}><b>{label}</b></button>
                ))}
              </div>
              {allowed.length > 1 && (
                <div className="bld-charts" role="radiogroup" aria-label="Chart">
                  {allowed.map((k) => <button key={k} type="button" role="radio" aria-checked={chart === k} className={`format-pick${chart === k ? ' on' : ''}`} onClick={() => change({ chart: k })}><b>{CHART_LABEL[k]}</b></button>)}
                </div>
              )}
            </div>

          </Card>

          {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}

          {spec.mode === 'summary' && (
            <ul className="bld-kpis" aria-label="Headline figures">
              {built.totals.map((t, i) => (
                <li className="card bld-kpi" key={i}><span className="muted small">{built.measureLabels[i]}</span><b>{figure(t, built.measureTypes[i] ?? 'number')}</b></li>
              ))}
            </ul>
          )}

          {chart !== 'table' && (
            <Card>
              <SectionTitle title={built.table.title} action={<span className="muted">Click a bar to see its rows</span>} />
              <ChartView chart={chart} built={built} onOpen={(g) => setDrill({ key: g.key, label: g.label })} />
            </Card>
          )}

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
                  {FORMATS.map((f) => <button key={f.id} type="button" role="radio" aria-checked={format === f.id} className={`format-pick${format === f.id ? ' on' : ''}`} onClick={() => { setFormat(f.id); setNote(null); }}><b>{f.label}</b></button>)}
                </div>
              </div>
              <div className="muted small paper-file">File name: <span>{`${fileBase(gym.gymName, built.table.title, new Date())}.${chosen?.ext ?? ''}`}</span></div>
              <Button variant="primary" className="wide-btn" disabled={busy || built.table.rows.length === 0} onClick={() => void doDownload()}>{busy ? 'Preparing…' : `Download ${chosen?.label ?? ''}`}</Button>
            </div>
          </div>
        </div>

        <aside className="bld-panel" aria-label="Fields and settings">
          <Card>
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
          <Card className="bld-fields">
            <div className="paper-label">Fields</div>
            <p className="muted small bld-hint">Drag a field into a box below, or tap it.</p>
            <ul className="bld-field-list">
              {spec.mode === 'summary' && fieldButton(COUNT, 'Number of rows', '#')}
              {fields.map((f) => fieldButton(f.id, f.label, TYPE_TAG[f.type], f.sensitive))}
            </ul>
          </Card>
        </aside>
      </div>

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
