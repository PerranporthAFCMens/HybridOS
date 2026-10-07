import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { Card, Empty } from '../ui/Card';
import { availableLetters, filterAndSort, formatRegistered, initials, jumpLetter, labelStatus, nameOf, summaryText, type SortMode } from './calc';
import { MemberRecord } from './MemberRecord';
import { useMemberDirectory } from './useMembers';
import './members.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function Members() {
  const { gym } = useReadyAuth();
  const q = useMemberDirectory(gym.gymId);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('first');
  const [letter, setLetter] = useState('');
  const [openId, setOpenId] = useState('');

  const all = q.data ?? [];
  const rows = filterAndSort(all, { search, sort, letter });
  const letters = availableLetters(all, sort);
  const byDate = sort.startsWith('registered');
  const open = all.find((m) => m.userId === openId);

  let lastGroup = '';
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">People &amp; subscriptions</div>
          <h1>Members</h1>
        </div>
        <span className="muted">{q.data ? summaryText(rows.length, all.length) : ''}</span>
      </header>

      <Card>
        <div className="member-directory-tools">
          <input
            type="search"
            className="control"
            placeholder="Search members by name…"
            autoComplete="off"
            aria-label="Search members by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLetter('');
            }}
          />
          <label className="member-sort">
            <span className="muted">Sort by</span>
            <select
              className="control"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortMode);
                setLetter('');
              }}
            >
              <option value="first">First name</option>
              <option value="surname">Surname</option>
              <option value="registered_desc">Date registered · newest</option>
              <option value="registered_asc">Date registered · oldest</option>
            </select>
          </label>
        </div>

        {!byDate && (
          <div className="member-jump" aria-label="Jump to letter">
            {LETTERS.map((l) => (
              <button
                type="button"
                key={l}
                disabled={!letters.has(l)}
                className={letter === l ? 'active' : ''}
                onClick={() => setLetter(letter === l ? '' : l)}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {q.isError ? (
          <Empty>Could not load members. Refresh to try again.</Empty>
        ) : !q.data ? (
          <Empty>Loading members…</Empty>
        ) : rows.length ? (
          rows.map((m) => {
            const group = byDate ? '' : jumpLetter(m, sort);
            const label = group && group !== lastGroup ? <div className="member-group-label">{group}</div> : null;
            lastGroup = group;
            const name = nameOf(m);
            return (
              <div key={m.userId}>
                {label}
                <button type="button" className="member-row" onClick={() => setOpenId(m.userId)}>
                  <span className="member-name">
                    <span className="avatar">{initials(name)}</span>
                    <span className="member-text">
                      <b>{name}</b>
                      <span className="muted">
                        {m.latest ? `${m.latest.planName || 'Membership'} · ${labelStatus(m.latest.status)}` : 'No membership yet'} · member
                      </span>
                      <span className="member-reg">Registered {formatRegistered(m.joinedAt)}</span>
                    </span>
                  </span>
                  <span className="muted" aria-hidden="true">›</span>
                </button>
              </div>
            );
          })
        ) : (
          <Empty>No members match your search.</Empty>
        )}
      </Card>

      {open && <MemberRecord key={open.userId} member={open} gymId={gym.gymId} onClose={() => setOpenId('')} />}
    </>
  );
}
