import { useState, type ReactNode } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Bars } from './Bars';
import { classesTable, rangeStart, reportMoney, type TableContext } from './calc';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import type { ReportTable } from './download';
import { pounds, type LibraryContext } from './library';
import { AttendanceChart, JoinsChart, MembersLineChart, PaymentStateDonut, PaymentsChart, PlanDonut } from './ReportCharts';
import { Builder } from '../builder/Builder';
import { ReportLibrary } from './ReportLibrary';
import { XeroExport } from './XeroExport';
import {
  atRiskTable, bestSlots, classPerformanceTable, classesTab, heatStep, heatValue, relativeStep, membersTab, membershipsTab, membershipsTable, metricsOf, paymentsTab, topMembersTable,
  type ClassesTab, type HeatMetric, type HeatRow, type MembersTab, type MembershipsTab, type PaymentsTab,
} from './tabs';
import { useLibraryData } from './useReports';

export type TabKey = 'overview' | 'memberships' | 'classes' | 'members' | 'payments' | 'xero' | 'library' | 'builder';
export const TABS: [TabKey, string][] = [
  ['overview', 'Overview'], ['memberships', 'Memberships'], ['classes', 'Classes'], ['members', 'Members'], ['payments', 'Payments'], ['xero', 'Accounting (Xero)'], ['library', 'Report library'], ['builder', 'Report builder'],
];

const HEAT_CHOICES: [HeatMetric, string][] = [['bookings', 'Bookings'], ['revenue', 'Revenue'], ['fill', 'Fill']];
const heatText = (m: HeatMetric, v: number) => (m === 'fill' ? `${v}%` : m === 'bookings' ? String(v) : v ? reportMoney(v) : '£0');

/** Which days and times of day are busiest, or earn the most. Revenue is paid drop-ins; membership classes are in the monthly fee. */
function HeatCard({ heat }: { heat: HeatRow[] }) {
  const [metric, setMetric] = useState<HeatMetric>('bookings');
  const max = Math.max(0, ...heat.flatMap((r) => r.cells.map((c) => heatValue(c, metric))));
  const best = bestSlots(heat, metric);
  const word = metric === 'fill' ? 'full' : metric === 'bookings' ? 'bookings' : 'in drop-in sales';
  return (
    <Card>
      <SectionTitle title="Class heatmap" action={<span className="muted">By day and time</span>} />
      <div className="heat-pick" role="radiogroup" aria-label="Show on the heatmap">
        {HEAT_CHOICES.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={metric === id} className={`heat-choice${metric === id ? ' on' : ''}`} onClick={() => setMetric(id)}>{label}</button>
        ))}
      </div>
      <table className="heat">
        <caption className="visually-hidden">{metric === 'fill' ? 'Average fill' : metric === 'bookings' ? 'Bookings' : 'Drop-in revenue'} by day and time of day</caption>
        <thead>
          <tr><th scope="col"><span className="visually-hidden">Day</span></th>{heat[0]?.cells.map((c) => <th key={c.band} scope="col">{c.band}</th>)}</tr>
        </thead>
        <tbody>
          {heat.map((r) => (
            <tr key={r.day}>
              <th scope="row">{r.day}</th>
              {r.cells.map((c) => {
                const v = heatValue(c, metric);
                const step = metric === 'fill' ? heatStep(v) : relativeStep(v, max);
                return <td key={c.band} className={`v${step}`} aria-label={`${r.day} ${c.band}: ${heatText(metric, v)}`}>{heatText(metric, v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {best.length > 0 ? (
        <p className="muted small heat-best">Best: {best.map((b) => `${b.day} ${b.band.toLowerCase()} (${heatText(metric, b.value)} ${metric === 'fill' ? 'full' : word})`).join(' · ')}</p>
      ) : (
        <p className="muted small heat-best">Nothing to show for this period yet.</p>
      )}
      {metric === 'revenue' && <p className="muted small">Revenue counts classes people paid for as a drop-in. Classes covered by a membership are in the monthly fee, so they show under Bookings.</p>}
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <span className="stat-num">{value}</span>
    </div>
  );
}

/** The tabs other than the Overview. They share one load of the data, only fetched once a tab is opened. */
export function ReportTabs({ tab, rangeDays, rangeLabel, onOpenTable }: { tab: Exclude<TabKey, 'overview'>; rangeDays: number; rangeLabel: string; onOpenTable: (build: () => ReportTable) => void }) {
  const { gym } = useReadyAuth();
  const q = useLibraryData(gym.gymId, rangeDays, tab !== 'builder');
  const detail = q.error && typeof q.error === 'object' && 'message' in q.error ? String((q.error as { message: unknown }).message) : '';
  if (tab === 'builder') return <Builder key={gym.gymId} />;
  if (q.isPending) return <Card><Empty>Loading…</Empty></Card>;
  if (q.isError) return <Card><Empty>Could not load this report. Refresh to try again.</Empty>{detail && <p className="muted">Detail: {detail}</p>}</Card>;
  const d = q.data;
  const since = rangeStart(rangeDays, new Date());
  const ctx = (): LibraryContext => ({ gymName: gym.gymName, rangeLabel, now: new Date(), since });
  const cp = { d, rangeDays, rangeLabel, onOpenTable };
  if (tab === 'memberships') return <MembershipsPane d={d} since={since} ctx={ctx} gymName={gym.gymName} cp={cp} />;
  if (tab === 'classes') return <ClassesPane d={d} ctx={ctx} gymName={gym.gymName} onOpenTable={onOpenTable} cp={cp} />;
  if (tab === 'members') return <MembersPane d={d} ctx={ctx} gymName={gym.gymName} cp={cp} />;
  if (tab === 'payments') return <PaymentsPane d={d} ctx={ctx} gymName={gym.gymName} cp={cp} />;
  if (tab === 'xero') return <XeroExport key={gym.gymId} d={d} rangeLabel={rangeLabel} since={since} />;
  return <ReportLibrary data={d} rangeDays={rangeDays} rangeLabel={rangeLabel} />;
}

type ChartProps = Parameters<typeof AttendanceChart>[0];
interface PaneProps { d: LibraryData; ctx: () => LibraryContext; gymName: string; cp: ChartProps }

function MembershipsPane({ d, since, ctx, gymName, cp }: PaneProps & { since: string | null }) {
  const t: MembershipsTab = membershipsTab(d, since);
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Active" value={String(t.active)} />
        <StatCard label="MRR" value={reportMoney(t.mrr)} />
        <StatCard label="Plans" value={String(t.activePlans)} />
        <StatCard label="New joins" value={String(t.newJoins)} />
      </div>
      <div className="report-cols"><PlanDonut {...cp} /><MembersLineChart {...cp} /></div>
      <Card>
        <SectionTitle title="Membership plans" action={<DownloadButtons gymName={gymName} build={() => membershipsTable(ctx(), t)} />} />
        {t.plans.length === 0 ? <Empty>No membership plans yet.</Empty> : <DataTable table={membershipsTable(ctx(), t)} />}
      </Card>
    </>
  );
}

function ClassesPane({ d, ctx, gymName, onOpenTable, cp }: PaneProps & { onOpenTable: (build: () => ReportTable) => void }) {
  const t: ClassesTab = classesTab(d, new Date());
  const metrics = metricsOf(d);
  const tctx = (): TableContext => ctx();
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Avg fill" value={`${t.avgFill}%`} />
        <StatCard label="Attendances" value={String(t.attendances)} />
        <StatCard label="No-shows" value={String(t.noShows)} />
        <StatCard label="Sessions" value={String(t.sessions)} />
      </div>
      <AttendanceChart {...cp} />
      <div className="report-cols">
        <Card>
          <SectionTitle title="By class type" action={<DownloadButtons gymName={gymName} build={() => classPerformanceTable(ctx(), t)} />} />
          {t.byType.length === 0 ? <Empty>No classes in this period.</Empty> : (
            <Bars rows={t.byType.slice(0, 10).map((r) => ({ label: r.name, value: r.fill }))} suffix="%" label="Average fill by class type"
              onOpen={(name) => onOpenTable(() => classesTable(tctx(), `${name} sessions`, metrics, (s) => s.name === name))} />
          )}
        </Card>
        <HeatCard heat={t.heat} />
      </div>
      <Card>
        <SectionTitle title="Class performance detail" action={<DownloadButtons gymName={gymName} build={() => classPerformanceTable(ctx(), t)} />} />
        <DataTable table={classPerformanceTable(ctx(), t)} />
      </Card>
    </>
  );
}

function MembersPane({ d, ctx, gymName, cp }: PaneProps) {
  const t: MembersTab = membersTab(d, new Date());
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Active gym members" value={String(t.activeMembers)} />
        <StatCard label="Members attending" value={String(t.attending)} />
        <StatCard label="Total attendances" value={String(t.attendances)} />
        <StatCard label="No-show rate" value={`${t.noShowRate}%`} />
      </div>
      <JoinsChart {...cp} />
      <Card>
        <SectionTitle title="Most active members" action={<DownloadButtons gymName={gymName} build={() => topMembersTable(ctx(), t)} />} />
        {t.top.length === 0 ? <Empty>Attendance data will appear here as members attend classes.</Empty> : <DataTable table={topMembersTable(ctx(), t)} />}
      </Card>
    </>
  );
}

function PaymentsPane({ d, ctx, gymName, cp }: PaneProps) {
  const t: PaymentsTab = paymentsTab(d);
  return (
    <>
      <div className="stat-grid">
        <StatCard label="Failed / at-risk payments" value={String(t.atRisk.length)} />
        <StatCard label="Outstanding" value={pounds(t.outstanding)} />
        <StatCard label="Payment records" value={String(t.records)} />
      </div>
      <div className="report-cols"><PaymentsChart {...cp} /><PaymentStateDonut {...cp} /></div>
      <Card>
        <SectionTitle title="Bad debtors / payment recovery" action={<DownloadButtons gymName={gymName} build={() => atRiskTable(ctx(), d, t)} />} />
        {t.atRisk.length === 0 ? <Empty>No failed or charged-back payments.</Empty> : <DataTable table={atRiskTable(ctx(), d, t)} />}
      </Card>
    </>
  );
}
