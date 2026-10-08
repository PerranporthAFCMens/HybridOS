import type { ReactNode } from 'react';
import { ColumnChart } from '../charts/ColumnChart';
import { Donut } from '../charts/Donut';
import { LineChart } from '../charts/LineChart';
import { compact } from '../charts/scale';
import type { LibraryData } from '../data/reportLibrary';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { rangeStart } from './calc';
import type { ReportTable } from './download';
import type { LibraryContext } from './library';
import { membershipsTab } from './tabs';
import {
  activeMembersSeries, attendanceRowsTable, attendanceSeries, incomeSeries, joinsRowsTable, joinsSeries, paymentGroupTable, paymentRowsTable, paymentSeries,
  paymentStateSlices, periodsFor, planMembersTable, planSlices, type PayGroup,
} from './trends';
import { useReadyAuth } from '../auth/AuthProvider';
import { useLibraryData } from './useReports';
import '../charts/charts.css';

interface Props {
  d: LibraryData;
  rangeDays: number;
  rangeLabel: string;
  onOpenTable: (build: () => ReportTable) => void;
}

const pound = (n: number) => `£${compact(n)}`;

function useCtx(rangeDays: number, rangeLabel: string) {
  const { gym } = useReadyAuth();
  return (): LibraryContext => ({ gymName: gym.gymName, rangeLabel, now: new Date(), since: rangeStart(rangeDays, new Date()) });
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <SectionTitle title={title} action={hint ? <span className="muted">{hint}</span> : undefined} />
      {children}
    </Card>
  );
}

export function AttendanceChart({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const now = new Date();
  const periods = periodsFor(rangeDays, now);
  return (
    <ChartCard title="Attendance over time" hint="Click a column for its classes">
      <ColumnChart label="Attendance over time" categories={periods.map((p) => p.label)} series={attendanceSeries(d, periods, now)} stacked
        onSelect={(i) => { const p = periods[i]; if (p) onOpenTable(() => attendanceRowsTable(ctx(), d, p)); }} />
    </ChartCard>
  );
}

export function JoinsChart({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const periods = periodsFor(rangeDays, new Date());
  return (
    <ChartCard title="Members joined and left" hint="Click a column for the people">
      <ColumnChart label="Members joined and left" categories={periods.map((p) => p.label)} series={joinsSeries(d, periods)}
        onSelect={(i) => { const p = periods[i]; if (p) onOpenTable(() => joinsRowsTable(ctx(), d, p)); }} />
    </ChartCard>
  );
}

export function IncomeChart({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const periods = periodsFor(rangeDays, new Date());
  return (
    <ChartCard title="Income collected" hint="Click a column for the payments">
      <ColumnChart label="Income collected" categories={periods.map((p) => p.label)} series={incomeSeries(d, periods)} format={pound}
        onSelect={(i) => { const p = periods[i]; if (p) onOpenTable(() => paymentRowsTable(ctx(), d, p, 'Paid')); }} />
    </ChartCard>
  );
}

export function MembersLineChart({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const now = new Date();
  const periods = periodsFor(rangeDays, now);
  return (
    <ChartCard title="Members over time" hint="At the end of each period">
      <LineChart label="Members over time" categories={periods.map((p) => p.label)} series={activeMembersSeries(d, periods, now)}
        onSelect={(i) => { const p = periods[i]; if (p) onOpenTable(() => joinsRowsTable(ctx(), d, p)); }} />
    </ChartCard>
  );
}

export function PlanDonut({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const slices = planSlices(membershipsTab(d, null).plans);
  return (
    <ChartCard title="Active memberships by plan" hint="Click a slice for the members">
      <Donut label="Active memberships by plan" centreLabel="active" emptyText="No active memberships yet." slices={slices}
        onSelect={(i) => { const s = slices[i]; if (s) onOpenTable(() => planMembersTable(ctx(), d, `Active members on ${s.label}`, s.ids)); }} />
    </ChartCard>
  );
}

export function PaymentsChart({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const periods = periodsFor(rangeDays, new Date());
  return (
    <ChartCard title="Payments over time" hint="Click a column for the payments">
      <ColumnChart label="Payments over time, in pounds" categories={periods.map((p) => p.label)} series={paymentSeries(d, periods)} stacked format={pound}
        onSelect={(i) => { const p = periods[i]; if (p) onOpenTable(() => paymentRowsTable(ctx(), d, p)); }} />
    </ChartCard>
  );
}

export function PaymentStateDonut({ d, rangeDays, rangeLabel, onOpenTable }: Props) {
  const ctx = useCtx(rangeDays, rangeLabel);
  const slices = paymentStateSlices(d, rangeStart(rangeDays, new Date()));
  return (
    <ChartCard title="Payments by outcome" hint="Click a slice for the payments">
      <Donut label="Payments by outcome" centreLabel="payments" emptyText="No payments in this period." slices={slices}
        onSelect={(i) => { const s = slices[i]; if (s) onOpenTable(() => paymentGroupTable(ctx(), d, s.label as PayGroup)); }} />
    </ChartCard>
  );
}

/** The Overview's charts. They load the fuller data set on their own, so the headline figures never wait for them. */
export function OverviewCharts({ rangeDays, rangeLabel, onOpenTable }: Omit<Props, 'd'>) {
  const { gym } = useReadyAuth();
  const q = useLibraryData(gym.gymId, rangeDays, true);
  if (q.isPending) return <Card><Empty>Loading charts…</Empty></Card>;
  if (q.isError) return <Card><Empty>Could not load the charts. Refresh to try again.</Empty></Card>;
  const p = { d: q.data, rangeDays, rangeLabel, onOpenTable };
  return (
    <>
      <div className="report-cols"><AttendanceChart {...p} /><IncomeChart {...p} /></div>
      <div className="report-cols"><JoinsChart {...p} /><MembersLineChart {...p} /></div>
    </>
  );
}
