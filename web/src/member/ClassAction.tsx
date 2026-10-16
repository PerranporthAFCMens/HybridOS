import { Button } from '../ui/Button';
import type { ClassRow } from '../data/member';
import { minutesLeft, waitlistText } from './calc';
import type { useBooking } from './useBooking';

type Booking = ReturnType<typeof useBooking>;

/** The status line under a class when the member is in its waitlist, else null. */
export function waitlistLine(c: ClassRow, booking: Booking): string | null {
  const w = booking.waitlistFor(c.sessionId);
  return w && !c.isBooked ? waitlistText(w, booking.nowMs) : null;
}

/** The buttons for one class: Book, Cancel, or the waitlist steps when it is full. */
export function ClassAction({ c, booking }: { c: ClassRow; booking: Booking }) {
  const busy = booking.busy === c.sessionId;
  if (c.isBooked) return <Button disabled={busy} onClick={() => booking.askCancel(c)} aria-label={`Cancel ${c.name}`}>Cancel</Button>;
  const w = booking.waitlistFor(c.sessionId);
  if (w?.status === 'offered') {
    const m = minutesLeft(w.offerExpiresAt, booking.nowMs);
    return (
      <div className="mem-actions">
        <Button variant="primary" disabled={busy} onClick={() => void booking.book(c)} aria-label={`Book your held place in ${c.name}`}>{busy ? 'Booking…' : `Book it (${m} min)`}</Button>
        <Button disabled={busy} onClick={() => void booking.leaveLine(c)} aria-label={`Decline the place in ${c.name}`}>No thanks</Button>
      </div>
    );
  }
  if (w) return <Button disabled={busy} onClick={() => void booking.leaveLine(c)} aria-label={`Leave the waitlist for ${c.name}`}>{busy ? 'Leaving…' : 'Leave waitlist'}</Button>;
  if (booking.isFull(c)) return <Button variant="primary" disabled={busy} onClick={() => void booking.joinLine(c)} aria-label={`Join the waitlist for ${c.name}`}>{busy ? 'Joining…' : 'Join waitlist'}</Button>;
  return <Button variant="primary" disabled={busy} onClick={() => void booking.book(c)} aria-label={`Book ${c.name}`}>{busy ? 'Booking…' : 'Book'}</Button>;
}
