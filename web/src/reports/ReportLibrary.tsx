import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Button } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { Field, Select } from '../ui/Field';
import { rangeStart } from './calc';
import { DataTable } from './DataTable';
import { downloadTable, fileBase, type Format } from './download';
import { LIBRARY, LIBRARY_COUNT, type LibraryContext, type LibraryReport } from './library';
import './paper.css';

const FORMATS: { id: Format; label: string; note: string; ext: string }[] = [
  { id: 'csv', label: 'CSV', note: 'Plain spreadsheet text', ext: 'csv' },
  { id: 'xlsx', label: 'Excel', note: 'An Excel workbook', ext: 'xlsx' },
  { id: 'pdf', label: 'PDF', note: 'A document to print or send', ext: 'pdf' },
];

/** How many rows the sheet of paper shows. The download always has every row. */
export const PAPER_ROWS = 25;

const FIRST = LIBRARY[0]?.reports[0]?.key ?? '';

/**
 * Choose a report from a list, choose CSV, Excel or PDF, see what you will get on a sheet of paper, then download it.
 */
export function ReportLibrary({ data, rangeDays, rangeLabel }: { data: LibraryData; rangeDays: number; rangeLabel: string }) {
  const { gym } = useReadyAuth();
  const [key, setKey] = useState(FIRST);
  const [format, setFormat] = useState<Format>('xlsx');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const report: LibraryReport | undefined = useMemo(() => LIBRARY.flatMap((g) => g.reports).find((r) => r.key === key), [key]);

  // The sheet is made from the chosen report and range; a download is made fresh so "made at" is right.
  const make = (r: LibraryReport) => {
    const ctx: LibraryContext = { gymName: gym.gymName, rangeLabel, now: new Date(), since: rangeStart(rangeDays, new Date()) };
    return r.build(ctx, data);
  };
  const table = useMemo(() => (report ? make(report) : null), [report, data, rangeDays, rangeLabel, gym.gymName]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const fileName = table && chosen ? `${fileBase(gym.gymName, table.title, new Date())}.${chosen.ext}` : '';

  const download = async () => {
    if (!report) return;
    setBusy(true);
    setNote(null);
    try {
      const t = make(report);
      await downloadTable(t, format, fileBase(gym.gymName, t.title, new Date()));
      setNote({ text: `Downloaded ${t.rows.length} ${t.rows.length === 1 ? 'row' : 'rows'} as ${chosen?.label ?? format}.`, good: true });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : 'The download failed. Please try again.', good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Report library" action={<span className="muted">{LIBRARY_COUNT} reports</span>} />
      <div className="paper-layout">
        <div className="paper-controls">
          <Field label="Report" htmlFor="report-pick" hint={report?.description}>
            <Select id="report-pick" value={key} onChange={(e) => { setKey(e.target.value); setNote(null); }}>
              {LIBRARY.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.reports.map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>

          <div className="paper-field" role="radiogroup" aria-label="File format">
            <div className="paper-label">File format</div>
            <div className="paper-formats">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={format === f.id} className={`format-pick${format === f.id ? ' on' : ''}`} onClick={() => { setFormat(f.id); setNote(null); }}>
                  <b>{f.label}</b><span className="small">{f.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="muted small">Period: {rangeLabel}. Change it with the date box at the top of the page.</div>
          {fileName && <div className="muted small paper-file">File name: <span>{fileName}</span></div>}
          <Button variant="primary" className="wide-btn" disabled={busy || !table || table.rows.length === 0} onClick={() => void download()}>{busy ? 'Preparing…' : `Download ${chosen?.label ?? ''}`}</Button>
          {table && table.rows.length === 0 && <div className="muted small">There is nothing in this report for the period, so there is nothing to download.</div>}
          {note && <div className={`msg ${note.good ? '' : 'error'}`} role={note.good ? 'status' : 'alert'}>{note.text}</div>}
        </div>

        <div className="paper" aria-label="What you will download">
          {table && (
            <>
              <div className="paper-gym">{gym.gymName}</div>
              <h3 className="paper-title">{table.title}</h3>
              <div className="paper-sub">{table.subtitle}</div>
              <div className="paper-count">{table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}</div>
              <DataTable table={{ ...table, rows: table.rows.slice(0, PAPER_ROWS) }} />
              {table.rows.length > PAPER_ROWS && <p className="paper-more">Showing the first {PAPER_ROWS} of {table.rows.length} rows. The download has every row.</p>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
