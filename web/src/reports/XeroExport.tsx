import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { LibraryData } from '../data/reportLibrary';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Field, FieldRow, Input } from '../ui/Field';
import { pounds, type LibraryContext } from './library';
import { DataTable } from './DataTable';
import { DownloadButtons } from './DownloadButtons';
import { DEFAULT_XERO, validateXero, xeroInvoices, xeroPayments, xeroSummary, type XeroSettings } from './xero';

const PREVIEW = 5;

/** What this browser remembers for this gym (the defaults when nothing, or something unreadable, is stored). */
function readStored(key: string): XeroSettings {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...DEFAULT_XERO, ...(JSON.parse(raw) as Partial<XeroSettings>) } : DEFAULT_XERO;
  } catch {
    return DEFAULT_XERO; // storage blocked or the value is unreadable
  }
}

/** The boxes are remembered in this browser for this gym, so the accountant's values are typed once. */
function useStoredSettings(gymId: string): [XeroSettings, (s: XeroSettings) => void] {
  const key = `hybridone.xero.${gymId}`;
  const [settings, setSettings] = useState<XeroSettings>(() => readStored(key));
  const save = (s: XeroSettings) => {
    setSettings(s);
    try {
      window.localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* the page still works without remembering */
    }
  };
  return [settings, save];
}

/** Two files for the accountant: sales invoices (one per payment received) and payments received. */
export function XeroExport({ d, rangeLabel, since }: { d: LibraryData; rangeLabel: string; since: string | null }) {
  const { gym } = useReadyAuth();
  const [settings, setSettings] = useStoredSettings(gym.gymId);
  const check = validateXero(settings);
  const summary = xeroSummary(d, since);
  const ctx = (): LibraryContext => ({ gymName: gym.gymName, rangeLabel, now: new Date(), since });
  const set = <K extends keyof XeroSettings>(k: K, v: string) => setSettings({ ...settings, [k]: v });
  const preview = check.ok ? xeroInvoices(ctx(), d, check.values) : null;

  return (
    <>
      <Card>
        <SectionTitle title="Accounting export for Xero" action={<span className="muted">{rangeLabel}</span>} />
        <p className="muted">
          Two files to give to your accountant or bring into Xero yourself. They cover the payments received in the period chosen at the top of this page.
        </p>
        <div className="stat-grid">
          <div className="card stat"><span className="muted">Payments received</span><span className="stat-num">{summary.count}</span></div>
          <div className="card stat"><span className="muted">Total received</span><span className="stat-num">{pounds(summary.totalPence)}</span></div>
        </div>
        {summary.unnamed > 0 && (
          <p className="msg error" role="status">{summary.unnamed} {summary.unnamed === 1 ? 'payment has' : 'payments have'} no member name on file, so {summary.unnamed === 1 ? 'it appears' : 'they appear'} as "Member". Check before importing.</p>
        )}
      </Card>

      <Card>
        <SectionTitle title="Your Xero details" />
        <p className="muted small">Your accountant can tell you these. They are remembered in this browser.</p>
        <FieldRow>
          <Field label="Sales account code" htmlFor="xero-account" hint="From Xero's chart of accounts, for example 200.">
            <Input id="xero-account" value={settings.accountCode} placeholder="200" onChange={(e) => set('accountCode', e.target.value)} />
          </Field>
          <Field label="Tax type" htmlFor="xero-tax" hint="Exactly as Xero names it, for example 20% (VAT on Income) or No VAT.">
            <Input id="xero-tax" value={settings.taxType} placeholder="No VAT" onChange={(e) => set('taxType', e.target.value)} />
          </Field>
          <Field label="VAT included in payments (%)" htmlFor="xero-vat" hint="0 if there is no VAT. Otherwise the invoice shows the amount before VAT.">
            <Input id="xero-vat" type="number" inputMode="decimal" min="0" max="100" value={settings.vatRate} onChange={(e) => set('vatRate', e.target.value)} />
          </Field>
          <Field label="Invoice numbers start with" htmlFor="xero-prefix" hint="Letters, numbers and dashes.">
            <Input id="xero-prefix" value={settings.prefix} onChange={(e) => set('prefix', e.target.value)} />
          </Field>
        </FieldRow>
      </Card>

      <div className="report-cols">
        <Card>
          <SectionTitle title="Sales invoices" />
          <p className="muted small">One invoice per payment received, in Xero's sales invoice import layout.</p>
          {check.ok ? (
            <DownloadButtons gymName={gym.gymName} formats={['csv']} build={() => xeroInvoices(ctx(), d, check.values)} />
          ) : (
            <p className="msg error" role="status">{check.message}</p>
          )}
        </Card>
        <Card>
          <SectionTitle title="Payments received" />
          <p className="muted small">One line per payment, to match against your bank feed. Also works as a bank statement import.</p>
          <DownloadButtons gymName={gym.gymName} formats={['csv']} build={() => xeroPayments(ctx(), d)} />
        </Card>
      </div>

      {preview && (
        <Card>
          <SectionTitle title="Preview of the sales invoices" action={<span className="muted">first {Math.min(PREVIEW, preview.rows.length)} of {preview.rows.length}</span>} />
          {preview.rows.length === 0 ? <Empty>No payments received in this period.</Empty> : <DataTable table={{ ...preview, rows: preview.rows.slice(0, PREVIEW).map((r) => r.slice(0, 18).filter((_, i) => [0, 10, 11, 12, 15, 16, 17].includes(i))), headers: preview.headers.filter((_, i) => [0, 10, 11, 12, 15, 16, 17].includes(i)) }} />}
        </Card>
      )}
    </>
  );
}
