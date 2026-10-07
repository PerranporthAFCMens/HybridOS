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
