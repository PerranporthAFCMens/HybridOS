import { describe, expect, it } from 'vitest';
import { PERMISSIONS, canEditLevels, deleteBlocker, mergePermissions, permissionSummary, readPermissions, tickedKeys, validateLevel } from '../src/access/calc';

describe('permissions', () => {
  it('lists the same 15 keys as the old page', () => {
    expect(PERMISSIONS.map((p) => p.key)).toEqual(['full_access', 'view_timetable', 'create_classes', 'edit_timetable', 'cancel_classes', 'mark_attendance', 'view_member_contact', 'view_memberships', 'manage_memberships', 'view_reporting', 'manage_resources', 'manage_staff', 'view_own_pay', 'view_member_notes', 'moderate_community']);
  });
  it('reads stored JSON safely', () => {
    expect(readPermissions({ full_access: true, view_timetable: 'yes', other: false })).toEqual({ full_access: true, other: false });
    expect(readPermissions(null)).toEqual({});
    expect(readPermissions([true])).toEqual({});
    expect(readPermissions('x')).toEqual({});
  });
  it('merge keeps keys the screen does not list and sets every listed key', () => {
    const merged = mergePermissions({ view_timetable: true, future_flag: true }, new Set(['create_classes']));
    expect(merged.future_flag).toBe(true);
    expect(merged.create_classes).toBe(true);
    expect(merged.view_timetable).toBe(false);
    expect(Object.keys(merged)).toHaveLength(PERMISSIONS.length + 1);
  });
  it('summarises', () => {
    expect(permissionSummary({})).toBe('No permissions');
    expect(permissionSummary({ full_access: true, view_timetable: true, nope: true })).toBe('2 of 15 permissions');
    expect([...tickedKeys({ view_reporting: true, create_classes: false })]).toEqual(['view_reporting']);
  });
});

describe('validateLevel', () => {
  const others = [{ id: 'a', name: 'Manager' }];
  const f = (name: string, description = '') => ({ name, description, ticked: [] });
  it('accepts and trims', () => {
    expect(validateLevel(f('  Coach  ', ' x '), others, null)).toEqual({ ok: true, name: 'Coach', description: 'x' });
    expect(validateLevel(f('Coach'), others, null)).toMatchObject({ description: null });
  });
  it('refuses blank, long and duplicate (case-insensitive) names', () => {
    expect(validateLevel(f(' '), others, null)).toMatchObject({ ok: false });
    expect(validateLevel(f('x'.repeat(81)), others, null)).toMatchObject({ ok: false });
    expect(validateLevel(f('manager'), others, null)).toMatchObject({ ok: false });
    expect(validateLevel(f('Manager'), others, 'a')).toMatchObject({ ok: true });
    expect(validateLevel(f('Ok', 'd'.repeat(281)), others, null)).toMatchObject({ ok: false });
  });
});

describe('rules', () => {
  it('only owners edit levels', () => {
    expect(canEditLevels('owner')).toBe(true);
    for (const r of ['admin', 'staff', 'coach', 'member']) expect(canEditLevels(r)).toBe(false);
  });
  it('blocks deleting a level that is in use', () => {
    expect(deleteBlocker(0)).toBeNull();
    expect(deleteBlocker(1)).toBe('Move 1 staff member to another level before deleting this one.');
    expect(deleteBlocker(3)).toBe('Move 3 staff members to another level before deleting this one.');
  });
});
