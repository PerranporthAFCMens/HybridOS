import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import type { RosterEntry } from '../data/classes';
import { filterAndSort, nameOf } from '../members/calc';
import { useMemberDirectory } from '../members/useMembers';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { MAX_ADD_MATCHES } from './calc';
import { useManageBooking } from './useClasses';

/** Find a member by name and put them on a class. The database refuses a full or cancelled class. */
export function AddToClass({ sessionId, roster, disabled }: { sessionId: string; roster: RosterEntry[]; disabled: boolean }) {
  const { gym } = useReadyAuth();
  const members = useMemberDirectory(gym.gymId);
  const manage = useManageBooking(gym.gymId, sessionId);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const onList = new Set(roster.map((r) => r.userId));
  const query = search.trim();
  const matches = query
    ? filterAndSort((members.data ?? []).filter((m) => !onList.has(m.userId)), { search: query, sort: 'first', letter: '' }).slice(0, MAX_ADD_MATCHES)
    : [];

  const add = (userId: string, name: string) => {
    setMessage(null);
    manage.mutate(
      { userId, action: 'add' },
      {
        onSuccess: (r) => {
          if (!r.ok) return setMessage({ text: r.errors.join(' ') || 'Could not add them.', bad: true });
          setMessage({ text: `${name} added.${r.warnings.length ? ` ${r.warnings.join(' ')}` : ''}`, bad: false });
          setSearch('');
        },
        onError: (e) => setMessage({ text: e.message, bad: true }),
      },
    );
  };

  return (
    <div className="add-to-class">
      <Field label="Add someone to this class" htmlFor="add-member-search" hint={disabled ? 'A cancelled class cannot take new people.' : 'Type part of their name.'}>
        <Input id="add-member-search" value={search} disabled={disabled} placeholder="Find a member" onChange={(e) => { setSearch(e.target.value); setMessage(null); }} />
      </Field>
      {query && !disabled && members.isPending && <p className="muted small">Loading members…</p>}
      {query && !disabled && members.data && matches.length === 0 && <p className="muted small">No member found who is not already on the list.</p>}
      {matches.length > 0 && (
        <ul className="roster">
          {matches.map((m) => (
            <li key={m.userId}>
              <span className="roster-name">{nameOf(m)}</span>
              <Button disabled={manage.isPending} onClick={() => add(m.userId, nameOf(m))}>Add</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="assign-msg">{message && <span className={`msg ${message.bad ? 'error' : 'good'}`} role="status">{message.text}</span>}</div>
    </div>
  );
}
