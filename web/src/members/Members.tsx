import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { listMissingDetails } from '../data/signup';
import { Card, Empty } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { availableLetters, filterAndSort, formatRegistered, initials, jumpLetter, labelStatus, missingList, missingSummary, nameOf, ROLE_LABEL, showOnly, summaryText, type Show, type SortMode } from './calc';
import { MemberRecord } from './MemberRecord';
import { useMemberDirectory } from './useMembers';
import '../staff/staff.css';
import './members.css';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function Members() {
  const { gym } = useReadyAuth();
  const q = useMemberDirectory(gym.gymId);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('first');
  const [letter, setLetter] = useState('');
  const [openId, setOpenId] = useState('');
  const [show, setShow] = useState<Show>('all');

  const everyone = q.data ?? [];
  const all = showOnly(everyone, show);
  const rows = filterAndSort(all, { search, sort, letter });
  const letters = availableLetters(all, sort);
  const byDate = sort.startsWith('registered');
  const open = everyone.find((m) => m.userId === openId);
  // Only owners, admins and staff may ask; for anyone else the database refuses and the card is simply not shown.
  const missing = useQuery({ queryKey: ['missing-details', gym.gymId], queryFn: () => listMissingDetails(gym.gymId), retry: false });
  const gaps = missing.data ?? [];

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

      {gaps.length > 0 && (
        <Card>
          <details className="missing-details">
            <summary><b>{missingSummary(gaps.length)}</b> <span className="muted">Tap to see who and what</span></summary>
            <ul className="settings-list">
              {gaps.map((g) => (
                <li key={g.userId}>
                  <div>
                    <b>{g.name}</b>
                    <div className="muted">Missing: {missingList(g.missing)}</div>
                  </div>
                  {everyone.some((m) => m.userId === g.userId) && <button type="button" className="btn secondary" onClick={() => setOpenId(g.userId)}>Open</button>}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      <Card>
        <div className="member-directory-tools">
          <Input
            type="search"
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
            <span className="muted">Show</span>
            <Select aria-label="Show" value={show} onChange={(e) => { setShow(e.target.value as Show); setLetter(''); }}>
              <option value="all">Members and team</option>
              <option value="members">Members only</option>
              <option value="team">Team only</option>
            </Select>
          </label>
          <label className="member-sort">
            <span className="muted">Sort by</span>
            <Select
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
            </Select>
          </label>
        </div>

        {!byDate && (
          <div className="member-jump" data-dense aria-label="Jump to letter">
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
                        {m.latest ? `${m.latest.planName || 'Membership'} · ${labelStatus(m.latest.status)}` : 'No membership yet'} · {ROLE_LABEL[m.role] ?? 'Member'}
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
