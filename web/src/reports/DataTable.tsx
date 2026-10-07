import type { ReportTable } from './download';

/** A report table on screen. It scrolls sideways inside its own box on a phone, never the whole page. */
export function DataTable({ table }: { table: ReportTable }) {
  if (table.rows.length === 0) return <div className="empty">Nothing to show for this.</div>;
  return (
    <div className="table-wrap" role="region" aria-label={table.title} tabIndex={0}>
      <table className="table">
        <thead>
          <tr>{table.headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
