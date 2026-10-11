import { useState } from 'react';
import { useReadyAuth } from '../auth/AuthProvider';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { Checkbox } from '../ui/Field';
import '../members/members.css';
import { useContactVisibility } from './useMembers';

type Message = { text: string; tone: 'good' | 'error' } | null;

/** The owner chooses whether the team can see members' mobile numbers and addresses. */
export function Privacy() {
  const { gym } = useReadyAuth();
  const isOwner = gym.role === 'owner';
  const { query, save } = useContactVisibility(gym.gymId);
  // What the owner has ticked but not yet saved; until they tick something the saved setting is shown.
  const [edit, setEdit] = useState<{ phone?: boolean; address?: boolean }>({});
  const [msg, setMsg] = useState<Message>(null);
  const phone = edit.phone ?? query.data?.teamSeesPhone ?? true;
  const address = edit.address ?? query.data?.teamSeesAddress ?? true;

  const submit = () => {
    setMsg(null);
    save.mutate({ teamSeesPhone: phone, teamSeesAddress: address }, {
      onSuccess: () => { setEdit({}); setMsg({ text: 'Saved.', tone: 'good' }); },
      onError: (e) => setMsg({ text: e.message, tone: 'error' }),
    });
  };

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Who sees member details</h1>
          <div className="muted">Choose what your team (admins and staff) can see of your members' contact details. You always see everything.</div>
        </div>
      </header>
      <Card>
        {query.isError ? (
          <Empty>Could not load this setting.</Empty>
        ) : !query.data ? (
          <Empty>Loading…</Empty>
        ) : (
          <>
            <Checkbox label="The team can see members' mobile numbers" checked={phone} disabled={!isOwner} onChange={(v) => setEdit((e) => ({ ...e, phone: v }))} />
            <Checkbox label="The team can see members' addresses" checked={address} disabled={!isOwner} onChange={(v) => setEdit((e) => ({ ...e, address: v }))} />
            <p className="muted small">
              Emergency contacts, and a parent or guardian's details for under-18s, always stay visible to the team so they can be reached in an emergency.
              If you hide anything, only you can edit a member's details, because nobody should edit what they cannot see.
            </p>
            {isOwner
              ? <Button variant="primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
              : <div className="muted small">Only the gym's owner can change this.</div>}{' '}
            {msg && <span className={`msg ${msg.tone}`} role="status">{msg.text}</span>}
          </>
        )}
      </Card>
    </>
  );
}
