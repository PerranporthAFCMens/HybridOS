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

/** The range as one period, from `since` (or the beginning of time) to `end` (default: the end of today). */
function wholeRange(since: string | null, now: Date, end?: string): Period {
  return { label: '', start: since ?? '1970-01-01T00:00:00.000Z', end: end ?? new Date(now.getTime() + 86400000).toISOString() };
}

/**
 * Figures for one range. Pass `end` to look at an earlier range, such as the one before this one, for comparing.
 * Members and monthly income are "as of today" whatever the range, so they are only comparable for the current one.
 */
export function summaryFigures(d: LibraryData, since: string | null, now: Date, end?: string): SummaryFigures {
  const range = wholeRange(since, now, end);
  const sessions = d.sessions.filter((s) => inPeriod(s.startsAt, range));
  const ids = new Set(sessions.map((s) => s.id));
  d = { ...d, sessions, bookings: d.bookings.filter((b) => ids.has(b.sessionId)) };
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

/** Whole-number percentage change from `before` to `now`, or null when there was nothing before to compare with. */
export function changePct(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

/**
 * One or two plain sentences that tell the story of the range. Facts are ranked, problems first, then the biggest
 * moves against the previous range; wording is fixed and the figures are real. Blank when there is nothing to say yet.
 */
export function storyOf(f: SummaryFigures, prev: SummaryFigures | null, previousLabel: string): string {
  if (f.income === 0 && f.active === 0 && f.joined === 0 && f.left === 0 && f.lostCount === 0) return '';
  const facts: { score: number; text: string }[] = [];
  if (f.lostCount > 0) facts.push({ score: 100 + f.lost / 100, text: `${f.lostCount} ${f.lostCount === 1 ? 'payment' : 'payments'} failed (${reportMoney(f.lost)} not collected)` });
  if (f.net < 0) facts.push({ score: 80 + Math.abs(f.net), text: `${Math.abs(f.net)} more ${Math.abs(f.net) === 1 ? 'member' : 'members'} left than joined` });
  const inc = prev ? changePct(f.income, prev.income) : null;
  if (inc !== null && Math.abs(inc) >= 5) facts.push({ score: 40 + Math.min(Math.abs(inc), 50), text: `income is ${inc > 0 ? 'up' : 'down'} ${Math.abs(inc)}% on ${previousLabel} at ${reportMoney(f.income)}` });
  if (f.net > 0) facts.push({ score: 50 + f.net, text: `${f.net} more ${f.net === 1 ? 'member' : 'members'} joined than left` });
  if (f.emptyClasses > 0) facts.push({ score: 30 + f.emptyClasses, text: `${f.emptyClasses} ${f.emptyClasses === 1 ? 'class was' : 'classes were'} under a third full` });
  const top = facts.sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.text);
  if (top.length === 0) return `Steady: ${reportMoney(f.income)} collected and ${f.active} active ${f.active === 1 ? 'member' : 'members'}.`;
  const text = top.join(', and ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
