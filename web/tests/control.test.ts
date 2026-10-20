import { describe, expect, it } from 'vitest';
import { addonStates, auditLine, newestFirst, offCount, offSummary, type Addon, type AuditEntry } from '../src/control/calc';

const cat: Addon[] = [
  { key: 'classes', name: 'Classes', description: '', optional: false, defaultOn: true },
  { key: 'community', name: 'Community', description: '', optional: true, defaultOn: true },
  { key: 'groups', name: 'Groups', description: '', optional: true, defaultOn: true },
];

describe('control', () => {
  it('marks always-on modules locked and reads off switches', () => {
    const s = addonStates(cat, { addonsOff: ['community'] });
    expect(s.map((a) => [a.key, a.on, a.locked])).toEqual([['classes', true, true], ['community', false, false], ['groups', true, false]]);
    expect(offCount(cat, { addonsOff: ['community'] })).toBe(1);
  });
  it('summarises what is off', () => {
    expect(offSummary(cat, { addonsOff: [] })).toBe('Everything on');
    expect(offSummary(cat, { addonsOff: ['community', 'groups'] })).toBe('Off: Community, Groups');
  });
  it('writes the log in plain English, newest first', () => {
    const e = (id: number, enabled: boolean): AuditEntry => ({ id, at: '2026-10-20T10:00:00Z', actor: 'a', action: 'set_gym_addon', gymId: 'g1', detail: { addon: 'community', enabled } });
    expect(auditLine(e(1, false), new Map([['g1', 'Puffin']]), new Map([['community', 'Community']]))).toBe('Community switched off for Puffin');
    expect(newestFirst([e(1, true), e(3, false), e(2, true)]).map((x) => x.id)).toEqual([3, 2, 1]);
  });
});
