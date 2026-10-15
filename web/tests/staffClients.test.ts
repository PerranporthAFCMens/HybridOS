import { describe, expect, it } from 'vitest';
import { addable, clientLine, sortClients, type ClientSummary } from '../src/staffapp/clientsCalc';

const now = new Date('2026-10-15T12:00:00Z');
const base: ClientSummary = { userId: 'u', name: 'Sam', waiting: 0, needsReply: 0, pain: false, lastDoneAt: null, lastSetAt: null };
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

describe('clientLine', () => {
  it('puts what needs the PT first', () => {
    expect(clientLine({ ...base, needsReply: 1, waiting: 2 }, now)).toBe('Finished a workout, needs your reply');
    expect(clientLine({ ...base, needsReply: 2 }, now)).toBe('Finished a workout (2), needs your reply');
    expect(clientLine({ ...base, needsReply: 1, pain: true }, now)).toBe('Finished a workout, needs your reply. Pain noted');
  });
  it('says what is waiting for the client', () => {
    expect(clientLine({ ...base, waiting: 1 }, now)).toBe('1 workout waiting for them');
    expect(clientLine({ ...base, waiting: 3 }, now)).toBe('3 workouts waiting for them');
  });
  it('says nothing set yet when nothing was ever set', () => {
    expect(clientLine(base, now)).toBe('Nothing set yet');
  });
  it('says how recent the last workout was, and when it has gone quiet', () => {
    expect(clientLine({ ...base, lastSetAt: daysAgo(5), lastDoneAt: daysAgo(2) }, now)).toBe('Last workout 2 days ago');
    expect(clientLine({ ...base, lastSetAt: daysAgo(0), lastDoneAt: daysAgo(3) }, now)).toBe('Last set today');
    expect(clientLine({ ...base, lastSetAt: daysAgo(1) }, now)).toBe('Last set yesterday');
    expect(clientLine({ ...base, lastSetAt: daysAgo(16), lastDoneAt: daysAgo(15) }, now)).toBe('Quiet for 2 weeks');
  });
});

describe('sortClients', () => {
  it('lists clients who need a reply first, then by name', () => {
    const list = [{ ...base, userId: 'a', name: 'Zed' }, { ...base, userId: 'b', name: 'amy' }, { ...base, userId: 'c', name: 'Yan', needsReply: 1 }];
    expect(sortClients(list).map((c) => c.name)).toEqual(['Yan', 'amy', 'Zed']);
  });
});

describe('addable', () => {
  const all = [{ userId: 'me', name: 'Coach' }, { userId: 'a', name: 'Priya Nair' }, { userId: 'b', name: 'Sam Lee' }];
  it('leaves out the PT and anyone already a client', () => {
    expect(addable(all, ['a'], 'me', '').map((m) => m.userId)).toEqual(['b']);
  });
  it('filters by what was typed, ignoring case', () => {
    expect(addable(all, [], 'me', ' NAIR ').map((m) => m.userId)).toEqual(['a']);
  });
});
