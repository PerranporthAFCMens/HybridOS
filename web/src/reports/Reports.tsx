import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { RANGES } from './calc';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import { Owed } from './Owed';
import type { ReportTable } from './download';
import { findEntry, findLibraryReport, isPane, legacyKey } from './reportList';
import { ReportCard } from './ReportCards';
import { ReportsHome } from './ReportsHome';
import { Targets } from './Targets';
import { ReportTabs } from './ReportTabs';
import { useLibraryData } from './useReports';
import './reports.css';

/** One page: the summary and the list of reports. Opening a report swaps the page for that report, with a way back. */
export function Reports() {
  const { gym } = useReadyAuth();
  const [sp, setSp] = useSearchParams();
  const period = RANGES.some(([v]) => v === sp.get('p')) ? (sp.get('p') as string) : '30';
  const rangeDays = Number(period);
  const rangeLabel = RANGES.find(([v]) => v === period)?.[1] ?? '';
  const key = sp.get('r') ?? legacyKey(sp.get('tab'));
  const entry = findEntry(key);
  const [drill, setDrill] = useState<(() => ReportTable) | null>(null);

  const setPeriod = (p: string) => setSp((old) => { const n = new URLSearchParams(old); n.set('p', p); n.delete('tab'); return n; }, { replace: true });
  const back = `?p=${period}`;

  return (
    <>
      <header className="page-top report-head">
        <div>
          <div className="eyebrow">Reports</div>
          <h1>{entry ? entry.title : 'Reports'}</h1>
          <div className="muted">{entry ? entry.blurb : 'How the business is doing, and every report in one list.'}</div>
        </div>
      </header>

      {entry && <p className="report-back"><Link className="btn quiet" to={back}>← All reports</Link></p>}

      {entry?.key !== 'builder' && (
        <div className="period-chips" role="radiogroup" aria-label="Period">
          {RANGES.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={period === v} className={`period-chip${period === v ? ' on' : ''}`} onClick={() => setPeriod(v)}>{l}</button>
          ))}
        </div>
      )}

      {!entry && <Home gymId={gym.gymId} rangeDays={rangeDays} rangeLabel={rangeLabel} period={period} onOpenTable={(b) => setDrill(() => b)} />}
      {entry?.key === 'owed' && <Owed />}
      {entry?.key === 'targets' && <Targets />}
      {entry && isPane(entry.key) && entry.key !== 'owed' && entry.key !== 'targets' && <ReportTabs tab={entry.key} rangeDays={rangeDays} rangeLabel={rangeLabel} onOpenTable={(b) => setDrill(() => b)} />}
      {entry && !isPane(entry.key) && <LibraryPage reportKey={entry.key} gymId={gym.gymId} rangeDays={rangeDays} rangeLabel={rangeLabel} />}

      {drill && <DrillDown build={drill} gymName={gym.gymName} onClose={() => setDrill(null)} />}
    </>
  );
}

/** Loads twice the chosen range so the summary can say how this period compares with the one before. */
function Home({ gymId, rangeDays, rangeLabel, period, onOpenTable }: { gymId: string; rangeDays: number; rangeLabel: string; period: string; onOpenTable: (build: () => ReportTable) => void }) {
  const q = useLibraryData(gymId, rangeDays * 2, true);
  if (q.isPending) return <Card><Empty>Loading reports…</Empty></Card>;
  if (q.isError) return <Card><Empty>Could not load the reports. Refresh to try again.</Empty></Card>;
  return <ReportsHome d={q.data} rangeDays={rangeDays} rangeLabel={rangeLabel} period={period} onOpenTable={onOpenTable} />;
}

function LibraryPage({ reportKey, gymId, rangeDays, rangeLabel }: { reportKey: string; gymId: string; rangeDays: number; rangeLabel: string }) {
  const q = useLibraryData(gymId, rangeDays, true);
  const report = findLibraryReport(reportKey);
  if (!report) return <Card><Empty>That report was not found.</Empty></Card>;
  if (q.isPending) return <Card><Empty>Loading…</Empty></Card>;
  if (q.isError) return <Card><Empty>Could not load this report. Refresh to try again.</Empty></Card>;
  return <ReportCard single report={report} data={q.data} rangeDays={rangeDays} rangeLabel={rangeLabel} />;
}

function DrillDown({ build, gymName, onClose }: { build: () => ReportTable; gymName: string; onClose: () => void }) {
  const table = useMemo(() => build(), [build]);
  return (
    <Modal title={table.title} onClose={onClose}>
      <SectionTitle title={table.title} action={<Button onClick={onClose}>Close</Button>} />
      <div className="muted small">{table.subtitle}</div>
      <div className="drill-actions"><DownloadButtons gymName={gymName} build={build} /></div>
      <DataTable table={table} />
    </Modal>
  );
}
