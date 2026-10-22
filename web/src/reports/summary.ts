import type { LibraryData } from '../data/reportLibrary';
import { pct, reportMoney, table, type TableContext } from './calc';
import type { ReportTable } from './download';
import { inPeriod, payDate, payGroup, type Period } from './trends';
import { classesTab, membershipsTab } from './tabs';

/** The Business summary's headline figures for one date range. Money is in pence. */
export interface SummaryFigures {
  /** Paid money that came in during the range. */
  income: number;
  /** Failed or charged-back money in the range, and how many payments that is. */
  lost: number;
  lostCount: number;
  /** Estimated monthly recurring revenue from today's active memberships. */
  mrr: number;
  active: number;
  joined: number;
  left: number;
  /** Joined minus left; negative when the gym shrank. */
  net: number;
  /** How full classes were, how many people turned up, and how many classes were under a third full. */
  avgFill: number;
  attendances: number;
  noShowRate: number;
  emptyClasses: number;
}

/** The range as one period, from `since` (or the beginning of time) to the end of today. */
function wholeRange(since: string | null, now: Date): Period {
  return { label: '', start: since ?? '1970-01-01T00:00:00.000Z', end: new Date(now.getTime() + 86400000).toISOString() };
}

export function summaryFigures(d: LibraryData, since: string | null, now: Date): SummaryFigures {
  const range = wholeRange(since, now);
  const income = d.payments.filter((p) => payGroup(p.state) === 'Paid' && inPeriod(payDate(p), range)).reduce((n, p) => n + p.amountPence, 0);
  const failed = d.payments.filter((p) => payGroup(p.state) === 'Failed' && inPeriod(payDate(p), range));
  const m = membershipsTab(d, since);
  const c = classesTab(d, now);
  const joined = d.gymMembers.filter((g) => inPeriod(g.joinedAt, range)).length;
  const left = d.gymMembers.filter((g) => g.attritionOn && inPeriod(`${g.attritionOn.slice(0, 10)}T12:00:00Z`, range)).length;
  const started = d.sessions.filter((s) => new Date(s.startsAt) < now);
  const filled = (id: string) => d.bookings.filter((b) => b.sessionId === id && b.status !== 'cancelled').length;
  return {
    income,
    lost: failed.reduce((n, p) => n + p.amountPence, 0),
    lostCount: failed.length,
    mrr: m.mrr,
    active: m.active,
    joined,
    left,
    net: joined - left,
    avgFill: c.avgFill,
    attendances: c.attendances,
    noShowRate: pct(c.noShows, c.attendances + c.noShows),
    emptyClasses: started.filter((s) => s.capacity > 0 && filled(s.id) / s.capacity < 1 / 3).length,
  };
}

/** What needs a look, most important first. Empty when all is well. */
export function attentionList(f: SummaryFigures): { text: string; tab: 'owed' | 'members' | 'classes' }[] {
  const out: { text: string; tab: 'owed' | 'members' | 'classes' }[] = [];
  if (f.lostCount > 0) out.push({ text: `${f.lostCount} failed ${f.lostCount === 1 ? 'payment' : 'payments'}, ${reportMoney(f.lost)} not collected`, tab: 'owed' });
  if (f.net < 0) out.push({ text: `${Math.abs(f.net)} more ${Math.abs(f.net) === 1 ? 'member' : 'members'} left than joined`, tab: 'members' });
  if (f.emptyClasses > 0) out.push({ text: `${f.emptyClasses} ${f.emptyClasses === 1 ? 'class' : 'classes'} under a third full`, tab: 'classes' });
  return out;
}

export function summaryTable(ctx: TableContext, f: SummaryFigures): ReportTable {
  return table(ctx, 'Business summary', ['Measure', 'Value'], [
    ['Income collected', reportMoney(f.income)],
    ['Failed or charged-back', reportMoney(f.lost)],
    ['Failed payments', f.lostCount],
    ['Estimated monthly recurring revenue', reportMoney(f.mrr)],
    ['Active members', f.active],
    ['Joined', f.joined],
    ['Left', f.left],
    ['Net growth', f.net],
    ['Average class fill (%)', f.avgFill],
    ['Class attendances', f.attendances],
    ['No-show rate (%)', f.noShowRate],
    ['Classes under a third full', f.emptyClasses],
  ]);
}
