import type { Debtor, MissedPayment, SettleHow } from '../data/arrears';
import type { ReportTable } from './download';
import { table, type TableContext } from './calc';
import { pounds } from './library';

// Money owed: who is "not financial", what they owe and which payments they missed. Pure functions of plain rows,
// so they are tested without a database or a screen.

export const totalOwed = (rows: Debtor[]): number => rows.reduce((n, r) => n + r.owedPence, 0);
export const totalMissed = (rows: Debtor[]): number => rows.reduce((n, r) => n + r.missedCount, 0);

/** Narrow the list by part of a name or plan. Empty search keeps everyone. */
export function findDebtors(rows: Debtor[], search: string): Debtor[] {
  const q = search.trim().toLowerCase();
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || (r.planName ?? '').toLowerCase().includes(q)) : rows;
}

/** "insufficient_funds" -> "Insufficient funds". Plain sentences from the bank are left as they are. */
export function reasonWords(reason: string | null): string {
  const r = (reason ?? '').trim();
  if (!r) return '';
  if (/^[a-z0-9_.]+$/.test(r)) return r.replace(/[_.]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return r;
}

/** What happened to the payment, in words. */
export function stateWords(state: string): string {
  switch (state) {
    case 'failed': return 'Payment failed';
    case 'charged_back': return 'Charged back';
    case 'pending':
    case 'submitted': return 'Not received';
    default: return state.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }
}

export const HOW_WORDS: Record<SettleHow, string> = { paid: 'Paid another way', waived: 'Waived', written_off: 'Written off' };

/** "12 Oct 2026". The database sends a plain date (2026-10-12). */
export function shortDate(d: string | null): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

/** Whole days between a charge date and today (never negative). */
export function daysLate(d: string | null, now: Date): number {
  if (!d) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return 0;
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - start) / 86400000));
}

export const missedText = (n: number) => `${n} missed payment${n === 1 ? '' : 's'}`;

/** The whole list, for download. */
export function owedTable(ctx: TableContext, rows: Debtor[]): ReportTable {
  return table(ctx, 'Money owed', ['Member', 'Plan', 'Membership', 'Owed', 'Missed payments', 'Oldest missed', 'Latest reason'],
    rows.map((r) => [r.name, r.planName ?? '', r.membershipStatus ?? '', pounds(r.owedPence), r.missedCount, shortDate(r.oldestMissed), reasonWords(r.latestReason)]));
}

/** One person's missed payments, for download. */
export function missedTable(ctx: TableContext, name: string, rows: MissedPayment[]): ReportTable {
  return table(ctx, `Missed payments: ${name}`, ['Date due', 'Amount', 'What happened', 'Reason', 'Plan', 'Status', 'Note'],
    rows.map((r) => [
      shortDate(r.chargeDate), pounds(r.amountPence), stateWords(r.state), reasonWords(r.reason), r.planName ?? '',
      r.outstanding ? 'Still owed' : r.settledHow ? HOW_WORDS[r.settledHow] : '', r.settledNote ?? '',
    ]));
}

export const owedOf = (rows: MissedPayment[]): number => rows.filter((r) => r.outstanding).reduce((n, r) => n + r.amountPence, 0);
