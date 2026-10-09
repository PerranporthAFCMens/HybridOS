import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { londonParts } from '../classes/calc';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMyBirthday, getProfileNames } from '../data/profile';
import type { ClassRow } from '../data/member';
import { Button } from '../ui/Button';
import { BirthdayHello } from './Birthday';
import { birthdayKey, chooseHero, dayLabel,isBirthdayToday, dayOf, goalMessage, suggestions, timeOf, whenWords, spaceText } from './calc';
import { dueNow } from '../train/calc';
import type { MemberCtx } from './useMember';
import { useBooking } from './useBooking';

const GOAL_KEY = 'hybrid_member_weekly_goal';
const readGoal = (): number => {
  try {
    const n = Number(localStorage.getItem(GOAL_KEY));
    return Number.isFinite(n) && n >= 1 && n <= 14 ? n : 3;
  } catch {
    return 3;
  }
};

function greeting(now: Date): string {
  const h = Number(londonParts(now).time.slice(0, 2));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** The first screen: the one thing that matters now on top, then what to book next, then the week. */
export function Today() {
  const { userId, gym } = useReadyAuth();
  const d = useOutletContext<MemberCtx>();
  const booking = useBooking();
  const [goal, setGoal] = useState(readGoal);
  const profile = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfileNames(userId) });
  const birthday = useQuery({ queryKey: ['birthday', userId], queryFn: () => getMyBirthday(userId) });
  const [wished, setWished] = useState(false);
  const year = Number(d.today.slice(0, 4));
  const wishedBefore = (() => { try { return localStorage.getItem(birthdayKey(userId, year)) === '1'; } catch { return false; } })();
  const showBirthday = birthday.isSuccess && !wished && !wishedBefore && isBirthdayToday(birthday.data, d.now);
  const closeBirthday = () => {
    setWished(true);
    try { localStorage.setItem(birthdayKey(userId, year), '1'); } catch { /* it may show again on this device, which is harmless */ }
  };
  const due = dueNow(d.plans, d.today, dayOf)[0] ?? null;
  const hero = chooseHero(d.now, d.classes.data, d.pt, d.flags, due ? { id: due.id, title: due.title, status: due.status } : null);
  const first = profile.data?.firstName ?? profile.data?.displayName?.split(' ')[0] ?? '';
  const sugg = d.flags.classes ? suggestions(d.now, d.classes.data, 3) : [];
  const nextPt = d.pt[0];

  const setGoalTo = (n: number) => {
    const v = Math.max(1, Math.min(14, n));
    setGoal(v);
    try { localStorage.setItem(GOAL_KEY, String(v)); } catch { /* the goal is a convenience on this device */ }
  };

  const headline =
    hero.kind === 'workout' ? 'Today\'s workout is ready'
    : hero.kind === 'class' ? `Your next class is ${whenWords(dayOf(hero.row.startsAt), d.today)}`
    : hero.kind === 'pt' ? `PT ${whenWords(dayOf(hero.row.startsAt), d.today)}`
    : hero.kind === 'book' ? 'Ready for your next class?'
    : 'Welcome back';

  return (
    <div className="mem-screen">
      {booking.layer}
      {showBirthday && <BirthdayHello first={first} gymName={gym.gymName} onClose={closeBirthday} />}
      {birthday.isSuccess && !birthday.data && (
        <section className="mem-card" aria-label="Your birthday">
          <b>Tell us your birthday</b>
          <div className="muted small">So we can say happy birthday when it comes round.</div>
          <Link className="btn secondary" to="/m/me">Add my birthday</Link>
        </section>
      )}
      <div>
        <div className="mem-hi">{greeting(d.now)}{first ? `, ${first}` : ''}</div>
        <h1 className="mem-title">{headline}</h1>
      </div>

      {d.classes.isPending ? <div className="mem-card muted">Loading…</div> : hero.kind === 'class' ? (
        <section className="mem-card mem-hero" aria-label="Next class">
          <span className="mem-eyebrow">Booked</span>
          <div className="mem-big">{hero.row.name}</div>
          <div className="muted">{dayLabel(dayOf(hero.row.startsAt))} · {timeOf(hero.row.startsAt)}–{timeOf(hero.row.endsAt)}</div>
          <div className="mem-actions">
            <Button disabled={booking.busy === hero.row.sessionId} onClick={() => booking.askCancel(hero.row)}>Cancel booking</Button>
            <Link className="btn secondary" to="/m/classes">All classes</Link>
          </div>
        </section>
      ) : hero.kind === 'workout' ? (
        <section className="mem-card mem-hero" aria-label="Today's workout">
          <span className="mem-eyebrow">Today</span>
          <div className="mem-big">{hero.row.title}</div>
          <div className="muted">Suggested for you. Change, swap or skip anything.</div>
          <Link className="btn primary" to={`/m/train/${hero.row.id}`}>{hero.row.status === 'in_progress' ? 'Continue workout' : 'Start workout'}</Link>
        </section>
      ) : hero.kind === 'pt' ? (
        <section className="mem-card mem-hero" aria-label="Next PT session">
          <span className="mem-eyebrow">Next PT session</span>
          <div className="mem-big">{dayLabel(dayOf(hero.row.startsAt))} · {timeOf(hero.row.startsAt)}</div>
          <div className="muted">Personal training · {timeOf(hero.row.startsAt)}–{timeOf(hero.row.endsAt)}</div>
        </section>
      ) : hero.kind === 'book' ? (
        <section className="mem-card mem-hero" aria-label="Book a class">
          <span className="mem-eyebrow">Classes</span>
          <div className="mem-big">Nothing booked yet</div>
          <div className="muted">Pick a class and tap Book.</div>
          <Link className="btn primary" to="/m/classes">See classes</Link>
        </section>
      ) : (
        <section className="mem-card mem-hero"><div className="mem-big">Glad you are here</div><div className="muted">Your classes, training and PT will show here as they are set up.</div></section>
      )}

      {sugg.length > 0 && (
        <section className="mem-card" aria-label="Book another">
          <div className="mem-row"><h2>{hero.kind === 'class' ? 'Book another' : 'Coming up'}</h2><Link to="/m/classes">See all</Link></div>
          {sugg.map((c) => <SuggestionRow key={c.sessionId} c={c} busy={booking.busy === c.sessionId} onBook={() => void booking.book(c)} />)}
        </section>
      )}

      {hero.kind !== 'workout' && due && (
        <section className="mem-card" aria-label="Today's workout">
          <div className="mem-line"><div><h2>Today's workout</h2><div className="muted">{due.title}</div></div><Link className="btn secondary" to={`/m/train/${due.id}`}>{due.status === 'in_progress' ? 'Continue' : 'Start'}</Link></div>
        </section>
      )}

      {hero.kind !== 'pt' && nextPt && d.flags.pt && (
        <section className="mem-card" aria-label="Next PT session">
          <div className="mem-row"><div><h2>Next PT session</h2><div className="muted">{dayLabel(dayOf(nextPt.startsAt))} · {timeOf(nextPt.startsAt)}</div></div></div>
        </section>
      )}

      {(d.flags.gym || d.workoutsThisWeek > 0) && (
        <section className="mem-card" aria-label="This week">
          <div className="mem-row">
            <div>
              <h2>This week</h2>
              <div className="muted">{goalMessage(d.workoutsThisWeek, goal)}</div>
            </div>
            <div className="mem-ring" style={{ ['--p' as string]: `${Math.min(100, Math.round((d.workoutsThisWeek / goal) * 100)) * 3.6}deg` }}><i>{d.workoutsThisWeek}/{goal}</i></div>
          </div>
          <div className="mem-stepper" role="group" aria-label="Weekly goal">
            <span className="muted">Goal: {goal} a week</span>
            <Button aria-label="Lower the weekly goal" onClick={() => setGoalTo(goal - 1)}>−</Button>
            <Button aria-label="Raise the weekly goal" onClick={() => setGoalTo(goal + 1)}>+</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function SuggestionRow({ c, busy, onBook }: { c: ClassRow; busy: boolean; onBook: () => void }) {
  return (
    <div className="mem-line">
      <div>
        <b>{c.name}</b>
        <div className="muted small">{dayLabel(dayOf(c.startsAt))} · {timeOf(c.startsAt)} · {spaceText(c)}</div>
      </div>
      <Button variant="primary" disabled={busy} onClick={onBook} aria-label={`Book ${c.name}`}>{busy ? 'Booking…' : 'Book'}</Button>
    </div>
  );
}
