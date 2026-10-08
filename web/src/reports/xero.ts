import type { LibraryData, LibPayment } from '../data/reportLibrary';
import { table, ukDate } from './calc';
import type { Cell, ReportTable } from './download';
import { inRange, type LibraryContext } from './library';
import { payGroup } from './trends';

// Two files for the gym's accountant to bring into Xero:
//  * Sales invoices: one invoice per payment received, in Xero's sales invoice import layout.
//  * Payments received: one line per payment, to match against the bank feed (it also works as a bank
//    statement import).
// Pure functions of the plain rows, so they are tested without a database.

export interface XeroSettings {
  /** The gym's sales account code in Xero, for example 200. */
  accountCode: string;
  /** The tax type exactly as Xero names it, for example "20% (VAT on Income)" or "No VAT". */
  taxType: string;
  /** VAT rate in percent when payments include VAT (so the invoice can show the amount before VAT). 0 for none. */
  vatRate: string;
  /** Start of every invoice number, so numbers never clash with the gym's own. */
  prefix: string;
}

export const DEFAULT_XERO: XeroSettings = { accountCode: '', taxType: '', vatRate: '0', prefix: 'INV' };

export type XeroCheck = { ok: true; values: { accountCode: string; taxType: string; vatRate: number; prefix: string } } | { ok: false; message: string };

export function validateXero(s: XeroSettings): XeroCheck {
  const accountCode = s.accountCode.trim();
  const taxType = s.taxType.trim();
  const prefix = s.prefix.trim();
  const vatRate = Number(s.vatRate.trim() === '' ? '0' : s.vatRate);
  if (!accountCode) return { ok: false, message: 'Enter your sales account code from Xero (for example 200).' };
  if (!taxType) return { ok: false, message: 'Enter the tax type exactly as Xero names it (for example 20% (VAT on Income) or No VAT).' };
  if (!/^[A-Za-z0-9-]{1,12}$/.test(prefix)) return { ok: false, message: 'The invoice number start can be letters, numbers and dashes, up to 12 characters.' };
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return { ok: false, message: 'The VAT rate must be a number from 0 to 100.' };
  return { ok: true, values: { accountCode, taxType, vatRate, prefix } };
}

/** When a payment happened: its charge date (at midday, so the day cannot slip) or else when it was recorded. */
const dateOf = (p: LibPayment) => (p.chargeDate.length === 10 ? `${p.chargeDate}T12:00:00Z` : p.chargeDate || p.createdAt);

/** Payments that count as money received inside the range, oldest first. */
export function receivedPayments(d: LibraryData, since: string | null): LibPayment[] {
  return d.payments
    .filter((p) => payGroup(p.state) === 'Paid' && p.amountPence > 0 && inRange(since, dateOf(p)))
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || a.id.localeCompare(b.id));
}

const pounds2 = (pence: number): number => Math.round(pence) / 100;

export interface XeroSummary { count: number; totalPence: number; unnamed: number }

export function xeroSummary(d: LibraryData, since: string | null): XeroSummary {
  const rows = receivedPayments(d, since);
  return { count: rows.length, totalPence: rows.reduce((n, p) => n + p.amountPence, 0), unnamed: rows.filter((p) => !d.people.get(p.userId)).length };
}

/** The headings of Xero's sales invoice import, in its order. Starred columns are the ones Xero insists on. */
export const INVOICE_HEADERS = [
  '*ContactName', 'EmailAddress', 'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4', 'POCity', 'PORegion', 'POPostalCode', 'POCountry',
  '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount', 'Discount', '*AccountCode', '*TaxType',
  'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency', 'BrandingTheme',
] as const;

function planOf(d: LibraryData, p: LibPayment): string {
  const m = d.memberships.find((x) => x.id === p.membershipId);
  return d.plans.find((x) => x.id === m?.planId)?.name ?? '';
}

/** The amount on the invoice: the payment as taken, or the amount before VAT when the payment includes VAT. */
export function invoiceAmount(pence: number, vatRate: number): number {
  return pounds2(vatRate > 0 ? pence / (1 + vatRate / 100) : pence);
}

export function invoiceNumber(prefix: string, p: LibPayment): string {
  return `${prefix}-${dateOf(p).slice(0, 10).replace(/-/g, '')}-${p.id.replace(/-/g, '').slice(0, 8)}`;
}

/** One sales invoice per payment received, ready for Xero's import. */
export function xeroInvoices(ctx: LibraryContext, d: LibraryData, v: { accountCode: string; taxType: string; vatRate: number; prefix: string }): ReportTable {
  const rows = receivedPayments(d, ctx.since).map((p): Cell[] => {
    const date = ukDate(dateOf(p));
    const plan = planOf(d, p);
    return [
      d.people.get(p.userId)?.name ?? 'Member', '', '', '', '', '', '', '', '', '',
      invoiceNumber(v.prefix, p), plan, date, date, '', plan ? `Membership payment: ${plan}` : 'Membership payment', 1, invoiceAmount(p.amountPence, v.vatRate), '',
      v.accountCode, v.taxType, '', '', '', '', 'GBP', '',
    ];
  });
  return table(ctx, 'Xero sales invoices', [...INVOICE_HEADERS], rows);
}

/** One line per payment received, to match against the bank feed. */
export function xeroPayments(ctx: LibraryContext, d: LibraryData): ReportTable {
  const rows = receivedPayments(d, ctx.since).map((p): Cell[] => [
    ukDate(dateOf(p)), pounds2(p.amountPence), d.people.get(p.userId)?.name ?? 'Member', planOf(d, p) ? `Membership payment: ${planOf(d, p)}` : 'Membership payment', p.id.replace(/-/g, '').slice(0, 8),
  ]);
  return table(ctx, 'Xero payments received', ['*Date', '*Amount', 'Payee', 'Description', 'Reference'], rows);
}
