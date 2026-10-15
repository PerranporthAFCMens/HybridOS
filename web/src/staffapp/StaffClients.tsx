import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useReadyAuth } from '../auth/AuthProvider';
import { addClient, listMyClients } from '../data/ptClients';
import { loadAssignableMembers } from '../data/workouts';
import { initials } from '../members/calc';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Input } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { addable, clientLine, sortClients } from './clientsCalc';
import '../members/members.css';

/** A PT's home: their clients, the ones who need them first. One line each, tap to open. */
export function StaffClients() {
  const { gym, userId } = useReadyAuth();
  const everyone = gym.role === 'owner' || gym.role === 'admin';
  const q = useQuery({ queryKey: ['staff-clients', gym.gymId, userId, everyone], queryFn: () => listMyClients(gym.gymId, userId, everyone) });
  const [adding, setAdding] = useState(false);
  const [typed, setTyped] = useState('');
  const now = new Date();
  const list = sortClients(q.data ?? []).filter((c) => typed.trim() === '' || c.name.toLowerCase().includes(typed.trim().toLowerCase()));
  return (
    <div className="staff-day">
      <div className="staff-title-row">
        <h1 className="staff-title">{everyone ? 'All clients' : 'My clients'}</h1>
        {!everyone && <Button variant="primary" onClick={() => setAdding(true)}>Add client</Button>}
      </div>
      {q.data && (everyone || q.data.length > 5) && <Input aria-label="Search clients" placeholder="Search clients" value={typed} onChange={(e) => setTyped(e.target.value)} />}
      {q.isPending && <Card><Empty>Loading…</Empty></Card>}
      {q.isError && <Card><Empty>Could not load your clients. Refresh to try again.</Empty></Card>}
      {q.data && q.data.length === 0 && <Card><Empty>{everyone ? 'No active members yet.' : 'No clients yet. Add one, or they appear here when you have a PT session booked with them.'}</Empty></Card>}
      {list.map((c) => (
        <Link key={c.userId} to={`/s/clients/${c.userId}`} className={`staff-client${c.needsReply > 0 ? ' needs' : ''}`}>
          <span className="avatar">{initials(c.name)}</span>
          <span className="staff-client-text">
            <b>{c.name}</b>
            <span className="muted">{clientLine(c, now)}</span>
          </span>
          <span aria-hidden="true" className="staff-chevron">›</span>
        </Link>
      ))}
      {adding && <AddClient currentIds={(q.data ?? []).map((c) => c.userId)} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddClient({ currentIds, onClose }: { currentIds: string[]; onClose: () => void }) {
  const { gym, userId } = useReadyAuth();
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ['assignable-members', gym.gymId], queryFn: () => loadAssignableMembers(gym.gymId) });
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const add = useMutation({
    mutationFn: (clientId: string) => addClient(gym.gymId, userId, clientId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['staff-clients', gym.gymId, userId] }); onClose(); },
    onError: () => setError('Could not add them. Try again.'),
  });
  const shown = addable(people.data ?? [], currentIds, userId, typed).slice(0, 30);
  return (
    <Modal title="Add a client" onClose={onClose}>
      <Input aria-label="Find a member" placeholder="Find a member" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
      {people.isPending && <div className="muted">Loading…</div>}
      {people.data && shown.length === 0 && <div className="muted">No members found.</div>}
      <div className="staff-pick">
        {shown.map((m) => (
          <button key={m.userId} type="button" className="staff-pick-row" disabled={add.isPending} onClick={() => add.mutate(m.userId)}>
            <span className="avatar">{initials(m.name)}</span><b>{m.name}</b>
          </button>
        ))}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </Modal>
  );
}
