import { describe, expect, it } from 'vitest';
import type { LibraryData } from '../src/data/reportLibrary';
import type { LibraryContext } from '../src/reports/library';
import { DEFAULT_XERO, INVOICE_HEADERS, invoiceAmount, invoiceNumber, receivedPayments, validateXero, xeroInvoices, xeroPayments, xeroSummary } from '../src/reports/xero';

const NOW = new Date('2026-10-08T12:00:00Z');
const ctx = (since: string | null = null): LibraryContext => ({ gymName: 'Puffin Performance', rangeLabel: 'Test', now: NOW, since });
const V = { accountCode: '200', taxType: 'No VAT', vatRate: 0, prefix: 'INV' };

const pay = (over: Partial<LibraryData['payments'][number]>): LibraryData['payments'][number] => ({
  id: 'aaaaaaaa-1111-4111-8111-111111111111', membershipId: 'm1', userId: 'u1', chargeDate: '2026-10-01', createdAt: '2026-10-01T00:00:00Z', amountPence: 5999, state: 'paid_out', provider: 'manual', failure: '', ...over,
});

const data = (payments: LibraryData['payments']): LibraryData => ({
  plans: [{ id: 'p1', name: 'Hybrid Monthly', pricePence: 5999, interval: 'monthly', isActive: true }],
  memberships: [{ id: 'm1', userId: 'u1', planId: 'p1', status: 'active', startsOn: '', endsOn: '', provider: '', paymentStatus: '', updatedAt: '' }],
  gymMembers: [],
  people: new Map([['u1', { name: 'Amelia Hart', dateOfBirth: '', gender: '' }], ['u2', { name: '=cmd|\' /C calc\'!A0', dateOfBirth: '', gender: '' }]]),
  payments, purchases: [], assignments: [], workoutSessions: [], pt: [], sessions: [], bookings: [], staff: [], staffHours: [], sessionStaff: [],
});

describe('settings', () => {
  it('needs an account code and a tax type', () => {
    expect(validateXero(DEFAULT_XERO).ok).toBe(false);
    expect(validateXero({ ...DEFAULT_XERO, accountCode: '200' })).toMatchObject({ ok: false });
    expect(validateXero({ accountCode: '200', taxType: 'No VAT', vatRate: '', prefix: 'INV' })).toEqual({ ok: true, values: { accountCode: '200', taxType: 'No VAT', vatRate: 0, prefix: 'INV' } });
  });
  it('rejects a silly VAT rate or prefix', () => {
    const base = { accountCode: '200', taxType: 'No VAT', vatRate: '0', prefix: 'INV' };
    expect(validateXero({ ...base, vatRate: '120' }).ok).toBe(false);
    expect(validateXero({ ...base, vatRate: 'abc' }).ok).toBe(false);
    expect(validateXero({ ...base, vatRate: '-1' }).ok).toBe(false);
    expect(validateXero({ ...base, prefix: 'has space' }).ok).toBe(false);
    expect(validateXero({ ...base, prefix: '' }).ok).toBe(false);
    expect(validateXero({ ...base, vatRate: '20' })).toMatchObject({ ok: true });
  });
});

describe('which payments count', () => {
  it('only money received: paid or confirmed, more than nothing, inside the range', () => {
    const d = data([
      pay({ id: 'p-paid-1', state: 'paid_out' }),
      pay({ id: 'p-conf-2', state: 'confirmed', chargeDate: '2026-10-02' }),
      pay({ id: 'p-fail-3', state: 'failed' }),
      pay({ id: 'p-pend-4', state: 'pending' }),
      pay({ id: 'p-refu-5', state: 'refunded' }),
      pay({ id: 'p-zero-6', amountPence: 0 }),
      pay({ id: 'p-old-07', chargeDate: '2026-08-01' }),
    ]);
    expect(receivedPayments(d, null).map((p) => p.id)).toEqual(['p-old-07', 'p-paid-1', 'p-conf-2']);
    expect(receivedPayments(d, '2026-09-01T00:00:00Z').map((p) => p.id)).toEqual(['p-paid-1', 'p-conf-2']);
  });
  it('summarises the count, the total and people it cannot name', () => {
    const d = data([pay({ id: 'p1' }), pay({ id: 'p2', userId: 'ghost', amountPence: 1001 })]);
    expect(xeroSummary(d, null)).toEqual({ count: 2, totalPence: 7000, unnamed: 1 });
  });
});

describe('invoice amounts and numbers', () => {
  it('shows the payment as taken when there is no VAT', () => {
    expect(invoiceAmount(5999, 0)).toBe(59.99);
  });
  it('works back to the amount before VAT when payments include it', () => {
    expect(invoiceAmount(6000, 20)).toBe(50);
    expect(invoiceAmount(5999, 20)).toBe(49.99);
  });
  it('numbers are the prefix, the day and the start of the payment id, so they never repeat', () => {
    expect(invoiceNumber('INV', pay({}))).toBe('INV-20261001-aaaaaaaa');
    expect(invoiceNumber('GYM', pay({ id: 'bbbbbbbb-2222-4222-8222-222222222222', chargeDate: '2026-12-25' }))).toBe('GYM-20261225-bbbbbbbb');
  });
});

describe('the sales invoices file', () => {
  const d = data([pay({}), pay({ id: 'cccccccc-3333-4333-8333-333333333333', userId: 'u2', membershipId: '', chargeDate: '2026-10-03', amountPence: 4500 })]);
  const t = xeroInvoices(ctx(), d, V);
  it('uses Xero\'s own column headings, starred ones included', () => {
    expect(t.headers).toEqual([...INVOICE_HEADERS]);
    expect(t.headers).toContain('*ContactName');
    expect(t.headers).toContain('*InvoiceNumber');
    expect(t.headers).toContain('*AccountCode');
    expect(t.headers).toContain('*TaxType');
    for (const row of t.rows) expect(row).toHaveLength(t.headers.length);
  });
  it('has one invoice per payment with the account, tax type and plan filled in', () => {
    const col = (name: string) => t.headers.indexOf(name);
    expect(t.rows).toHaveLength(2);
    const r = t.rows[0] ?? [];
    expect(r[col('*ContactName')]).toBe('Amelia Hart');
    expect(r[col('*InvoiceNumber')]).toBe('INV-20261001-aaaaaaaa');
    expect(r[col('*InvoiceDate')]).toBe('01/10/2026');
    expect(r[col('*DueDate')]).toBe('01/10/2026');
    expect(r[col('*Description')]).toBe('Membership payment: Hybrid Monthly');
    expect(r[col('*Quantity')]).toBe(1);
    expect(r[col('*UnitAmount')]).toBe(59.99);
    expect(r[col('*AccountCode')]).toBe('200');
    expect(r[col('*TaxType')]).toBe('No VAT');
    expect(r[col('Currency')]).toBe('GBP');
    expect((t.rows[1] ?? [])[col('*Description')]).toBe('Membership payment');
  });
  it('is empty, with headings, when nothing was received', () => {
    expect(xeroInvoices(ctx(), data([]), V).rows).toEqual([]);
  });
});

describe('the payments received file', () => {
  it('has one line per payment, to match against the bank feed', () => {
    const t = xeroPayments(ctx(), data([pay({})]));
    expect(t.headers).toEqual(['*Date', '*Amount', 'Payee', 'Description', 'Reference']);
    expect(t.rows).toEqual([['01/10/2026', 59.99, 'Amelia Hart', 'Membership payment: Hybrid Monthly', 'aaaaaaaa']]);
  });
});
