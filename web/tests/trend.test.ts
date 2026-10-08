import { describe, expect, it } from 'vitest';
import { trend, trendText, type Trend } from '../src/builder/trend';

describe('trend', () => {
  it('needs two figures', () => { expect(trend([5])).toBeNull(); });
  it('compares the last with the one before', () => {
    const t = trend([10, 20, 22]);
    expect(t?.direction).toBe('up');
    expect(t?.pct).toBeCloseTo(10);
    expect(trendText(t as Trend)).toBe('▲ 10%');
  });
  it('shows a fall', () => { expect(trendText(trend([50, 40]) as Trend)).toBe('▼ 20%'); });
  it('has no percentage from zero', () => { expect(trendText(trend([0, 4]) as Trend)).toBe('▲ from 0'); });
});
