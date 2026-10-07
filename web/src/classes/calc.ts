import type { TimetableSession } from '../data/classes';

/** Monday 00:00 (local) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local calendar day as yyyy-mm-dd. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

export function timeRange(s: Pick<TimetableSession, 'starts_at' | 'ends_at'>): string {
  return `${TIME.format(new Date(s.starts_at))}–${TIME.format(new Date(s.ends_at))}`;
}

/** "5 Oct – 11 Oct" for the week starting `start`. */
export function weekLabel(start: Date): string {
  return `${DAY.format(start)} – ${DAY.format(addDays(start, 6))}`;
}

export function weekdayName(d: Date): string {
  return WEEKDAY.format(d);
}

export interface DayColumn {
  date: Date;
  key: string;
  isToday: boolean;
  sessions: TimetableSession[];
}

/** Seven columns Monday to Sunday, each with its classes in start order. */
export function weekColumns(start: Date, sessions: TimetableSession[], now: Date): DayColumn[] {
  const todayKey = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = dayKey(date);
    return {
      date,
      key,
      isToday: key === todayKey,
      sessions: sessions
        .filter((s) => dayKey(new Date(s.starts_at)) === key)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    };
  });
}

export type Tone = 'good' | 'warn' | '';

/** The small status pill on a class card, worded as on the old timetable. */
export function sessionStatus(s: TimetableSession): { text: string; tone: Tone } {
  if (s.is_cancelled) return { text: 'Cancelled', tone: 'warn' };
  if (s.my_booking_status === 'booked') return { text: 'Booked', tone: 'good' };
  return { text: s.availability_note || `${s.spaces_left} spaces left`, tone: s.reserved_capacity > 0 ? 'warn' : '' };
}

export function bookedText(s: Pick<TimetableSession, 'booked_count' | 'capacity'>): string {
  return `${s.booked_count}/${s.capacity} booked`;
}

export function weekSummary(sessions: TimetableSession[]): string {
  const live = sessions.filter((s) => !s.is_cancelled).length;
  const cancelled = sessions.length - live;
  const base = `${live} ${live === 1 ? 'class' : 'classes'}`;
  return cancelled ? `${base} · ${cancelled} cancelled` : base;
}
