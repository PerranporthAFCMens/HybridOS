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
