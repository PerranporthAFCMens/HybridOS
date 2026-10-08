import { describe, expect, it } from 'vitest';
import { DATASETS } from '../src/builder/datasets';
import { applyFilters, build, chartsAllowed, defaultSpec, filtersForGroup, monthLabel, passes, poundsToPence, rowsInGroup, sanitise, show, type Field, type Row, type Spec } from '../src/builder/engine';
import { STARTERS } from '../src/builder/starters';
import type { LibraryData } from '../src/data/reportLibrary';

const fields: Field[] = [
  { id: 'name', label: 'Member', type: 'text' },
  { id: 'date', label: 'Date', type: 'date' },
  { id: 'amount', label: 'Amount', type: 'money' },
  { id: 'plan', label: 'Plan', type: 'text' },
  { id: 'count', label: 'Count', type: 'number' },
];
const rows: Row[] = [
  { name: 'Alex', date: '2026-09-03', amount: 4500, plan: 'Monthly', count: 2 },
  { name: 'Bea', date: '2026-09-20', amount: 4500, plan: 'Monthly', count: 4 },
  { name: 'Cal', date: '2026-10-02', amount: 48000, plan: 'Annual', count: 6 },
  { name: 'Dee', date: null, amount: null, plan: '', count: null },
];
const base = (over: Partial<Spec>): Spec => ({ ...defaultSpec('x', fields), ...over });
const run = (over: Partial<Spec>) => build(base(over), rows, fields, 'T', 'S');

describe('filters', () => {
  const f = (id: string) => fields.find((x) => x.id === id);
  it('text: is, is not, contains, empty', () => {
    expect(passes(rows[0] as Row, { field: 'plan', op: 'is', value: ' monthly ' }, f('plan'))).toBe(true);
    expect(passes(rows[2] as Row, { field: 'plan', op: 'is_not', value: 'Monthly' }, f('plan'))).toBe(true);
    expect(passes(rows[1] as Row, { field: 'name', op: 'contains', value: 'ea' }, f('name'))).toBe(true);
    expect(passes(rows[3] as Row, { field: 'plan', op: 'blank', value: '' }, f('plan'))).toBe(true);
    expect(passes(rows[0] as Row, { field: 'plan', op: 'not_blank', value: '' }, f('plan'))).toBe(true);
  });
  it('money is typed in pounds and compared in pence', () => {
    expect(poundsToPence('£12.50')).toBe(1250);
    expect(poundsToPence('1,000')).toBe(100000);
    expect(poundsToPence('abc')).toBeNull();
    expect(poundsToPence('')).toBeNull();
    expect(passes(rows[2] as Row, { field: 'amount', op: 'gt', value: '100' }, f('amount'))).toBe(true);
    expect(passes(rows[0] as Row, { field: 'amount', op: 'gt', value: '100' }, f('amount'))).toBe(false);
    expect(passes(rows[0] as Row, { field: 'amount', op: 'eq', value: '45' }, f('amount'))).toBe(true);
    expect(passes(rows[3] as Row, { field: 'amount', op: 'lt', value: '100' }, f('amount'))).toBe(false);
  });
  it('dates compare as calendar days and a row with no date never matches a date condition', () => {
    expect(passes(rows[1] as Row, { field: 'date', op: 'on_or_after', value: '2026-09-20' }, f('date'))).toBe(true);
    expect(passes(rows[0] as Row, { field: 'date', op: 'on_or_after', value: '2026-09-20' }, f('date'))).toBe(false);
    expect(passes(rows[0] as Row, { field: 'date', op: 'on_or_before', value: '2026-09-03' }, f('date'))).toBe(true);
    expect(passes(rows[3] as Row, { field: 'date', op: 'on_or_after', value: '2026-01-01' }, f('date'))).toBe(false);
  });
  it('a condition with no usable value lets everything through (the screen says so)', () => {
    expect(passes(rows[0] as Row, { field: 'date', op: 'on_or_after', value: 'soon' }, f('date'))).toBe(true);
    expect(passes(rows[0] as Row, { field: 'amount', op: 'gt', value: 'lots' }, f('amount'))).toBe(true);
    expect(passes(rows[0] as Row, { field: 'nope', op: 'is', value: 'x' }, undefined)).toBe(true);
  });
  it('all filters must pass', () => {
    expect(applyFilters(rows, [{ field: 'plan', op: 'is', value: 'Monthly' }, { field: 'date', op: 'on_or_after', value: '2026-09-10' }], fields).map((r) => r.name)).toEqual(['Bea']);
  });
});

describe('list mode', () => {
  it('shows the chosen columns in order, formatted', () => {
    const b = run({ columns: ['name', 'amount', 'date'] });
    expect(b.table.headers).toEqual(['Member', 'Amount', 'Date']);
    expect(b.table.rows[0]).toEqual(['Alex', '£45.00', '03/09/2026']);
    expect(b.table.rows[3]).toEqual(['Dee', '', '']);
    expect(show(null, 'money')).toBe('');
  });
});

describe('summary mode', () => {
  it('counts rows by a field, biggest group first', () => {
    const b = run({ mode: 'summary', groupBy: 'plan', measures: [{ fn: 'count', field: null }] });
    expect(b.table.headers).toEqual(['Plan', 'Number of rows']);
    expect(b.table.rows).toEqual([['Monthly', 2], ['Annual', 1], ['Not set', 1]]);
  });
  it('totals and averages money, shown in pounds', () => {
    const b = run({ mode: 'summary', groupBy: 'plan', measures: [{ fn: 'sum', field: 'amount' }, { fn: 'avg', field: 'amount' }] });
    const monthly = b.table.rows.find((r) => r[0] === 'Monthly');
    expect(monthly).toEqual(['Monthly', '£90.00', '£45.00']);
    expect(b.measureTypes).toEqual(['money', 'money']);
  });
  it('groups dates by month, oldest first, with a Not set group last', () => {
    const b = run({ mode: 'summary', groupBy: 'date', dateBy: 'month', measures: [{ fn: 'sum', field: 'amount' }] });
    expect(b.table.rows.map((r) => r[0])).toEqual(['Sep 2026', 'Oct 2026', 'Not set']);
    expect(b.table.rows[0]?.[1]).toBe('£90.00');
    expect(monthLabel('2026-09')).toBe('Sep 2026');
  });
  it('groups dates by day', () => {
    const b = run({ mode: 'summary', groupBy: 'date', dateBy: 'day', measures: [{ fn: 'count', field: null }] });
    expect(b.table.rows[0]).toEqual(['03/09/2026', 1]);
  });
  it('min, max and one total row when nothing is grouped', () => {
    const b = run({ mode: 'summary', groupBy: null, measures: [{ fn: 'min', field: 'count' }, { fn: 'max', field: 'count' }, { fn: 'count', field: null }] });
    expect(b.table.rows).toEqual([[2, 6, 4]]);
  });
  it('respects the filters and handles no rows', () => {
    const b = run({ mode: 'summary', groupBy: 'plan', filters: [{ field: 'plan', op: 'is', value: 'nothing' }] });
    expect(b.table.rows).toEqual([]);
    expect(b.groups).toEqual([]);
  });
  it('chart groups carry the raw numbers', () => {
    const b = run({ mode: 'summary', groupBy: 'plan', measures: [{ fn: 'sum', field: 'amount' }] });
    expect(b.groups.find((g) => g.label === 'Annual')?.values).toEqual([48000]);
  });
});

describe('charts and saved specs', () => {
  it('a list or an ungrouped summary is a table only', () => {
    expect(chartsAllowed(base({ mode: 'list' }))).toEqual(['table']);
    expect(chartsAllowed(base({ mode: 'summary', groupBy: null }))).toEqual(['table']);
  });
  it('a grouped summary offers charts; a ring only for one figure', () => {
    expect(chartsAllowed(base({ mode: 'summary', groupBy: 'plan', measures: [{ fn: 'count', field: null }] }))).toEqual(['table', 'column', 'bar', 'line', 'donut']);
    expect(chartsAllowed(base({ mode: 'summary', groupBy: 'plan', measures: [{ fn: 'count', field: null }, { fn: 'sum', field: 'amount' }] }))).toEqual(['table', 'column', 'bar', 'line']);
  });
  it('a saved spec is read back safely', () => {
    const ds = [{ id: 'x', fields }];
    expect(sanitise(null, ds)).toBeNull();
    expect(sanitise({ dataset: 'gone' }, ds)).toBeNull();
    const s = sanitise({ dataset: 'x', mode: 'summary', columns: ['name', 'removed'], groupBy: 'removed', measures: [{ fn: 'sum', field: 'removed' }, { fn: 'count', field: null }], filters: [{ field: 'removed', op: 'is', value: 'a' }, { field: 'plan', op: 'is', value: 'A' }], chart: 'nope' }, ds);
    expect(s).toMatchObject({ mode: 'summary', columns: ['name'], groupBy: null, chart: 'table', measures: [{ fn: 'count', field: null }], filters: [{ field: 'plan', op: 'is', value: 'A' }] });
  });
});

describe('datasets', () => {
  const data: LibraryData = {
    plans: [{ id: 'p1', name: 'Monthly', pricePence: 4500, interval: 'monthly', isActive: true }, { id: 'p2', name: 'Annual', pricePence: 48000, interval: 'annual', isActive: true }],
    memberships: [
      { id: 'm1', userId: 'u1', planId: 'p1', status: 'active', startsOn: '2026-01-01', endsOn: '', provider: 'manual', paymentStatus: 'confirmed', updatedAt: '' },
      { id: 'm2', userId: 'u2', planId: 'p2', status: 'active', startsOn: '2026-02-01', endsOn: '', provider: 'manual', paymentStatus: 'confirmed', updatedAt: '' },
    ],
    gymMembers: [{ userId: 'u1', joinedAt: '2026-09-30T23:30:00Z', attritionOn: '', isActive: true }, { userId: 'u2', joinedAt: '2026-02-01T10:00:00Z', attritionOn: '2026-08-01', isActive: false }],
    people: new Map([['u1', { name: 'Alex', dateOfBirth: '1990-05-01', gender: 'female' }], ['u2', { name: 'Bea', dateOfBirth: '', gender: '' }]]),
    payments: [{ id: 'pay1', membershipId: 'm1', userId: 'u1', chargeDate: '2026-09-15', createdAt: '2026-09-15T10:00:00Z', amountPence: 4500, state: 'paid_out', provider: 'manual', failure: '' }],
    purchases: [], assignments: [], workoutSessions: [],
    pt: [{ memberId: 'u2', staffId: 'c1', startsAt: '2026-10-06T10:00:00Z', endsAt: '2026-10-06T11:00:00Z', status: 'no_show', notes: '' }],
    sessions: [{ id: 's1', name: 'Spin', startsAt: '2026-10-05T17:30:00Z', endsAt: '2026-10-05T18:15:00Z', capacity: 10, dropInPence: 800 }],
    bookings: [
      { sessionId: 's1', userId: 'u1', status: 'attended', bookedAt: '2026-10-01T09:00:00Z', cancelledAt: '' },
      { sessionId: 's1', userId: 'u2', status: 'no_show', bookedAt: '2026-10-01T09:00:00Z', cancelledAt: '' },
    ],
    staff: [
      { userId: 'c1', name: 'Coach Cara', role: 'coach', jobTitle: 'Head coach', payPence: 1500 },
      { userId: 'c2', name: 'Sam Staff', role: 'staff', jobTitle: '', payPence: null },
    ],
    staffHours: [
      { userId: 'c1', weekday: 1, isWorking: true, start: '09:00:00', end: '17:30:00' },
      { userId: 'c1', weekday: 2, isWorking: true, start: '06:00:00', end: '10:00:00' },
      { userId: 'c1', weekday: 3, isWorking: false, start: '', end: '' },
    ],
    sessionStaff: [{ sessionId: 's1', userId: 'c1', isLead: true }, { sessionId: 's1', userId: 'c2', isLead: false }],
  };
  const get = (id: string) => DATASETS.find((d) => d.id === id);
  it('eight datasets, each field has a unique id', () => {
    expect(DATASETS.map((d) => d.id)).toEqual(['members', 'memberships', 'payments', 'classes', 'bookings', 'staff', 'delivered', 'seen']);
    for (const d of DATASETS) expect(new Set(d.fields.map((f) => f.id)).size).toBe(d.fields.length);
  });
  it('every row only has the fields the dataset lists', () => {
    for (const d of DATASETS) {
      const ids = new Set(d.fields.map((f) => f.id));
      for (const r of d.rows(data, new Date('2026-10-08T12:00:00Z'))) for (const k of Object.keys(r)) expect(ids.has(k), `${d.id}.${k}`).toBe(true);
    }
  });
  it('members: joined is the gym day (UK), annual plans are divided to a month, personal details are marked', () => {
    const r = get('members')?.rows(data, new Date('2026-10-08T12:00:00Z')) ?? [];
    expect(r[0]).toMatchObject({ name: 'Alex', joined: '2026-10-01', plan: 'Monthly', monthly: 4500, age: '35–44', gender: 'Female', active: 'Yes' });
    expect(r[1]).toMatchObject({ name: 'Bea', left: '2026-08-01', active: 'No', monthly: 4000, age: 'Not set', gender: 'Not set' });
    expect(get('members')?.fields.filter((f) => f.sensitive).map((f) => f.id)).toEqual(['age', 'gender']);
  });
  it('payments, classes and bookings', () => {
    expect(get('payments')?.rows(data, new Date())[0]).toMatchObject({ member: 'Alex', date: '2026-09-15', amount: 4500, plan: 'Monthly' });
    expect(get('classes')?.rows(data, new Date())[0]).toMatchObject({ class: 'Spin', date: '2026-10-05', day: 'Monday', capacity: 10, booked: 2, attended: 1, noshow: 1, fill: 20, dropin: 800 });
    expect(get('bookings')?.rows(data, new Date()).map((r) => [r.member, r.class, r.status])).toEqual([['Alex', 'Spin', 'attended'], ['Bea', 'Spin', 'no_show']]);
  });
  it('staff: scheduled days and hours a week, pay marked personal', () => {
    const r = get('staff')?.rows(data, new Date()) ?? [];
    expect(r[0]).toMatchObject({ name: 'Coach Cara', role: 'Coach / PT', job: 'Head coach', days: 2, hours: 12.5, pay: 1500 });
    expect(r[1]).toMatchObject({ name: 'Sam Staff', days: 0, hours: 0, pay: null });
    expect(get('staff')?.fields.filter((f) => f.sensitive).map((f) => f.id)).toEqual(['pay']);
  });
  it('classes delivered: one row per class per person on it, with hours and who came', () => {
    const r = get('delivered')?.rows(data, new Date()) ?? [];
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ coach: 'Coach Cara', class: 'Spin', date: '2026-10-05', role: 'Lead', hours: 0.75, attended: 1, booked: 2 });
    expect(r[1]).toMatchObject({ coach: 'Sam Staff', role: 'Assistant' });
  });
  it('clients seen: attended class bookings for each coach, plus PT sessions', () => {
    const r = get('seen')?.rows(data, new Date()) ?? [];
    expect(r.filter((x) => x.kind === 'Class').map((x) => [x.coach, x.client])).toEqual([['Coach Cara', 'Alex'], ['Sam Staff', 'Alex']]);
    expect(r.find((x) => x.kind === 'PT')).toMatchObject({ coach: 'Coach Cara', client: 'Bea', status: 'no show', hours: 1 });
  });
  it('counts different clients, not visits', () => {
    const seen = get('seen');
    const rows = seen?.rows(data, new Date()) ?? [];
    const b = build({ ...defaultSpec('seen', seen?.fields ?? []), mode: 'summary', groupBy: 'coach', measures: [{ fn: 'distinct', field: 'client' }], chart: 'column' }, rows, seen?.fields ?? [], 'T', 'S');
    expect(b.table.headers).toEqual(['Coach', 'Different values of Client']);
    expect(b.table.rows).toEqual([['Coach Cara', 2], ['Sam Staff', 1]]);
    expect(b.totals).toEqual([2]);
  });
});

describe('starters', () => {
  it('every starter only uses fields that exist, so it survives being read back unchanged', () => {
    for (const s of STARTERS) {
      const back = sanitise(s.spec, DATASETS);
      expect(back, s.id).toEqual({ ...s.spec, columns: s.spec.columns.length ? s.spec.columns : back?.columns });
    }
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(STARTERS.length);
  });
});

describe('what is behind a bar', () => {
  const fs: Field[] = [{ id: 'plan', label: 'Plan', type: 'text' }, { id: 'date', label: 'Date', type: 'date' }, { id: 'amount', label: 'Amount', type: 'money' }];
  const rs: Row[] = [{ plan: 'A', date: '2026-09-03', amount: 100 }, { plan: 'B', date: '2026-09-20', amount: 200 }, { plan: 'A', date: '2026-10-01', amount: 300 }, { plan: '', date: null, amount: 400 }];
  const sp: Spec = { dataset: 'x', mode: 'summary', columns: [], groupBy: 'plan', dateBy: 'month', measures: [{ fn: 'count', field: null }], filters: [], chart: 'column' };
  it('gives the rows of one group, after the filters', () => {
    expect(rowsInGroup(sp, rs, fs, 'A')).toHaveLength(2);
    expect(rowsInGroup(sp, rs, fs, '')).toHaveLength(1);
    expect(rowsInGroup({ ...sp, filters: [{ field: 'amount', op: 'gt', value: '1.50' }] }, rs, fs, 'A')).toHaveLength(1);
    expect(rowsInGroup({ ...sp, groupBy: 'date' }, rs, fs, '2026-09')).toHaveLength(2);
  });
  it('makes the filters that narrow a report to one group', () => {
    const [plan, date, money] = fs as [Field, Field, Field];
    expect(filtersForGroup(plan, 'month', 'A')).toEqual([{ field: 'plan', op: 'is', value: 'A' }]);
    expect(filtersForGroup(plan, 'month', '')).toEqual([{ field: 'plan', op: 'blank', value: '' }]);
    expect(filtersForGroup(date, 'month', '2026-02')).toEqual([{ field: 'date', op: 'on_or_after', value: '2026-02-01' }, { field: 'date', op: 'on_or_before', value: '2026-02-28' }]);
    expect(filtersForGroup(date, 'day', '2026-09-03')).toEqual([{ field: 'date', op: 'on_or_after', value: '2026-09-03' }, { field: 'date', op: 'on_or_before', value: '2026-09-03' }]);
    expect(filtersForGroup(money, 'month', '4500')).toEqual([{ field: 'amount', op: 'eq', value: '45' }]);
  });
});
