import { describe, expect, it } from 'vitest';
import { addDays, bookedText, dayKey, sessionStatus, startOfWeek, weekColumns, weekLabel, weekSummary } from '../src/classes/calc';
import type { TimetableSession } from '../src/data/classes';

const s = (over: Partial<TimetableSession> = {}): TimetableSession => ({
  session_id: 's1', name: 'Strength', description: '', starts_at: '2026-10-07T07:30:00', ends_at: '2026-10-07T08:30:00',
  booked_count: 9, capacity: 12, spaces_left: 3, is_cancelled: false, availability_note: '', my_booking_status: '', bookable_for_me: true,
  reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0, staffNames: [], ...over,
});

describe('weeks', () => {
  it('starts the week on Monday', () => {
    // Wed 7 Oct 2026 and Sun 11 Oct 2026 are both in the week of Mon 5 Oct
    expect(dayKey(startOfWeek(new Date(2026, 9, 7, 15, 0)))).toBe('2026-10-05');
    expect(dayKey(startOfWeek(new Date(2026, 9, 11, 23, 59)))).toBe('2026-10-05');
    expect(dayKey(startOfWeek(new Date(2026, 9, 5, 0, 0)))).toBe('2026-10-05');
    expect(dayKey(startOfWeek(new Date(2026, 9, 12, 0, 0)))).toBe('2026-10-12');
  });
  it('labels the week and moves by days across a month end', () => {
    expect(weekLabel(new Date(2026, 9, 5))).toBe('5 Oct – 11 Oct');
    expect(dayKey(addDays(new Date(2026, 9, 26), 7))).toBe('2026-11-02');
  });
});

describe('weekColumns', () => {
  const start = new Date(2026, 9, 5);
  const now = new Date(2026, 9, 7, 12, 0);
  const cols = weekColumns(start, [
    s({ session_id: 'late', starts_at: '2026-10-07T18:00:00', ends_at: '2026-10-07T19:00:00' }),
    s({ session_id: 'early' }),
    s({ session_id: 'sun', starts_at: '2026-10-11T10:00:00', ends_at: '2026-10-11T11:00:00' }),
    s({ session_id: 'next-week', starts_at: '2026-10-12T10:00:00', ends_at: '2026-10-12T11:00:00' }),
  ], now);
  it('gives seven days Monday to Sunday and marks today', () => {
    expect(cols.map((c) => c.key)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(cols.filter((c) => c.isToday).map((c) => c.key)).toEqual(['2026-10-07']);
  });
  it('puts each class on its day in start order and ignores other weeks', () => {
    expect(cols[2]?.sessions.map((x) => x.session_id)).toEqual(['early', 'late']);
    expect(cols[6]?.sessions.map((x) => x.session_id)).toEqual(['sun']);
    expect(cols.flatMap((c) => c.sessions).length).toBe(3);
  });
});

describe('status wording', () => {
  it('cancelled beats everything', () => expect(sessionStatus(s({ is_cancelled: true, my_booking_status: 'booked' }))).toEqual({ text: 'Cancelled', tone: 'warn' }));
  it('booked', () => expect(sessionStatus(s({ my_booking_status: 'booked' }))).toEqual({ text: 'Booked', tone: 'good' }));
  it('uses the availability note, else the spaces left', () => {
    expect(sessionStatus(s({ availability_note: 'Premium only' })).text).toBe('Premium only');
    expect(sessionStatus(s()).text).toBe('3 spaces left');
  });
  it('flags reserved spaces', () => expect(sessionStatus(s({ reserved_capacity: 2 })).tone).toBe('warn'));
  it('counts and summarises', () => {
    expect(bookedText(s())).toBe('9/12 booked');
    expect(weekSummary([s(), s({ is_cancelled: true })])).toBe('1 class · 1 cancelled');
    expect(weekSummary([s(), s()])).toBe('2 classes');
    expect(weekSummary([])).toBe('0 classes');
  });
});

import { CLASS_FORM_ERROR, RELEASE_OPTIONS, emptyClassForm, reservedExample, validateClass } from '../src/classes/calc';

describe('validateClass', () => {
  const good = { ...emptyClassForm(new Date(2026, 9, 7)), name: ' Hybrid Conditioning ', date: '2026-10-10', start: '09:30', duration: '45', capacity: '10', reserved: '4', description: ' Bring water ' };
  it('starts from the old page defaults', () => {
    const f = emptyClassForm(new Date(2026, 9, 7));
    expect([f.date, f.start, f.duration, f.capacity, f.reserved, f.release]).toEqual(['2026-10-07', '18:00', '60', '20', '0', '']);
  });
  it('builds the exact values to save', () => {
    const r = validateClass({ ...good, release: '120' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const starts = new Date(2026, 9, 10, 9, 30);
    expect(r.values).toEqual({
      name: 'Hybrid Conditioning', description: 'Bring water', startsAt: starts.toISOString(), endsAt: new Date(starts.getTime() + 45 * 60000).toISOString(),
      capacity: 10, reservedCapacity: 4, releaseMinutesBefore: 120,
    });
  });
  it('keeps reserved spaces until the start when no release time is chosen; blank description is null', () => {
    const r = validateClass({ ...good, release: '', description: '  ' });
    expect(r.ok && [r.values.releaseMinutesBefore, r.values.description]).toEqual([null, null]);
  });
  it.each([
    ['no name', { name: '  ' }], ['no date', { date: '' }], ['no start', { start: '' }],
    ['duration too short', { duration: '4' }], ['duration too long', { duration: '481' }], ['duration blank', { duration: '' }], ['duration not a number', { duration: 'abc' }],
    ['capacity zero', { capacity: '0' }], ['capacity fraction', { capacity: '2.5' }], ['reserved negative', { reserved: '-1' }],
    ['reserved fraction', { reserved: '1.5' }], ['reserved above capacity', { reserved: '11' }],
  ])('refuses %s', (_label, over) => {
    expect(validateClass({ ...good, ...over })).toEqual({ ok: false, message: CLASS_FORM_ERROR });
  });
  it('allows reserved equal to capacity and the 5 and 480 minute limits', () => {
    expect(validateClass({ ...good, reserved: '10' }).ok).toBe(true);
    expect(validateClass({ ...good, duration: '5' }).ok).toBe(true);
    expect(validateClass({ ...good, duration: '480' }).ok).toBe(true);
  });
  it('words the example and lists the release choices as before', () => {
    expect(reservedExample(20, 5)).toBe('Example: capacity 20 + 5 reserved means standard members can fill up to 15 places, while eligible premium plans can still book into the final 5.');
    expect(RELEASE_OPTIONS.map(([v]) => v)).toEqual(['', '1440', '720', '120', '60', '30']);
  });
});

import { STAFF_STATUS_TEXT, londonParts, requirementsText, staffStatus } from '../src/classes/calc';
import type { SchedulingRules } from '../src/data/classes';

describe('gym rules: who may teach, what a class needs', () => {
  const rules: SchedulingRules = {
    requirements: [
      { classTypeId: 'spin', capabilityId: 'cap-spin', resourceId: null, quantity: 1 },
      { classTypeId: 'spin', capabilityId: null, resourceId: 'studio', quantity: 1 },
      { classTypeId: 'spin', capabilityId: null, resourceId: 'bike', quantity: 12 },
      { classTypeId: 'yoga', capabilityId: null, resourceId: 'studio', quantity: 1 },
    ],
    capabilities: [{ id: 'cap-spin', name: 'Spin instructor' }],
    resources: [{ id: 'studio', name: 'Studio A', type: 'room', capacity: 20 }, { id: 'bike', name: 'Spin bike', type: 'equipment', capacity: 12 }],
    qualifications: [
      { userId: 'ann', capabilityId: 'cap-spin', qualified: true, expiresOn: null },
      { userId: 'bob', capabilityId: 'cap-spin', qualified: true, expiresOn: '2026-10-01' },
      { userId: 'cat', capabilityId: 'cap-spin', qualified: false, expiresOn: null },
    ],
    hours: ['ann', 'bob', 'cat', 'dan'].map((userId) => ({ userId, weekday: 3, startTime: '09:00:00', endTime: '20:00:00', isWorking: true })),
  };
  // Wed 7 Oct 2026, BST: 17:30Z is 18:30 in the gym
  const start = new Date('2026-10-07T17:30:00Z');
  const end = new Date('2026-10-07T18:30:00Z');

  it('reads the gym clock in UK time', () => {
    expect(londonParts(start)).toEqual({ weekday: 3, date: '2026-10-07', time: '18:30:00' });
    expect(londonParts(new Date('2026-01-04T23:30:00Z'))).toEqual({ weekday: 0, date: '2026-01-04', time: '23:30:00' });
    // 23:30Z in summer is 00:30 the next day in the gym
    expect(londonParts(new Date('2026-07-01T23:30:00Z'))).toEqual({ weekday: 4, date: '2026-07-02', time: '00:30:00' });
  });
  it('a qualified person working that evening is available', () => expect(staffStatus('ann', 'spin', start, end, rules)).toBe('ok'));
  it('an expired qualification, or a withdrawn one, or none at all, is not qualified', () => {
    expect(staffStatus('bob', 'spin', start, end, rules)).toBe('not-qualified');
    expect(staffStatus('cat', 'spin', start, end, rules)).toBe('not-qualified');
    expect(staffStatus('dan', 'spin', start, end, rules)).toBe('not-qualified');
  });
  it('a qualification is fine on its last day', () => {
    const r = { ...rules, qualifications: [{ userId: 'bob', capabilityId: 'cap-spin', qualified: true, expiresOn: '2026-10-07' }] };
    expect(staffStatus('bob', 'spin', start, end, r)).toBe('ok');
  });
  it('outside working hours: too late, wrong day, or not working', () => {
    expect(staffStatus('ann', 'spin', new Date('2026-10-07T19:30:00Z'), new Date('2026-10-07T20:30:00Z'), rules)).toBe('outside-hours'); // 20:30 to 21:30
    expect(staffStatus('ann', 'spin', new Date('2026-10-08T17:30:00Z'), new Date('2026-10-08T18:30:00Z'), rules)).toBe('outside-hours'); // Thursday
    const off = { ...rules, hours: [{ userId: 'ann', weekday: 3, startTime: '09:00:00', endTime: '20:00:00', isWorking: false }] };
    expect(staffStatus('ann', 'spin', start, end, off)).toBe('outside-hours');
  });
  it('a class type with no qualification asks nothing of anyone but still needs working hours; a custom class asks nothing', () => {
    expect(staffStatus('dan', 'yoga', start, end, rules)).toBe('ok');
    expect(staffStatus('nobody', null, start, end, rules)).toBe('ok');
    expect(staffStatus('nobody', 'yoga', start, end, rules)).toBe('outside-hours');
  });
  it('says what a class type needs, in words', () => {
    expect(requirementsText('spin', rules)).toBe('Qualification: Spin instructor · Needs: Studio A, 12 × Spin bike');
    expect(requirementsText('yoga', rules)).toBe('Needs: Studio A');
    expect(requirementsText('empty', rules)).toBe('This class type has no qualification, room or equipment requirements.');
    expect(requirementsText(null, rules)).toContain('no qualification, room or equipment checks');
    expect(STAFF_STATUS_TEXT['not-qualified']).toBe('Not qualified');
  });
});
