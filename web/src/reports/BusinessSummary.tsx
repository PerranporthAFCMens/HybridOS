import type { ReactNode } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Card, SectionTitle } from '../ui/Card';
import { rangeStart, reportMoney } from './calc';
import { DownloadButtons } from './DownloadButtons';
import type { ReportTable } from './download';
import { IncomeChart, JoinsChart, MembersLineChart, PlanDonut } from './ReportCharts';
import { attentionList, summaryFigures, summaryTable } from './summary';

function Tile({ label, value, note }: { label: string; value: string; note?: string }): ReactNode {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <span className="stat-num">{value}</span>
      {note && <span className="muted small">{note}</span>}
    </div>
  );
}

/**
 * One picture of the whole business: money first, then members, then how classes are doing.
 * Class fill is deliberately near the bottom; it is not what an owner should look at first.
 */
export function BusinessSummary({ d, rangeDays, rangeLabel, onOpenTable }: { d: LibraryData; rangeDays: number; rangeLabel: string; onOpenTable: (build: () => ReportTable) => void }) {
  const { gym } = useReadyAuth();
  const now = new Date();
  const f = summaryFigures(d, rangeStart(rangeDays, now), now);
  const attention = attentionList(f);
  const cp = { d, rangeDays, rangeLabel, onOpenTable };
  return (
    <>
      <div className="download-bar">
        <DownloadButtons gymName={gym.gymName} build={() => summaryTable({ gymName: gym.gymName, rangeLabel, now: new Date() }, f)} />
      </div>

      <div className="stat-grid">
        <Tile label="Income collected" value={reportMoney(f.income)} note={rangeLabel} />
        <Tile label="Monthly income expected" value={reportMoney(f.mrr)} note="From today's memberships" />
        <Tile label="Active members" value={String(f.active)} />
        <Tile label="Member growth" value={`${f.net > 0 ? '+' : ''}${f.net}`} note={`${f.joined} joined, ${f.left} left`} />
      </div>

      <Card>
        <SectionTitle title="Needs a look" />
        {attention.length === 0 ? <p className="muted">Nothing needs attention for this period.</p> : (
          <ul className="attention">{attention.map((a) => <li key={a.text}>{a.text}</li>)}</ul>
        )}
      </Card>

      <div className="report-cols"><IncomeChart {...cp} /><MembersLineChart {...cp} /></div>
      <div className="report-cols"><JoinsChart {...cp} /><PlanDonut {...cp} /></div>

      <Card>
        <SectionTitle title="Classes" action={<span className="muted">{rangeLabel}</span>} />
        <div className="stat-grid">
          <Tile label="Average class fill" value={`${f.avgFill}%`} />
          <Tile label="Attendances" value={String(f.attendances)} />
          <Tile label="No-show rate" value={`${f.noShowRate}%`} />
          <Tile label="Classes under a third full" value={String(f.emptyClasses)} />
        </div>
      </Card>
    </>
  );
}
