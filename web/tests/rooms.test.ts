import { describe, expect, it } from 'vitest';
import { emptyResourceForm, formFromResource, nameTaken, resourceFacts, typeLabel, usedBy, validateQualification, validateResource, type ResourceRow } from '../src/rooms/calc';

const studio: ResourceRow = { id: 'r1', name: 'Studio A', type: 'room', capacity: 20, allowOverlap: false, notes: null, isActive: true };
const others = [{ id: 'r1', name: 'Studio A' }, { id: 'r2', name: 'Spin bike' }];

describe('resources', () => {
  it('describes a resource', () => {
    expect(resourceFacts(studio)).toBe('Room · max 20 people · one class at a time');
    expect(resourceFacts({ ...studio, type: 'equipment', capacity: null, allowOverlap: true })).toBe('Equipment · no occupancy limit · can be shared');
    expect(typeLabel('area')).toBe('Area');
    expect(typeLabel('weird')).toBe('Weird');
  });
  it('round-trips through the form', () => {
    const f = formFromResource(studio);
    expect(f).toEqual({ name: 'Studio A', type: 'room', capacity: '20', overlap: 'exclusive', notes: '' });
    const c = validateResource(f, others, 'r1');
    expect(c).toEqual({ ok: true, input: { name: 'Studio A', type: 'room', capacity: 20, allowOverlap: false, notes: null } });
  });
  it('refuses bad input', () => {
    const bad = (patch: object, selfId: string | null = null) => validateResource({ ...emptyResourceForm, name: 'New', ...patch }, others, selfId);
    expect(bad({ name: '  ' })).toMatchObject({ ok: false });
    expect(bad({ capacity: '0' })).toMatchObject({ ok: false });
    expect(bad({ capacity: '2.5' })).toMatchObject({ ok: false });
    expect(bad({ type: 'spaceship' })).toMatchObject({ ok: false });
    expect(bad({ name: 'x'.repeat(81) })).toMatchObject({ ok: false });
  });
  it('blank occupancy means no limit', () => {
    expect(validateResource({ ...emptyResourceForm, name: 'Rack', capacity: '' }, others, null)).toMatchObject({ ok: true, input: { capacity: null } });
  });
  it('refuses a duplicate name but not the item itself', () => {
    expect(nameTaken(' spin BIKE ', others, null)).toBe(true);
    expect(nameTaken('Spin bike', others, 'r2')).toBe(false);
    expect(validateResource({ ...emptyResourceForm, name: 'studio a' }, others, null)).toMatchObject({ ok: false });
  });
});

describe('qualifications', () => {
  it('validates and trims', () => {
    expect(validateQualification({ name: ' Spin instructor ', description: '  ' }, [], null)).toEqual({ ok: true, name: 'Spin instructor', description: null });
    expect(validateQualification({ name: '', description: '' }, [], null)).toMatchObject({ ok: false });
    expect(validateQualification({ name: 'spin instructor', description: '' }, [{ id: 'q1', name: 'Spin Instructor' }], null)).toMatchObject({ ok: false });
    expect(validateQualification({ name: 'Spin Instructor', description: '' }, [{ id: 'q1', name: 'Spin Instructor' }], 'q1')).toMatchObject({ ok: true });
  });
});

describe('usedBy', () => {
  const reqs = [
    { classTypeId: 't1', capabilityId: null, resourceId: 'r1' },
    { classTypeId: 't2', capabilityId: null, resourceId: 'r1' },
    { classTypeId: 't1', capabilityId: 'c1', resourceId: null },
  ];
  const types = [{ id: 't1', name: 'Spin', isActive: true }, { id: 't2', name: 'Old', isActive: false }];
  it('lists active class types that need it', () => {
    expect(usedBy('r1', 'resource', reqs, types)).toEqual(['Spin']);
    expect(usedBy('c1', 'capability', reqs, types)).toEqual(['Spin']);
    expect(usedBy('zzz', 'resource', reqs, types)).toEqual([]);
  });
});

import { hoursFromRows, validateHours } from '../src/rooms/calc';

describe('opening hours', () => {
  it('shows unsaved days as open 06:00 to 22:00 and trims seconds', () => {
    const f = hoursFromRows([{ weekday: 1, isAvailable: false, start: '09:00:00', end: '12:30:00' }]);
    expect(f[1]).toEqual({ on: false, start: '09:00', end: '12:30' });
    expect(f[0]).toEqual({ on: true, start: '06:00', end: '22:00' });
    expect(Object.keys(f)).toHaveLength(7);
  });
  it('writes all seven days', () => {
    const c = validateHours(hoursFromRows([]));
    expect(c.ok && c.rows).toHaveLength(7);
    expect(c.ok && c.rows[0]).toEqual({ weekday: 0, isAvailable: true, start: '06:00', end: '22:00' });
  });
  it('refuses an open day that finishes before it starts, or has no time', () => {
    const f = hoursFromRows([]);
    expect(validateHours({ ...f, 2: { on: true, start: '10:00', end: '09:00' } })).toEqual({ ok: false, message: 'Tuesday must finish after it starts.' });
    expect(validateHours({ ...f, 3: { on: true, start: '', end: '09:00' } })).toEqual({ ok: false, message: 'Enter an opening and closing time for Wednesday.' });
  });
  it('lets a closed day have bad times but sends defaults, since the database needs a later finish on every row', () => {
    const f = hoursFromRows([]);
    const c = validateHours({ ...f, 0: { on: false, start: '', end: '' } });
    expect(c.ok && c.rows[0]).toEqual({ weekday: 0, isAvailable: false, start: '06:00', end: '22:00' });
  });
  it('keeps the times of a closed day when they are valid', () => {
    const c = validateHours({ ...hoursFromRows([]), 5: { on: false, start: '08:00', end: '11:00' } });
    expect(c.ok && c.rows[5]).toEqual({ weekday: 5, isAvailable: false, start: '08:00', end: '11:00' });
  });
});
