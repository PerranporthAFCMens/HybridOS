import { useId, useState, type ReactNode } from 'react';

export interface LegendItem { name: string; color: string }

export interface TableView { headers: string[]; rows: (string | number)[][] }

/**
 * What every chart has around it: a legend when there is more than one series (a single series is named
 * by the title), and a "View as table" button so every value can be read without hovering or seeing colour.
 */
export function ChartShell({ label, legend, table, children }: { label: string; legend: LegendItem[]; table: TableView; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <figure className="chart" aria-label={label}>
      {legend.length > 1 && (
        <ul className="chart-legend" aria-label="Key">
          {legend.map((l) => (
            <li key={l.name}><span className="chart-swatch" style={{ background: l.color }} aria-hidden="true" />{l.name}</li>
          ))}
        </ul>
      )}
      {children}
      <div className="chart-table-toggle">
        <button type="button" className="chart-link" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide table' : 'View as table'}
        </button>
      </div>
      {open && (
        <div className="table-wrap" id={id} role="region" aria-label={`${label}, as a table`} tabIndex={0}>
          <table className="table">
            <thead><tr>{table.headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export interface TipRow { color: string; name: string; value: string }

/** The hover and focus readout: the value leads, the series name follows, a short colour key marks each row. */
export function Tooltip({ x, y, title, rows, width }: { x: number; y: number; title: string; rows: TipRow[]; width: number }) {
  const right = x > width / 2;
  return (
    <div className="chart-tip" role="status" style={{ left: right ? undefined : x + 12, right: right ? width - x + 12 : undefined, top: Math.max(0, y) }}>
      <div className="chart-tip-title">{title}</div>
      {rows.map((r) => (
        <div className="chart-tip-row" key={r.name}>
          <span className="chart-key" style={{ background: r.color }} aria-hidden="true" />
          <b>{r.value}</b>
          <span>{r.name}</span>
        </div>
      ))}
    </div>
  );
}
