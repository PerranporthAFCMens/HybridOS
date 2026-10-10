import { describe, expect, it } from 'vitest';
import {
  availableLetters, dateInputValue, filterAndSort, initials, jumpLetter, labelStatus, nameOf, nameParts,
  paymentHint, summaryText, validateLifecycle, isTeam, showOnly, missingList, missingSummary,
} from '../src/members/calc';
import type { MemberRow } from '../src/data/members';

const m = (over: Partial<MemberRow>): MemberRow => ({
  userId: 'u', role: 'member', displayName: null, firstName: null, lastName: null, joinedAt: '2026-01-01T00:00:00', attritionOn: null, latest: null, ...over,
});
const ada = m({ userId: '1', firstName: 'Ada', lastName: 'Zane', joinedAt: '2026-03-01T00:00:00' });
const bob = m({ userId: '2', displayName: 'Bob Adams', joinedAt: '2026-05-01T00:00:00' });
const cat = m({ userId: '3', firstName: 'cat', lastName: 'Young', joinedAt: '2026-04-01T00:00:00' });
const ghost = m({ userId: '4' });
const all = [ada, bob, cat, ghost];
const ids = (rows: MemberRow[]) => rows.map((r) => r.userId);

describe('names', () => {
  it('prefers display name, then first and last, then "Member"', () => {
    expect(nameOf(bob)).toBe('Bob Adams');
    expect(nameOf(ada)).toBe('Ada Zane');
    expect(nameOf(ghost)).toBe('Member');
  });
  it('splits a display name when profile names are missing', () => {
    expect(nameParts(bob)).toEqual({ first: 'Bob', surname: 'Adams' });
    expect(nameParts(ada)).toEqual({ first: 'Ada', surname: 'Zane' });
  });
  it('builds initials and labels', () => {
    expect(initials('Bob Adams')).toBe('BA');
    expect(initials('')).toBe('H');
    expect(labelStatus('pending_payment')).toBe('pending payment');
    expect(labelStatus(null)).toBe('pending');
  });
});

describe('directory', () => {
  it('sorts by first name, case-insensitively', () => {
    expect(ids(filterAndSort(all, { search: '', sort: 'first', letter: '' }))).toEqual(['1', '2', '3', '4']);
  });
  it('sorts by surname', () => {
    expect(ids(filterAndSort(all, { search: '', sort: 'surname', letter: '' }))).toEqual(['2', '4', '3', '1']);
  });
  it('sorts by date registered', () => {
    expect(ids(filterAndSort(all.slice(0, 3), { search: '', sort: 'registered_desc', letter: '' }))).toEqual(['2', '3', '1']);
    expect(ids(filterAndSort(all.slice(0, 3), { search: '', sort: 'registered_asc', letter: '' }))).toEqual(['1', '3', '2']);
  });
  it('searches by any part of the name', () => {
    expect(ids(filterAndSort(all, { search: 'adam', sort: 'first', letter: '' }))).toEqual(['2']);
    expect(ids(filterAndSort(all, { search: '  YOUNG ', sort: 'first', letter: '' }))).toEqual(['3']);
  });
  it('filters by jump letter for the chosen sort', () => {
    expect(ids(filterAndSort(all, { search: '', sort: 'first', letter: 'C' }))).toEqual(['3']);
    expect(ids(filterAndSort(all, { search: '', sort: 'surname', letter: 'A' }))).toEqual(['2']);
    expect(jumpLetter(ghost, 'first')).toBe('M');
    expect([...availableLetters(all, 'first')].sort()).toEqual(['A', 'B', 'C', 'M']);
  });
  it('words the summary', () => {
    expect(summaryText(4, 4)).toBe('4 gym users');
    expect(summaryText(1, 4)).toBe('1 of 4 gym users');
  });
});

describe('record forms', () => {
  it('validates lifecycle dates', () => {
    expect(validateLifecycle('', '')).toBe('Joined date is required.');
    expect(validateLifecycle('2026-05-02', '2026-05-01')).toBe('Attrition cannot be before joined date.');
    expect(validateLifecycle('2026-05-01', '')).toBeNull();
    expect(validateLifecycle('2026-05-01', '2026-05-01')).toBeNull();
  });
  it('formats a date input value and payment hints', () => {
    expect(dateInputValue('2026-03-09T00:00:00')).toBe('2026-03-09');
    expect(dateInputValue(null)).toBe('');
    expect(paymentHint('manual')).toMatch(/Manual mode/);
    expect(paymentHint('gocardless')).toMatch(/GoCardless mandate/);
  });
});

describe('team members in the directory', () => {
  const boss = m({ userId: '9', role: 'owner', firstName: 'Pat' });
  it('shows everyone, only members, or only the team', () => {
    expect(showOnly([ada, boss], 'all')).toHaveLength(2);
    expect(showOnly([ada, boss], 'members')).toEqual([ada]);
    expect(showOnly([ada, boss], 'team')).toEqual([boss]);
  });
  it('knows who is on the team', () => {
    expect(isTeam(boss)).toBe(true);
    expect(isTeam(ada)).toBe(false);
    expect(isTeam(m({ role: 'coach' }))).toBe(true);
  });
});

describe('missing details', () => {
  it('says how many', () => {
    expect(missingSummary(1)).toBe('1 member is missing details');
    expect(missingSummary(3)).toBe('3 members are missing details');
  });
  it('lists what is missing', () => {
    expect(missingList(['address', 'emergency contact'])).toBe('address, emergency contact');
  });
});
