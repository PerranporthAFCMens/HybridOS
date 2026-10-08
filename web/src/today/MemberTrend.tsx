import type { TrendPoint } from './calc';

const W = 520;
const H = 170;
const PAD = 18;

/** Line chart of live members over the last 12 months. */
export function MemberTrend({ points }: { points: TrendPoint[] }) {
  const last = points[points.length - 1];
  if (!last) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = (W - PAD * 2) / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => [PAD + i * step, H - PAD - (p.count / max) * (H - PAD * 2)] as const);
  const lastXY = xy[xy.length - 1] ?? [0, 0];
  const first = points[0];
  return (
    <svg
      className="trend-svg"
      viewBox={`0 0 ${W} ${H + 22}`}
      role="img"
      aria-label={`Active members over the last 12 months, now ${last.count}`}
    >
      <path d={`M0 ${H - PAD}H${W}M0 ${PAD}H${W}`} stroke="var(--hybrid-line)" strokeWidth="1" />
      <polyline
        fill="none"
        stroke="var(--hybrid-volt)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
      />
      <circle cx={lastXY[0].toFixed(1)} cy={lastXY[1].toFixed(1)} r="5" fill="var(--hybrid-volt)" />
      <text x={PAD} y={H + 14} fill="var(--hybrid-muted)" fontSize="12">
        {first?.label}
      </text>
      <text x={W - PAD} y={H + 14} fill="var(--hybrid-muted)" fontSize="12" textAnchor="end">
        {last.label}
      </text>
    </svg>
  );
}
