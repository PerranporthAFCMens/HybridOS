import { useMemo, useState, type ReactNode } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { links } from '../shell/legacy';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import {
  RANGES, attendanceTable, buildOverview, classesTable, incomeTable, membershipsTable, newMembersTable, overviewTable,
  reportMoney, sessionMetrics, type TableContext,
} from './calc';
import { Bars } from './Bars';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import { OverviewCharts } from './ReportCharts';
import { ReportTabs, TABS, type TabKey } from './ReportTabs';
import type { ReportTable } from './download';
import { useReportData } from './useReports';
import './reports.css';

export function Reports() {
  const { gym } = useReadyAuth();
  const [range, setRange] = useState('30');
  const [tab, setTab] = useState<TabKey>('overview');
  const [drill, setDrill] = useState<(() => ReportTable) | null>(null);
  const q = useReportData(gym.gymId, Number(range));
  const rangeLabel = RANGES.find(([v]) => v === range)?.[1] ?? '';

  const view = useMemo(() => {
    if (!q.data) return null;
    const { sessions, bookings, plans, activeMemberships, members, names, since } = q.data;
    const metrics = sessionMetrics(sessions, bookings);
    const overview = buildOverview({ metrics, activeMemberships, plans, members, since, now: new Date() });
    return { metrics, overview, plans, activeMemberships, members, names, since };
  }, [q.data]);

  // Built fresh each time something is clicked or downloaded, so "made at" is right.
  const ctx = (): TableContext => ({ gymName: gym.gymName, rangeLabel, now: new Date() });
  const o = view?.overview;

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Business intelligence</div>
          <h1>Reporting</h1>
          <div className="muted">Membership, attendance and utilisation in one place.</div>
        </div>
        <div className="report-controls">
          <label className="visually-hidden" htmlFor="report-range">Date range</label>
          <Select id="report-range" value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Button onClick={() => void q.refetch()} disabled={q.isFetching}>Refresh</Button>
        </div>
      </header>

      <p className="muted report-hint">Click any figure, bar or chart to see the rows behind it, and download them.</p>

      <div className="report-tabs" role="tablist" aria-label="Report sections">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" id={`tab-${key}`} aria-selected={tab === key} className={`report-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && q.isError && <Card><Empty>Could not load the report. Refresh to try again.</Empty></Card>}
      {tab === 'overview' && q.isPending && <Card><Empty>Loading reporting…</Empty></Card>}

      {tab === 'overview' && view && o && (
        <>
          <div className="download-bar">
            <span className="muted">Download this overview</span>
            <DownloadButtons gymName={gym.gymName} build={() => overviewTable(ctx(), o)} />
          </div>

          <div className="stat-grid">
            <Stat label="Active memberships" value={String(o.activeMemberships)} onOpen={() => setDrill(() => () => membershipsTable(ctx(), 'Active memberships', view.plans, view.activeMemberships, view.names))} />
            <Stat label="Est. MRR" value={reportMoney(o.mrr)} onOpen={() => setDrill(() => () => incomeTable(ctx(), view.plans, view.activeMemberships))} />
            <Stat label="Average class fill" value={`${o.avgFill}%`} onOpen={() => setDrill(() => () => classesTable(ctx(), 'Classes and how full they were', view.metrics))} />
            <Stat label="Attendance rate" value={`${o.attendanceRate}%`} onOpen={() => setDrill(() => () => attendanceTable(ctx(), 'Attendance by class', view.metrics))} />
            <Stat label="New members" value={String(o.newMembers)} onOpen={() => setDrill(() => () => newMembersTable(ctx(), view.members, view.names, view.since))} />
            <Stat label="Class attendances" value={String(o.attendances)} onOpen={() => setDrill(() => () => attendanceTable(ctx(), 'Attendance by class', view.metrics))} />
            <Stat label="No-shows" value={String(o.noShows)} onOpen={() => setDrill(() => () => attendanceTable(ctx(), 'No-shows by class', view.metrics))} />
            <Stat label="Sessions analysed" value={String(o.sessions)} onOpen={() => setDrill(() => () => classesTable(ctx(), 'Sessions analysed', view.metrics))} />
          </div>

          <div className="report-cols">
            <Card>
              <SectionTitle title="What is busiest?" action={<span className="muted">Average utilisation</span>} />
              <Bars
                rows={o.byDay} suffix="%" label="Busiest days"
                onOpen={(day) => setDrill(() => () => classesTable(ctx(), `Classes on ${day}s`, view.metrics, (s) => s.day === day))}
              />
              <div className="bars-gap" />
              <Bars
                rows={o.byBand} suffix="%" label="Busiest times of day"
                onOpen={(band) => setDrill(() => () => classesTable(ctx(), `${band} classes`, view.metrics, (s) => s.band === band))}
              />
            </Card>
            <Card>
              <SectionTitle title="Membership mix" />
              {o.planMix.length ? (
                <Bars
                  rows={o.planMix} label="Active memberships by plan"
                  onOpen={(name) => {
                    const plan = view.plans.find((p) => p.name === name);
                    setDrill(() => () => membershipsTable(ctx(), `Active members on ${name}`, view.plans, view.activeMemberships, view.names, plan?.id));
                  }}
                />
              ) : <Empty>No membership plans yet.</Empty>}
            </Card>
          </div>

          <OverviewCharts rangeDays={Number(range)} rangeLabel={rangeLabel} onOpenTable={(build) => setDrill(() => build)} />
        </>
      )}

      {tab !== 'overview' && (
        <ReportTabs tab={tab} rangeDays={Number(range)} rangeLabel={rangeLabel} onOpenTable={(build) => setDrill(() => build)} />
      )}

      <Card>
        <SectionTitle title="The old Reporting page" />
        <p className="muted">Everything from the old Reporting page is now here, including the Xero export. The old page stays available until you accept the new one.</p>
        <LinkButton href={links.reports}>Open the detailed reports</LinkButton>
      </Card>

      {drill && <DrillDown build={drill} gymName={gym.gymName} onClose={() => setDrill(null)} />}
    </>
  );
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

function Stat({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }): ReactNode {
  return (
    <button type="button" className="card stat stat-btn" onClick={onOpen} aria-label={`${label}: ${value}. Show what is behind this.`}>
      <span className="muted">{label}</span>
      <span className="stat-num">{value}</span>
    </button>
  );
}
