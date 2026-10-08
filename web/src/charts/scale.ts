// The small bits of chart arithmetic, kept pure so they are unit tested.

/** Clean whole-number tick values from 0 up to just above `max` (for example 0, 5, 10, 15, 20). Always includes 0. */
export function niceTicks(max: number, approx = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const rough = max / approx;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  // Everything charted here is a whole number (people, classes, pounds), so a step is never less than 1.
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** 1,284 / 12.9K / 4.2M for axis labels and tight spaces. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${trim(n / 1e6)}M`;
  if (a >= 1e4) return `${trim(n / 1e3)}K`;
  return Math.round(n).toLocaleString('en-GB');
}
function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** Every k-th label so labels of the given width fit in slots of the given width (always shows the first). */
export function labelStep(slotWidth: number, labelWidth: number): number {
  if (slotWidth <= 0) return 1;
  return Math.max(1, Math.ceil((labelWidth + 6) / slotWidth));
}

/** A column with only the top corners rounded (the data end); the baseline end stays square. */
export function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** A donut slice as an SVG path between two angles (radians, 0 at the top, clockwise). */
export function arcPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  const pt = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(rOuter, a0)}A${rOuter},${rOuter} 0 ${large} 1 ${pt(rOuter, a1)}L${pt(rInner, a1)}A${rInner},${rInner} 0 ${large} 0 ${pt(rInner, a0)}Z`;
}

/** Shares of a total as whole percentages that always add up to 100 (largest remainder). */
export function shares(values: number[]): number[] {
  const total = values.reduce((n, v) => n + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((n, v) => n + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i] = (floor[i] ?? 0) + 1;
    left--;
  }
  return floor;
}

/**
 * Start and end angle of each slice of a ring (radians, clockwise from the top), leaving `gap` radians
 * between neighbours. A single slice fills the ring with no gap. Zero-value slices get no angle span.
 */
export function sliceAngles(values: number[], gap: number): { a0: number; a1: number }[] {
  const total = values.reduce((n, v) => n + v, 0);
  const visible = values.filter((v) => v > 0).length;
  const half = visible > 1 ? gap / 2 : 0;
  let start = 0;
  return values.map((v) => {
    const span = total ? (v / total) * Math.PI * 2 : 0;
    const out = { a0: start + half, a1: start + span - half };
    start += span;
    return out;
  });
}
