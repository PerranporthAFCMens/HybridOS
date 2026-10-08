import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { rangeStart } from './calc';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import type { ReportTable } from './download';
import { LIBRARY_COUNT, PREVIEW_ROWS, searchLibrary, type LibraryContext, type LibraryReport } from './library';

/** All the old Reporting library's reports: find one, look at it, or download it as CSV, Excel or PDF. */
export function ReportLibrary({ data, rangeDays, rangeLabel }: { data: LibraryData; rangeDays: number; rangeLabel: string }) {
  const { gym } = useReadyAuth();
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<LibraryReport | null>(null);
  const groups = useMemo(() => searchLibrary(search), [search]);

  // Built fresh when a report is opened or downloaded, so "made at" is right and the range is the chosen one.
  const build = (r: LibraryReport) => (): ReportTable => {
    const ctx: LibraryContext = { gymName: gym.gymName, rangeLabel, now: new Date(), since: rangeStart(rangeDays, new Date()) };
    return r.build(ctx, data);
  };

  return (
    <Card>
      <SectionTitle title="Report library" action={<span className="muted">{LIBRARY_COUNT} reports</span>} />
      <Field label="Search reports" htmlFor="report-search">
        <Input id="report-search" value={search} placeholder="Search reports" onChange={(e) => setSearch(e.target.value)} />
      </Field>
      {groups.length === 0 && <Empty>No report matches that search.</Empty>}
      {groups.map((g) => (
        <section className="lib-group" key={g.group} aria-label={g.group}>
          <div className="lib-group-head"><h4>{g.group}</h4><span className="muted">{g.reports.length} {g.reports.length === 1 ? 'report' : 'reports'}</span></div>
          <div className="lib-grid">
            {g.reports.map((r) => (
              <article className="lib-card" key={r.key}>
                <h5>{r.title}</h5>
                <p className="muted small">{r.description}</p>
                <div className="lib-actions">
                  <Button aria-label={`View ${r.title}`} onClick={() => setViewing(r)}>View</Button>
                  <DownloadButtons gymName={gym.gymName} build={build(r)} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {viewing && <ReportView title={viewing.title} build={build(viewing)} gymName={gym.gymName} onClose={() => setViewing(null)} />}
    </Card>
  );
}

function ReportView({ title, build, gymName, onClose }: { title: string; build: () => ReportTable; gymName: string; onClose: () => void }) {
  const table = useMemo(() => build(), [build]);
  const shown = { ...table, rows: table.rows.slice(0, PREVIEW_ROWS) };
  return (
    <Modal title={title} onClose={onClose}>
      <SectionTitle title={title} action={<Button onClick={onClose}>Close</Button>} />
      <div className="muted small">{table.subtitle}</div>
      <div className="muted small">{table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}</div>
      <div className="drill-actions"><DownloadButtons gymName={gymName} build={build} /></div>
      <DataTable table={shown} />
      {table.rows.length > PREVIEW_ROWS && <p className="muted small">Showing the first {PREVIEW_ROWS} of {table.rows.length} rows. The downloads include every row.</p>}
    </Modal>
  );
}
