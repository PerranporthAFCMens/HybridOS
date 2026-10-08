import { describe, expect, it } from 'vitest';
import { diffRequirements, emptyTypeForm, formFromType, levelLabel, needsText, typeFacts, validateType } from '../src/classsetup/calc';
import type { ClassTypeFull, RequirementRow, SetupData } from '../src/data/classSetup';

const type = (over: Partial<ClassTypeFull> = {}): ClassTypeFull => ({ id: 't1', name: 'Spin', description: 'Indoor cycling', level: 'beginner', durationMinutes: 45, defaultCapacity: 12, dropInPence: 800, isActive: true, ...over });
const req = (over: Partial<RequirementRow>): RequirementRow => ({ id: 'r', classTypeId: 't1', capabilityId: null, resourceId: null, quantity: 1, ...over });
const data: Pick<SetupData, 'requirements' | 'capabilities' | 'resources'> = {
  requirements: [req({ id: 'a', capabilityId: 'cap' }), req({ id: 'b', resourceId: 'studio' }), req({ id: 'c', resourceId: 'bike', quantity: 12 }), req({ id: 'd', classTypeId: 't2', resourceId: 'sled' })],
  capabilities: [{ id: 'cap', name: 'Spin instructor', description: null }],
  resources: [{ id: 'studio', name: 'Studio A', type: 'room', capacity: 20 }, { id: 'bike', name: 'Spin bike', type: 'equipment', capacity: 12 }, { id: 'sled', name: 'Sled', type: 'equipment', capacity: null }],
};

describe('validateType', () => {
  const good = { ...emptyTypeForm, name: ' Spin ', duration: '45', capacity: '12', dropIn: '8', level: 'beginner', description: ' Hi ' };
  it('starts from the old defaults', () => expect([emptyTypeForm.duration, emptyTypeForm.capacity, emptyTypeForm.dropIn, emptyTypeForm.level]).toEqual(['60', '20', '5.00', 'all_levels']));
  it('builds the exact values to save', () => {
    expect(validateType({ ...good, capabilityIds: ['cap'], resources: { studio: '1', bike: '12' } })).toEqual({
      ok: true,
      input: { name: 'Spin', description: 'Hi', level: 'beginner', durationMinutes: 45, defaultCapacity: 12, dropInPence: 800 },
      needs: [{ capabilityId: 'cap', resourceId: null, quantity: 1 }, { capabilityId: null, resourceId: 'studio', quantity: 1 }, { capabilityId: null, resourceId: 'bike', quantity: 12 }],
    });
  });
  it('a blank drop-in price means upgrade only; blank description is null', () => {
    const r = validateType({ ...good, dropIn: '', description: ' ' });
    expect(r.ok && [r.input.dropInPence, r.input.description]).toEqual([null, null]);
  });
  it('a free drop-in (0) is allowed and kept as 0', () => {
    const r = validateType({ ...good, dropIn: '0' });
    expect(r.ok && r.input.dropInPence).toBe(0);
  });
  it.each([
    ['no name', { name: '  ' }], ['duration too short', { duration: '4' }], ['duration too long', { duration: '481' }], ['duration blank', { duration: '' }], ['duration fraction', { duration: '45.5' }],
    ['capacity zero', { capacity: '0' }], ['capacity blank', { capacity: '' }], ['negative price', { dropIn: '-1' }], ['price not a number', { dropIn: 'abc' }],
    ['how many blank', { resources: { bike: '' } }], ['how many zero', { resources: { bike: '0' } }], ['how many fraction', { resources: { bike: '1.5' } }], ['how many huge', { resources: { bike: '1001' } }],
  ])('refuses %s', (_l, over) => expect(validateType({ ...good, ...over }).ok).toBe(false));
});

describe('diffRequirements', () => {
  const existing = [req({ id: 'a', capabilityId: 'cap' }), req({ id: 'b', resourceId: 'studio' }), req({ id: 'c', resourceId: 'bike', quantity: 8 })];
  it('changes nothing when nothing changed', () => {
    expect(diffRequirements(existing, [{ capabilityId: 'cap', resourceId: null, quantity: 1 }, { capabilityId: null, resourceId: 'studio', quantity: 1 }, { capabilityId: null, resourceId: 'bike', quantity: 8 }]))
      .toEqual({ insert: [], update: [], remove: [] });
  });
  it('adds what is new, updates a changed quantity, removes what was unticked, and touches nothing else', () => {
    const d = diffRequirements(existing, [{ capabilityId: null, resourceId: 'studio', quantity: 1 }, { capabilityId: null, resourceId: 'bike', quantity: 12 }, { capabilityId: null, resourceId: 'sled', quantity: 2 }]);
    expect(d).toEqual({ insert: [{ capabilityId: null, resourceId: 'sled', quantity: 2 }], update: [{ id: 'c', quantity: 12 }], remove: ['a'] });
  });
  it('removing everything removes every row; adding to nothing inserts them all', () => {
    expect(diffRequirements(existing, []).remove).toEqual(['a', 'b', 'c']);
    expect(diffRequirements([], [{ capabilityId: 'cap', resourceId: null, quantity: 1 }]).insert).toHaveLength(1);
  });
});

describe('words', () => {
  it('says what a class type needs, only for that type', () => {
    expect(needsText('t1', data)).toBe('Qualification: Spin instructor · Needs: Studio A, 12 × Spin bike');
    expect(needsText('t2', data)).toBe('Needs: Sled');
    expect(needsText('none', data)).toBe('No requirements');
  });
  it('shows the facts, including upgrade only', () => {
    expect(typeFacts(type())).toBe('45 min · 12 places · £8.00 drop-in');
    expect(typeFacts(type({ dropInPence: null }))).toBe('45 min · 12 places · upgrade only');
    expect(levelLabel('advanced')).toBe('Advanced');
    expect(levelLabel('weird')).toBe('All levels');
  });
  it('fills the form back in from a saved type', () => {
    const f = formFromType(type(), data.requirements);
    expect(f).toMatchObject({ name: 'Spin', duration: '45', capacity: '12', dropIn: '8.00', level: 'beginner', description: 'Indoor cycling', capabilityIds: ['cap'], resources: { studio: '1', bike: '12' } });
    expect(formFromType(type({ dropInPence: null }), []).dropIn).toBe('');
  });
});
