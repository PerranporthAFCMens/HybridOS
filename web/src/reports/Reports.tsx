import { useMemo, useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { links } from '../shell/legacy';
import { Button, LinkButton } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Select } from '../ui/Field';
import { RANGES, barWidth, buildOverview, reportMoney, sessionMetrics } from './calc';
import { useReportData } from './useReports';
import './reports.css';

export function Reports() {
  const { gym } = useReadyAuth();
  const [range, setRange] = useState('30');
  const q = useReportData(gym.gymId, Number(range));
  const overview = useMemo(() => {
    if (!q.data) return null;
    const { sessions, bookings, plans, activePlanIds, members, since } = q.data;
    return buildOverview({ metrics: sessionMetrics(sessions, bookings), activePlanIds, plans, members, since, now: new Date() });
  }, [q.data]);

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

      {q.isError && <Card><Empty>Could not load the report. Refresh to try again.</Empty></Card>}
      {q.isPending && <Card><Empty>Loading reporting…</Empty></Card>}

      {overview && (
        <>
          <div className="stat-grid">
            <Stat label="Active memberships" value={String(overview.activeMemberships)} />
            <Stat label="Est. MRR" value={reportMoney(overview.mrr)} />
            <Stat label="Average class fill" value={`${overview.avgFill}%`} />
            <Stat label="Attendance rate" value={`${overview.attendanceRate}%`} />
            <Stat label="New members" value={String(overview.newMembers)} />
            <Stat label="Class attendances" value={String(overview.attendances)} />
            <Stat label="No-shows" value={String(overview.noShows)} />
            <Stat label="Sessions analysed" value={String(overview.sessions)} />
          </div>

          <div className="report-cols">
            <Card>
              <SectionTitle title="What is busiest?" action={<span className="muted">Average utilisation</span>} />
              <Bars rows={overview.byDay} suffix="%" label="Busiest days" />
              <div className="bars-gap" />
              <Bars rows={overview.byBand} suffix="%" label="Busiest times of day" />
            </Card>
            <Card>
              <SectionTitle title="Membership mix" />
              {overview.planMix.length ? <Bars rows={overview.planMix} label="Active memberships by plan" /> : <Empty>No membership plans yet.</Empty>}
            </Card>
          </div>

          <Card>
            <SectionTitle title="More reports" />
            <p className="muted">
              Detailed tabs for memberships, classes, members and payments, the report library and CSV or Excel
              exports are still on the old page while they move over.
            </p>
            <LinkButton href={links.reports}>Open the detailed reports</LinkButton>
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="stat">
      <div className="muted">{label}</div>
      <div className="stat-num">{value}</div>
    </Card>
  );
}

function Bars({ rows, suffix = '', label }: { rows: { label: string; value: number }[]; suffix?: string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bar-list" role="list" aria-label={label}>
      {rows.map((r) => (
        <div className="bar-row" role="listitem" key={r.label}>
          <div className="bar-label">{r.label}</div>
          <div className="track" aria-hidden="true"><div className="fill" style={{ width: `${barWidth(r.value, max)}%` }} /></div>
          <b>{r.value}{suffix}</b>
        </div>
      ))}
    </div>
  );
}
