import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Button } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { Select } from '../ui/Field';
import { barWidth, rangeStart } from './calc';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import { LIBRARY, type LibraryContext, type LibraryReport } from './library';
import { autoChart } from './reportView';

/** Rows a card shows on screen. Exports always have every row. */
export const CARD_ROWS = 25;

function ReportCard({ report, data, rangeDays, rangeLabel }: { report: LibraryReport; data: LibraryData; rangeDays: number; rangeLabel: string }) {
  const { gym } = useReadyAuth();
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState('');
  const choice = report.option ? (report.option.choices.some((c) => c.value === option) ? option : report.option.default) : undefined;
  const make = () => report.build({ gymName: gym.gymName, rangeLabel, now: new Date(), since: rangeStart(rangeDays, new Date()), option: choice } satisfies LibraryContext, data);
  // Only worked out once the card is opened.
  const table = useMemo(() => (open ? make() : null), [open, data, rangeDays, rangeLabel, gym.gymName, choice]); // eslint-disable-line react-hooks/exhaustive-deps
  const chart = table ? autoChart(table) : null;
  const max = chart ? Math.max(1, ...chart.bars.map((b) => b.value)) : 1;
  return (
    <Card className="report-card">
      <div className="report-card-head">
        <div>
          <h4>{report.title}</h4>
          <p className="muted small">{report.description}</p>
        </div>
        <div className="report-card-actions">
          <DownloadButtons gymName={gym.gymName} build={make} />
          <Button className="quiet" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Show'}<span className="visually-hidden"> {report.title}</span></Button>
        </div>
      </div>
      {open && table && (
        <div className="report-card-body">
          {report.option && (
            <label className="report-pick">
              <span className="muted small">{report.option.label}</span>
              <Select value={choice} onChange={(e) => setOption(e.target.value)} aria-label={`${report.title}: ${report.option.label}`}>
                {report.option.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </label>
          )}
          <div className="muted small">{table.subtitle} · {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}</div>
          {chart && (
            <div className="bar-list" role="list" aria-label={`${report.title}: ${chart.heading}`}>
              {chart.bars.map((b) => (
                <div role="listitem" key={b.label} className="bar-row static">
                  <span className="bar-label">{b.label}</span>
                  <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${barWidth(b.value, max)}%` }} /></span>
                  <b>{b.text}</b>
                </div>
              ))}
              <p className="muted small">{chart.heading}</p>
            </div>
          )}
          <DataTable table={{ ...table, rows: table.rows.slice(0, CARD_ROWS) }} />
          {table.rows.length > CARD_ROWS && <p className="muted small">Showing the first {CARD_ROWS} of {table.rows.length} rows. The export has every row.</p>}
        </div>
      )}
    </Card>
  );
}

/** The library reports of the named groups, one card each: charted when there is something to chart, exportable always. */
export function ReportCards({ groups, data, rangeDays, rangeLabel }: { groups: string[]; data: LibraryData; rangeDays: number; rangeLabel: string }) {
  const shown = LIBRARY.filter((g) => groups.includes(g.group));
  return (
    <>
      {shown.map((g) => (
        <section key={g.group} className="lib-group" aria-label={g.group}>
          <SectionTitle title={g.group} action={<span className="muted">{g.reports.length} reports</span>} />
          <div className="report-card-list">
            {g.reports.map((r) => <ReportCard key={r.key} report={r} data={data} rangeDays={rangeDays} rangeLabel={rangeLabel} />)}
          </div>
        </section>
      ))}
    </>
  );
}
