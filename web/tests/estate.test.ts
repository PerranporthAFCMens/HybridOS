import { describe, expect, it } from 'vitest';
import { buildEstate, estateGyms, estateTable, runsEstate } from '../src/estate/calc';

const now = new Date('2026-10-15T12:00:00Z');
const input = {
  gyms: [{ gymId: 'a', gymName: 'Alpha' }, { gymId: 'b', gymName: 'Beta' }],
  people: [
    { gymId: 'a', role: 'member' as const, joinedAt: '2026-10-10T00:00:00Z' },
    { gymId: 'a', role: 'member' as const, joinedAt: '2026-01-01T00:00:00Z' },
    { gymId: 'a', role: 'coach' as const, joinedAt: '2026-01-01T00:00:00Z' },
    { gymId: 'b', role: 'owner' as const, joinedAt: '2026-01-01T00:00:00Z' },
    { gymId: 'b', role: 'member' as const, joinedAt: '2026-10-14T00:00:00Z' },
  ],
  memberships: [{ gymId: 'a', planId: 'p1' }, { gymId: 'a', planId: 'p2' }, { gymId: 'b', planId: 'p1' }, { gymId: 'b', planId: 'none' }],
  plans: [{ id: 'p1', priceInPence: 4500, interval: 'monthly' }, { id: 'p2', priceInPence: 12000, interval: 'annual' }],
};

describe('estate', () => {
  it('works out each gym and the total', () => {
    const e = buildEstate(input, now);
    expect(e.gyms[0]).toMatchObject({ members: 2, activeMemberships: 2, monthlyIncome: 5500, newMembers: 1, staff: 1 });
    expect(e.gyms[1]).toMatchObject({ members: 1, activeMemberships: 2, monthlyIncome: 4500, newMembers: 1, staff: 1 });
    expect(e.total).toEqual({ members: 3, activeMemberships: 4, monthlyIncome: 10000, newMembers: 2, staff: 2 });
  });
  it('is only for owners and admins of two or more gyms', () => {
    expect(runsEstate([{ role: 'owner' }, { role: 'admin' }])).toBe(true);
    expect(runsEstate([{ role: 'owner' }, { role: 'member' }])).toBe(false);
    expect(runsEstate([{ role: 'staff' }, { role: 'coach' }, { role: 'owner' }])).toBe(false);
    expect(estateGyms([{ role: 'owner' }, { role: 'coach' }])).toEqual([{ role: 'owner' }]);
  });
  it('makes a download table with an all-gyms row', () => {
    const t = estateTable({ gymName: 'All gyms', now }, buildEstate(input, now));
    expect(t.rows.at(-1)?.[0]).toBe('All gyms');
    expect(t.rows).toHaveLength(3);
  });
});
