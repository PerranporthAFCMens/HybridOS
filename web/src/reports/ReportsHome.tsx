import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Card, SectionTitle } from '../ui/Card';
import { rangeStart, reportMoney } from './calc';
import { listTargets } from '../data/targets';
import { DownloadButtons } from './DownloadButtons';
import type { ReportTable } from './download';
import { REPORT_LIST } from './reportList';
import { IncomeChart, JoinsChart, MembersLineChart, PlanDonut } from './ReportCharts';
import { ProgressBar } from './Targets';
import { gymProgress } from './targets';
import { attentionList, changePct, storyOf, summaryFigures, summaryTable } from './summary';
import { activeMembersSeries, incomeSeries, periodsFor } from './trends';

/** A tiny line of recent values, drawn on the tile. Decorative: the figure beside it carries the meaning. */
function Spark({ values }: { values: number[] }): ReactNode {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Delta({ now, before, label }: { now: number; before: number | null; label: string }): ReactNode {
  if (before === null) return null;
  const c = changePct(now, before);
  if (c === null) return null;
  if (c === 0) return <span className="delta muted small">No change on {label}</span>;
  return <span className={`delta small ${c > 0 ? 'up' : 'down'}`}>{c > 0 ? '▲' : '▼'} {Math.abs(c)}% on {label}</span>;
}

function Tile({ to, label, value, note, spark, children }: { to: string; label: string; value: string; note?: string; spark?: number[]; children?: ReactNode }): ReactNode {
  return (
    <Link className="card stat stat-btn tile" to={to} aria-label={`${label}: ${value}. Open the report.`}>
      <span className="muted">{label}</span>
      <span className="stat-num">{value}</span>
      {children}
      {note && <span className="muted small">{note}</span>}
      {spark && <Spark values={spark} />}
    </Link>
  );
}

/**
 * The top of the Reports page: the story in one sentence, the four figures that matter, the charts, what needs a look,
 * then the one list of every report. `d` holds twice the chosen range so this range can be compared with the one before.
 */
export function ReportsHome({ d, rangeDays, rangeLabel, period, onOpenTable }: { d: LibraryData; rangeDays: number; rangeLabel: string; period: string; onOpenTable: (build: () => ReportTable) => void }) {
  const { gym } = useReadyAuth();
  const now = useMemo(() => new Date(), []);
  const since = rangeStart(rangeDays, now);
  const f = useMemo(() => summaryFigures(d, since, now), [d, since, now]);
  const prev = useMemo(() => (since ? summaryFigures(d, rangeStart(rangeDays * 2, now), now, since) : null), [d, since, rangeDays, now]);
  const periods = useMemo(() => periodsFor(rangeDays, now), [rangeDays, now]);
  const incomeSpark = useMemo(() => incomeSeries(d, periods)[0]?.values ?? [], [d, periods]);
  const membersSpark = useMemo(() => activeMembersSeries(d, periods, now)[0]?.values ?? [], [d, periods, now]);
  const previousLabel = `the ${rangeDays} days before`;
  const story = storyOf(f, prev, previousLabel);
  const attention = attentionList(f);
  // Goals are optional: if they cannot be read (none set, or not switched on yet), the summary simply has no goals box.
  const targets = useQuery({ queryKey: ['targets', gym.gymId], queryFn: () => listTargets(gym.gymId), retry: false });
  const goals = useMemo(() => gymProgress(d, now, targets.data ?? []), [d, now, targets.data]);
  const cp = { d, rangeDays, rangeLabel, onOpenTable };
  const to = (key: string) => `?r=${key}&p=${period}`;

  return (
    <>
      <Card className="story">
        <div className="story-head">
          <SectionTitle title="How the business is doing" action={<span className="muted">{rangeLabel}</span>} />
          <DownloadButtons gymName={gym.gymName} build={() => summaryTable({ gymName: gym.gymName, rangeLabel, now: new Date() }, f)} />
        </div>
        {story ? <p className="story-text">{story}</p> : <p className="muted">Nothing to report for this period yet.</p>}
      </Card>

      <div className="stat-grid">
        <Tile to={to('payments')} label="Income collected" value={reportMoney(f.income)} spark={incomeSpark}>
          <Delta now={f.income} before={prev ? prev.income : null} label={previousLabel} />
        </Tile>
        <Tile to={to('memberships')} label="Monthly income expected" value={reportMoney(f.mrr)} note="From today's memberships" />
        <Tile to={to('memberships')} label="Active members" value={String(f.active)} spark={membersSpark} />
        <Tile to={to('members')} label="Members joined" value={String(f.joined)} note={`${f.left} left`}>
          <Delta now={f.joined} before={prev ? prev.joined : null} label={previousLabel} />
        </Tile>
      </div>

      {goals.length > 0 && (
        <Card>
          <SectionTitle title="Goals this month" action={<Link className="btn quiet" to={to('targets')}>Change goals</Link>} />
          {goals.map((p) => <ProgressBar key={p.metric} p={p} />)}
        </Card>
      )}

      {attention.length > 0 && (
        <Card>
          <SectionTitle title="Needs a look" />
          <ul className="attention-list">
            {attention.map((a) => (
              <li key={a.text}>
                <span>{a.text}</span>
                <Link className="btn" to={to(a.tab)}>Open</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="report-cols"><IncomeChart {...cp} /><MembersLineChart {...cp} /></div>
      <div className="report-cols"><JoinsChart {...cp} /><PlanDonut {...cp} /></div>

      <h2 className="list-title">All reports</h2>
      {REPORT_LIST.map((g) => (
        <section key={g.group} className="lib-group" aria-label={g.group}>
          <SectionTitle title={g.group} action={<span className="muted">{g.entries.length} {g.entries.length === 1 ? 'report' : 'reports'}</span>} />
          <ul className="report-rows">
            {g.entries.map((e) => (
              <li key={e.key}>
                <Link className="report-row" to={to(e.key)}>
                  <span className="report-row-text"><b>{e.title}</b><span className="muted small">{e.blurb}</span></span>
                  <span aria-hidden="true" className="report-row-go">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
