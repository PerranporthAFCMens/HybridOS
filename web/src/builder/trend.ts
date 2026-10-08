export interface Trend { latest: number; previous: number; pct: number | null; direction: 'up' | 'down' | 'flat' }

/** How the last figure compares with the one before it. No percentage when the earlier one was zero. */
export function trend(values: number[]): Trend | null {
  if (values.length < 2) return null;
  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  const pct = previous === 0 ? null : ((latest - previous) / Math.abs(previous)) * 100;
  const direction = latest > previous ? 'up' : latest < previous ? 'down' : 'flat';
  return { latest, previous, pct, direction };
}

/** "▲ 6.2%" style text. */
export function trendText(t: Trend): string {
  const arrow = t.direction === 'up' ? '▲' : t.direction === 'down' ? '▼' : '■';
  return t.pct === null ? `${arrow} from 0` : `${arrow} ${Math.abs(Math.round(t.pct * 10) / 10)}%`;
}

/** Points for a small line, scaled into a width by height box. */
export function sparkPath(values: number[], w: number, h: number, pad = 3): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const r = max - min || 1;
  return values.map((v, i) => `${i ? 'L' : 'M'}${((i * w) / (values.length - 1)).toFixed(1)} ${(h - pad - ((v - min) / r) * (h - pad * 2)).toFixed(1)}`).join(' ');
}
