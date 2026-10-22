import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Select } from '../ui/Field';
import { barWidth, rangeStart } from './calc';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import type { LibraryContext, LibraryReport } from './library';
import { autoChart } from './reportView';

/** Rows a card shows on screen. Exports always have every row. */
export const CARD_ROWS = 25;

/** One library report: charted when there is something to chart, with its table and a quiet Export. `single` is the report's own page (always open, title shown by the page). */
export function ReportCard({ report, data, rangeDays, rangeLabel, single = false }: { report: LibraryReport; data: LibraryData; rangeDays: number; rangeLabel: string; single?: boolean }) {
  const { gym } = useReadyAuth();
  const [open, setOpen] = useState(single);
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
        {!single && (
          <div>
            <h4>{report.title}</h4>
            <p className="muted small">{report.description}</p>
          </div>
        )}
        <div className="report-card-actions">
          <DownloadButtons gymName={gym.gymName} build={make} />
          {!single && <Button className="quiet" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Show'}<span className="visually-hidden"> {report.title}</span></Button>}
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
