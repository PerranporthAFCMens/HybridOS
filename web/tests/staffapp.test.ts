import { describe, expect, it } from 'vitest';
import { can, classCountText, dayHeading, groupByDay, nextUp } from '../src/staffapp/calc';
import type { StaffClass } from '../src/data/staffApp';

const c = (id: string, start: string, end: string): StaffClass => ({ sessionId: id, name: id, startsAt: start, endsAt: end, role: null, booked: null, capacity: null });

describe('staff app', () => {
  it('lets owners and admins do everything, and staff only what is ticked', () => {
    expect(can('owner', {}, 'mark_attendance')).toBe(true);
    expect(can('admin', {}, 'view_timetable')).toBe(true);
    expect(can('staff', { mark_attendance: true }, 'mark_attendance')).toBe(true);
    expect(can('coach', { mark_attendance: true }, 'view_timetable')).toBe(false);
    expect(can('coach', {}, 'mark_attendance')).toBe(false);
  });
  it('groups classes by day in time order', () => {
    const g = groupByDay([c('b', '2026-10-16T09:00:00Z', '2026-10-16T10:00:00Z'), c('a', '2026-10-15T18:00:00Z', '2026-10-15T19:00:00Z'), c('c', '2026-10-15T07:00:00Z', '2026-10-15T08:00:00Z')]);
    expect(g.map((x) => x.day)).toEqual(['2026-10-15', '2026-10-16']);
    expect(g[0]?.classes.map((x) => x.sessionId)).toEqual(['c', 'a']);
  });
  it('picks the next class that has not finished', () => {
    const list = [c('done', '2026-10-15T07:00:00Z', '2026-10-15T08:00:00Z'), c('now', '2026-10-15T08:30:00Z', '2026-10-15T09:30:00Z'), c('later', '2026-10-15T18:00:00Z', '2026-10-15T19:00:00Z')];
    expect(nextUp(list, new Date('2026-10-15T09:00:00Z'))?.sessionId).toBe('now');
    expect(nextUp(list, new Date('2026-10-15T20:00:00Z'))).toBeNull();
  });
  it('words counts and day headings plainly', () => {
    expect(classCountText(0)).toBe('No classes');
    expect(classCountText(1)).toBe('1 class');
    expect(classCountText(3)).toBe('3 classes');
    expect(dayHeading('2026-10-15', '2026-10-15')).toMatch(/^Today · /);
    expect(dayHeading('2026-10-16', '2026-10-15')).toMatch(/^Tomorrow · /);
  });
});
