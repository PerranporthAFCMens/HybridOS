// Ready-made starting points: open one, tweak it, save it. Every one uses only fields the datasets offer
// (a test checks that), so a starter can never break when the datasets change.
import type { Spec } from './engine';
import type { Preset } from './period';

export interface Starter { id: string; title: string; text: string; spec: Spec; /** The dates it opens with. */ period: Preset }

const spec = (s: Partial<Spec> & Pick<Spec, 'dataset'>): Spec => ({
  mode: 'summary', columns: [], groupBy: null, dateBy: 'month', measures: [{ fn: 'count', field: null }], filters: [], chart: 'column', ...s,
});

const PERIOD: Record<string, Preset> = { income: '12m', failed: '90', 'busy-days': '90', attendance: '90', joiners: '12m', bookings: '90', 'coach-classes': '90', 'coach-hours': '90', 'coach-clients': '90' };

export const STARTERS: Starter[] = ([
  {
    id: 'income', title: 'Money in, by month', text: 'Payments added up for each month.',
    spec: spec({ dataset: 'payments', groupBy: 'date', measures: [{ fn: 'sum', field: 'amount' }], filters: [{ field: 'state', op: 'is_not', value: 'failed' }], chart: 'column' }),
  },
  {
    id: 'failed', title: 'Failed payments', text: 'Who, when and why a payment failed.',
    spec: spec({ dataset: 'payments', mode: 'list', columns: ['member', 'date', 'amount', 'failure'], filters: [{ field: 'state', op: 'is', value: 'failed' }], chart: 'table' }),
  },
  {
    id: 'plan-mix', title: 'Members by plan', text: 'How active memberships are split across your plans.',
    spec: spec({ dataset: 'memberships', groupBy: 'plan', filters: [{ field: 'status', op: 'is', value: 'active' }], chart: 'donut' }),
  },
  {
    id: 'plan-value', title: 'Monthly value by plan', text: 'What each plan is worth a month, from active memberships.',
    spec: spec({ dataset: 'memberships', groupBy: 'plan', measures: [{ fn: 'sum', field: 'monthly' }], filters: [{ field: 'status', op: 'is', value: 'active' }], chart: 'bar' }),
  },
  {
    id: 'busy-days', title: 'Busiest days', text: 'The average fill of your classes on each day of the week.',
    spec: spec({ dataset: 'classes', groupBy: 'day', measures: [{ fn: 'avg', field: 'fill' }], chart: 'bar' }),
  },
  {
    id: 'attendance', title: 'Attendance by class', text: 'Who turned up and who did not, class by class.',
    spec: spec({ dataset: 'classes', groupBy: 'class', measures: [{ fn: 'sum', field: 'attended' }, { fn: 'sum', field: 'noshow' }], chart: 'column' }),
  },
  {
    id: 'joiners', title: 'New members, by month', text: 'How many people joined in each month.',
    spec: spec({ dataset: 'members', groupBy: 'joined', chart: 'line' }),
  },
  {
    id: 'bookings', title: 'Booking outcomes', text: 'Attended, no-show, cancelled and booked.',
    spec: spec({ dataset: 'bookings', groupBy: 'status', chart: 'donut' }),
  },
  {
    id: 'coach-classes', title: 'Classes delivered by coach', text: 'How many classes each coach was on.',
    spec: spec({ dataset: 'delivered', groupBy: 'coach', chart: 'bar' }),
  },
  {
    id: 'coach-hours', title: 'Hours delivered by coach', text: 'Class hours each coach delivered.',
    spec: spec({ dataset: 'delivered', groupBy: 'coach', measures: [{ fn: 'sum', field: 'hours' }], chart: 'bar' }),
  },
  {
    id: 'coach-clients', title: 'Clients seen by coach', text: 'How many different clients each coach saw, in classes and in PT.',
    spec: spec({ dataset: 'seen', groupBy: 'coach', measures: [{ fn: 'distinct', field: 'client' }], chart: 'column' }),
  },
  {
    id: 'staff-hours', title: 'Scheduled working hours', text: 'The hours each person is set up to work in a week.',
    spec: spec({ dataset: 'staff', mode: 'list', columns: ['name', 'role', 'days', 'hours'], chart: 'table' }),
  },
] as Omit<Starter, 'period'>[]).map((x) => ({ ...x, period: PERIOD[x.id] ?? 'all' }));
