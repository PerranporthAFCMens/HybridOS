import type { ActiveMembershipValue, ChannelRow, ClassSession, GymMemberRow, PlanRow } from '../data/today';

// Pure calculations behind the Today screen. Same rules as the legacy dashboard.

export function dayStart(value: Date | string): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A member counts as live on `date` if joined by then and not yet left. */
export function liveAt(row: GymMemberRow, date: Date): boolean {
  if (!row.joinedAt) return false;
  const end = dayStart(date);
  const joined = dayStart(row.joinedAt);
  const left = row.attritionOn ? dayStart(row.attritionOn) : null;
  return joined <= end && (!left || left > end);
}

export function monthlyValue(pricePence: number, interval: string): number {
  switch (interval) {
    case 'weekly':
      return (pricePence * 52) / 12;
    case 'quarterly':
      return pricePence / 3;
    case 'annual':
      return pricePence / 12;
    case 'monthly':
      return pricePence;
    default:
      return 0;
  }
}

export function expectedMonthlyIncome(rows: ActiveMembershipValue[]): number {
  return Math.round(rows.reduce((sum, m) => sum + monthlyValue(m.priceInPence, m.interval), 0));
}

export function money(pence: number): string {
  return '£' + ((pence || 0) / 100).toFixed(2);
}

export function monthlyCounts(members: GymMemberRow[], now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const within = (v: string | null) => !!v && dayStart(v) >= start && dayStart(v) <= end;
  return {
    active: members.filter((r) => liveAt(r, now)).length,
    joined: members.filter((r) => within(r.joinedAt)).length,
    left: members.filter((r) => within(r.attritionOn)).length,
  };
}

export interface TrendPoint {
  label: string;
  count: number;
}

/** Live members at the end of each of the last 12 months (the current month ends today). */
export function memberTrend(members: GymMemberRow[], now: Date): TrendPoint[] {
  const fmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const points: TrendPoint[] = [];
  for (let k = 11; k >= 0; k--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - k + 1, 0);
    const at = monthEnd > now ? now : monthEnd;
    points.push({ label: fmt.format(monthEnd), count: members.filter((r) => liveAt(r, at)).length });
  }
  return points;
}

export interface Need {
  key: string;
  tone: 'warn' | 'info';
  title: string;
  sub: string;
  button: string;
  to: 'members' | 'plans' | 'class-setup' | 'communications';
}

const WEEKDAY_TIME = new Intl.DateTimeFormat('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

export interface NeedsInput {
  pendingPayments: number;
  plans: PlanRow[];
  sessions: ClassSession[]; // next 7 days, not cancelled, soonest first
  memberCount: number;
  now: Date;
}

export function buildNeeds({ pendingPayments, plans, sessions, memberCount, now }: NeedsInput): Need[] {
  const needs: Need[] = [];
  if (pendingPayments > 0) {
    needs.push({
      key: 'pending',
      tone: 'warn',
      title: `${pendingPayments} ${pendingPayments === 1 ? 'membership payment is' : 'membership payments are'} waiting to be confirmed`,
      sub: 'Check these so members are not left without access.',
      button: 'Review members',
      to: 'members',
    });
  }
  if (!plans.some((p) => p.isActive)) {
    needs.push({
      key: 'plan',
      tone: 'info',
      title: 'Create your first membership plan',
      sub: 'Members need a plan before they can join and pay.',
      button: 'Add a plan',
      to: 'plans',
    });
  }
  if (sessions.length === 0) {
    needs.push({
      key: 'classes',
      tone: 'info',
      title: 'No classes in the next 7 days',
      sub: 'Add a class and members can book straight away.',
      button: 'Add a class',
      to: 'class-setup',
    });
  }
  const quiet = sessions
    .filter((s) => new Date(s.starts_at) > now && s.capacity >= 4 && s.booked_count / s.capacity < 0.25)
    .sort((a, b) => a.booked_count - b.booked_count)[0];
  if (quiet) {
    needs.push({
      key: 'quiet',
      tone: 'info',
      title: `${quiet.name} on ${WEEKDAY_TIME.format(new Date(quiet.starts_at))} has ${quiet.booked_count} of ${quiet.capacity} places booked`,
      sub: 'Send members a reminder to fill it.',
      button: 'Message members',
      to: 'communications',
    });
  }
  if (memberCount === 0) {
    needs.push({
      key: 'invite',
      tone: 'info',
      title: 'Invite your first members',
      sub: 'Share your join link so people can sign up.',
      button: 'Open members',
      to: 'members',
    });
  }
  return needs;
}

export function summaryLine(needCount: number): string {
  if (needCount === 0) return 'Nothing needs you right now. Everything is running.';
  if (needCount === 1) return '1 thing needs a look. Everything else is running.';
  return `${needCount} things need a look. Everything else is running.`;
}

export function greeting(name: string, now: Date): string {
  const h = now.getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name.split(' ')[0]}.`;
}

export function bookedPercent(session: Pick<ClassSession, 'booked_count' | 'capacity'>): number {
  return Math.min(100, Math.round((100 * (session.booked_count || 0)) / Math.max(1, session.capacity || 1)));
}

export function upcomingSessions(all: ClassSession[]): ClassSession[] {
  return all.filter((s) => !s.is_cancelled).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
}

export function sessionsOnDay(sessions: ClassSession[], day: Date): ClassSession[] {
  return sessions.filter((s) => new Date(s.starts_at).toDateString() === day.toDateString());
}

export function activePlans(plans: PlanRow[]): PlanRow[] {
  return plans.filter((p) => p.isActive);
}

export type { ChannelRow };
