import { useState } from 'react';
import { Button } from '../ui/Button';
import { downloadTable, fileBase, type Format, type ReportTable } from './download';

const FORMATS: [Format, string][] = [['csv', 'CSV'], ['xlsx', 'Excel'], ['pdf', 'PDF']];

/** CSV, Excel and PDF buttons for one table. `build` makes the table when a button is pressed. */
export function DownloadButtons({ gymName, build }: { gymName: string; build: () => ReportTable }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState('');
  const go = async (format: Format) => {
    setBusy(format);
    setError('');
    try {
      const table = build();
      await downloadTable(table, format, fileBase(gymName, table.title, new Date()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="download-group" role="group" aria-label="Download">
      {FORMATS.map(([f, label]) => (
        <Button key={f} onClick={() => void go(f)} disabled={busy !== null}>{busy === f ? 'Preparing…' : label}</Button>
      ))}
      {error && <span className="msg error" role="alert">{error}</span>}
    </div>
  );
}
