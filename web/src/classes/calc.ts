import type { BookingStatus, EditableClass, RosterEntry, SchedulingRules, TimetableSession } from '../data/classes';

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

/** What the Add class form holds. */
export interface ClassForm {
  /** Saved class type, or empty for a custom class. */
  classTypeId: string;
  name: string;
  date: string;
  start: string;
  duration: string;
  capacity: string;
  reserved: string;
  release: string;
  description: string;
  /** Repeat every week, for `weeks` weeks including this one. */
  repeat: boolean;
  weeks: string;
}

export const RELEASE_OPTIONS = [
  ['', 'Keep reserved until class starts'],
  ['1440', '24 hours before'],
  ['720', '12 hours before'],
  ['120', '2 hours before'],
  ['60', '1 hour before'],
  ['30', '30 minutes before'],
] as const;

export function emptyClassForm(today: Date): ClassForm {
  return { classTypeId: '', name: '', date: dayKey(today), start: '18:00', duration: '60', capacity: '20', reserved: '0', release: '', description: '', repeat: false, weeks: '8' };
}

export interface ClassValues {
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservedCapacity: number;
  releaseMinutesBefore: number | null;
  /** How many weekly classes: 1 when not repeating. */
  weeks: number;
}

export type ClassCheck = { ok: true; values: ClassValues } | { ok: false; message: string };

export const CLASS_FORM_ERROR = 'Check the class name, date, duration and capacity values.';
export const MIN_WEEKS = 2;
export const MAX_WEEKS = 52;
export const WEEKS_ERROR = `Choose between ${MIN_WEEKS} and ${MAX_WEEKS} weeks.`;

/** Is the "number of weeks" box a whole number from 2 to 52? */
export function validWeeks(text: string): boolean {
  const n = Number(text);
  return text.trim() !== '' && Number.isInteger(n) && n >= MIN_WEEKS && n <= MAX_WEEKS;
}

/** Same rules as the old timetable's Add class form. Duration 5 to 480 minutes, as its box said. */
export function validateClass(form: ClassForm): ClassCheck {
  const name = form.name.trim();
  const duration = Number(form.duration);
  const capacity = Number(form.capacity);
  const reserved = Number(form.reserved);
  if (
    !name || !form.date || !form.start ||
    form.duration.trim() === '' || !Number.isFinite(duration) || duration < 5 || duration > 480 ||
    !Number.isInteger(capacity) || capacity < 1 ||
    !Number.isInteger(reserved) || reserved < 0 || reserved > capacity
  ) return { ok: false, message: CLASS_FORM_ERROR };
  const weeks = form.repeat ? Number(form.weeks) : 1;
  if (form.repeat && !validWeeks(form.weeks)) return { ok: false, message: WEEKS_ERROR };
  const starts = londonInstant(form.date, form.start);
  if (Number.isNaN(starts.getTime())) return { ok: false, message: CLASS_FORM_ERROR };
  const ends = new Date(starts.getTime() + duration * 60000);
  return {
    ok: true,
    values: {
      name, description: form.description.trim() || null, startsAt: starts.toISOString(), endsAt: ends.toISOString(),
      capacity, reservedCapacity: reserved, releaseMinutesBefore: form.release === '' ? null : Number(form.release), weeks,
    },
  };
}

/** The old page's worked example, shown under the reserved-spaces boxes. */
export function reservedExample(capacity: number, reserved: number): string {
  return `Example: capacity ${capacity} + ${reserved} reserved means standard members can fill up to ${capacity - reserved} places, while eligible premium plans can still book into the final ${reserved}.`;
}

// ---- Gym rules: who may teach, what a class needs ----


const LONDON = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London',
});
const WEEKDAY_NUMBER: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The gym's clock (UK time) for an instant: weekday 0 = Sunday, the date, and the time as HH:MM:SS. */
export function londonParts(d: Date): { weekday: number; date: string; time: string } {
  const p = Object.fromEntries(LONDON.formatToParts(d).map((x) => [x.type, x.value]));
  return { weekday: WEEKDAY_NUMBER[p.weekday ?? ''] ?? 0, date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

/**
 * The instant when the gym's clock (UK time) shows this date and time. The Add class form means gym
 * time whatever timezone the device is in, so a 09:30 class is 09:30 at the gym in summer and winter.
 */
export function londonInstant(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return new Date(NaN);
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = londonParts(new Date(guess));
    const [py = 0, pm = 1, pd = 1] = p.date.split('-').map(Number);
    const [ph = 0, pmi = 0] = p.time.split(':').map(Number);
    guess += wall - Date.UTC(py, pm - 1, pd, ph, pmi);
  }
  return new Date(guess);
}

export type StaffStatus = 'ok' | 'not-qualified' | 'outside-hours';

/**
 * Can this person take this class? Same two tests the database makes before it will schedule it:
 * every qualification the class type needs is held (and not expired on the day), and the class sits
 * inside their working hours for that weekday. The database still has the final say.
 */
export function staffStatus(userId: string, classTypeId: string | null, start: Date, end: Date, rules: SchedulingRules): StaffStatus {
  if (!classTypeId) return 'ok';
  const s = londonParts(start);
  const e = londonParts(end);
  const needed = rules.requirements.filter((r) => r.classTypeId === classTypeId && r.capabilityId).map((r) => r.capabilityId);
  const qualified = needed.every((cap) => rules.qualifications.some((q) => q.userId === userId && q.capabilityId === cap && q.qualified && (!q.expiresOn || q.expiresOn >= s.date)));
  if (!qualified) return 'not-qualified';
  const working = rules.hours.some((h) => h.userId === userId && h.weekday === s.weekday && h.isWorking && !!h.startTime && !!h.endTime && h.startTime <= s.time && h.endTime >= e.time);
  return working ? 'ok' : 'outside-hours';
}

export const STAFF_STATUS_TEXT: Record<StaffStatus, string> = { ok: '', 'not-qualified': 'Not qualified', 'outside-hours': 'Outside hours' };

/** "Qualification: Spin instructor · Needs: Studio A, 12 × Spin bike", or a note that nothing is needed. */
export function requirementsText(classTypeId: string | null, rules: SchedulingRules): string {
  if (!classTypeId) return 'Custom class: no qualification, room or equipment checks are made.';
  const mine = rules.requirements.filter((r) => r.classTypeId === classTypeId);
  const quals = mine.flatMap((r) => rules.capabilities.filter((c) => c.id === r.capabilityId).map((c) => c.name));
  const things = mine.flatMap((r) => rules.resources.filter((x) => x.id === r.resourceId).map((x) => (r.quantity > 1 ? `${r.quantity} × ${x.name}` : x.name)));
  const parts = [quals.length ? `Qualification: ${quals.join(', ')}` : '', things.length ? `Needs: ${things.join(', ')}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'This class type has no qualification, room or equipment requirements.';
}

// ---- Weekly repeats ----

export interface Occurrence {
  startsAt: string;
  endsAt: string;
}

/**
 * Every weekly occurrence of a class, the first included. Each week is the same day and the same
 * clock time at the gym (so a class at 18:00 stays at 18:00 when the clocks change), not simply
 * 7 x 24 hours later.
 */
export function weeklyOccurrences(startsAt: string, endsAt: string, weeks: number): Occurrence[] {
  const first = new Date(startsAt);
  const length = new Date(endsAt).getTime() - first.getTime();
  const { date, time } = londonParts(first);
  const clock = time.slice(0, 5);
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return Array.from({ length: weeks }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + 7 * i));
    const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
    const s = londonInstant(key, clock);
    return { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + length).toISOString() };
  });
}

const OCCURRENCE_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' });

/** "Sat 17 Oct 2026, 09:30" in gym time. */
export function occurrenceLabel(o: Pick<Occurrence, 'startsAt'>): string {
  return OCCURRENCE_LABEL.format(new Date(o.startsAt));
}

export interface WeekResult {
  startsAt: string;
  ok: boolean;
  errors: string[];
}

/** After saving a series: "Saved 10 of 12 weeks." */
export function seriesSummary(results: WeekResult[]): string {
  const saved = results.filter((r) => r.ok).length;
  return saved === results.length ? `Saved all ${saved} weeks.` : `Saved ${saved} of ${results.length} weeks.`;
}

// ---- Override: schedule a class that fails the checks, on purpose, with a reason that is kept ----

/** The one problem that can never be overridden (calendars assume a class sits inside one day). */
export const MIDNIGHT_MESSAGE = 'Classes cannot currently run across midnight.';
export const MIN_REASON = 3;
export const MAX_REASON = 500;

/** Can the owner be offered "schedule anyway"? Not for a class that crosses midnight, and not when nothing failed. */
export function canOfferOverride(errors: string[]): boolean {
  return errors.length > 0 && !errors.includes(MIDNIGHT_MESSAGE);
}

/** A reason is needed, 3 to 500 characters once trimmed. */
export function reasonOk(text: string): boolean {
  const n = text.trim().length;
  return n >= MIN_REASON && n <= MAX_REASON;
}

const LONG_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const SHORT_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Thursday 8 October". */
export function dayTitle(d: Date): string {
  return LONG_DAY.format(d);
}

/** "Thu 8 Oct". */
export function shortDay(d: Date): string {
  return SHORT_DAY.format(d);
}

/** The edit form's starting values for a saved class, in gym time (UK). */
export function formFromClass(c: EditableClass): ClassForm {
  const start = londonParts(new Date(c.startsAt));
  const minutes = Math.round((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 60000);
  return {
    classTypeId: c.classTypeId ?? '',
    name: c.name,
    date: start.date,
    start: start.time.slice(0, 5),
    duration: String(minutes),
    capacity: String(c.capacity),
    reserved: String(c.reservedCapacity),
    release: c.releaseMinutesBefore === null ? '' : String(c.releaseMinutesBefore),
    description: c.description,
    repeat: false,
    weeks: '8',
  };
}

export const BOOKING_STATUS_TEXT: Record<BookingStatus, string> = { booked: 'Booked', attended: 'Attended', no_show: 'No-show' };

/** "5 booked · 2 attended · 1 no-show" for a roster (counts of zero are left out, except the booked total). */
export function rosterSummary(roster: Pick<RosterEntry, 'status'>[]): string {
  const attended = roster.filter((r) => r.status === 'attended').length;
  const noShow = roster.filter((r) => r.status === 'no_show').length;
  return [`${roster.length} booked`, attended ? `${attended} attended` : '', noShow ? `${noShow} no-show` : ''].filter(Boolean).join(' · ');
}
