import { useState } from 'react';
import type { MemberDetails } from '../data/memberDetails';
import type { MemberRow } from '../data/members';
import { signedCopyUrl } from '../data/signup';
import { isUnder18 } from '../join/calc';
import { Button } from '../ui/Button';
import { Empty } from '../ui/Card';
import { DateInput, Field, FieldRow, Input } from '../ui/Field';
import { addressText, checkDetailsDraft, draftFromDetails, dobText, emergencyText, formatRegistered, phoneText } from './calc';
import { useMemberDetails, useSaveMemberDetails } from './useMembers';

type Message = { text: string; tone: 'good' | 'error' } | null;

function Msg({ m }: { m: Message }) {
  return m ? <span className={`msg ${m.tone}`} role="status">{m.text}</span> : null;
}

const HIDDEN = 'Hidden by the owner';

/** What the gym holds on a member: shown, and (for owners, admins and staff, unless the owner has hidden things from the team) editable. */
export function MemberDetailsCard({ gymId, member, team }: { gymId: string; member: MemberRow; team: boolean }) {
  const details = useMemberDetails(gymId, member.userId);
  const save = useSaveMemberDetails(gymId, member.userId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFromDetails(member, { dateOfBirth: null, phoneHidden: false, addressHidden: false, phone: null, hasDetails: false, address: null, emergency: null, guardian: null, signed: [] }));
  const [msg, setMsg] = useState<Message>(null);
  const [copyMsg, setCopyMsg] = useState<Message>(null);
  const set = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));

  const openCopy = async (path: string) => {
    try {
      window.open(await signedCopyUrl(path), '_blank', 'noopener');
    } catch (e) {
      setCopyMsg({ text: e instanceof Error ? e.message : 'Could not open it.', tone: 'error' });
    }
  };

  const body = (d: MemberDetails) => {
    const canEdit = !d.phoneHidden && !d.addressHidden;
    const start = () => {
      setDraft(draftFromDetails(member, d));
      setMsg(null);
      setEditing(true);
    };
    const submit = () => {
      const problem = checkDetailsDraft(draft, new Date());
      if (problem) return setMsg({ text: problem, tone: 'error' });
      save.mutate(draft, {
        onSuccess: () => { setEditing(false); setMsg({ text: 'Saved.', tone: 'good' }); },
        onError: (e) => setMsg({ text: e.message, tone: 'error' }),
      });
    };

    if (editing) {
      const under = isUnder18(draft.dob, new Date());
      return (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Edit personal details">
          <FieldRow>
            <Field label="First name" htmlFor="md-first"><Input id="md-first" autoComplete="off" value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
            <Field label="Surname" htmlFor="md-last"><Input id="md-last" autoComplete="off" value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Date of birth" htmlFor="md-dob"><DateInput id="md-dob" value={draft.dob} onChange={(e) => set({ dob: e.target.value })} /></Field>
            <Field label="Mobile number" htmlFor="md-phone"><Input id="md-phone" type="tel" autoComplete="off" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          </FieldRow>
          <Field label="Address line 1" htmlFor="md-line1"><Input id="md-line1" autoComplete="off" value={draft.line1} onChange={(e) => set({ line1: e.target.value })} /></Field>
          <Field label="Address line 2 (optional)" htmlFor="md-line2"><Input id="md-line2" autoComplete="off" value={draft.line2} onChange={(e) => set({ line2: e.target.value })} /></Field>
          <FieldRow>
            <Field label="Town or city" htmlFor="md-town"><Input id="md-town" autoComplete="off" value={draft.town} onChange={(e) => set({ town: e.target.value })} /></Field>
            <Field label="Postcode" htmlFor="md-postcode"><Input id="md-postcode" autoComplete="off" value={draft.postcode} onChange={(e) => set({ postcode: e.target.value })} /></Field>
          </FieldRow>
          <FieldRow>
            <Field label="Emergency contact name" htmlFor="md-ec-name"><Input id="md-ec-name" autoComplete="off" value={draft.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} /></Field>
            <Field label="Emergency contact phone" htmlFor="md-ec-phone"><Input id="md-ec-phone" type="tel" autoComplete="off" value={draft.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value })} /></Field>
          </FieldRow>
          <Field label="Emergency contact is their…" htmlFor="md-ec-rel" hint="For example partner, parent or friend."><Input id="md-ec-rel" autoComplete="off" value={draft.emergencyRelationship} onChange={(e) => set({ emergencyRelationship: e.target.value })} /></Field>
          {under && (
            <FieldRow>
              <Field label="Parent or guardian name" htmlFor="md-g-name"><Input id="md-g-name" autoComplete="off" value={draft.guardianName} onChange={(e) => set({ guardianName: e.target.value })} /></Field>
              <Field label="Parent or guardian phone" htmlFor="md-g-phone"><Input id="md-g-phone" type="tel" autoComplete="off" value={draft.guardianPhone} onChange={(e) => set({ guardianPhone: e.target.value })} /></Field>
            </FieldRow>
          )}
          <Button variant="primary" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save details'}</Button>{' '}
          <Button onClick={() => { setEditing(false); setMsg(null); }} disabled={save.isPending}>Cancel</Button>{' '}
          <Msg m={msg} />
        </form>
      );
    }

    return (
      <>
        <div className="profile">
          <div><small>Date of birth</small><b>{dobText(d.dateOfBirth, new Date())}</b></div>
          <div><small>Mobile</small><b>{d.phoneHidden ? HIDDEN : phoneText(d.phone)}</b></div>
          <div><small>Address</small><b>{d.addressHidden ? HIDDEN : addressText(d.address)}</b></div>
          <div><small>Emergency contact</small><b>{emergencyText(d.emergency)}</b></div>
          {d.guardian && <div><small>Parent or guardian</small><b>{d.guardian.name}, {phoneText(d.guardian.phone)}</b></div>}
        </div>
        {!d.hasDetails && !team && <div className="muted small">No address or emergency contact on file yet. Add them here, or they are asked when they join through the gym's sign-up link.</div>}
        {canEdit
          ? <Button onClick={start}>{d.hasDetails ? 'Edit details' : 'Add details'}</Button>
          : <div className="muted small">The owner has hidden some of these from the team, so only the owner can edit them.</div>}{' '}
        <Msg m={msg} />
        {d.signed.length > 0 && (
          <div>
            <small className="muted">Signed documents</small>
            {d.signed.map((x) => (
              <div key={x.id} className="muted small">
                Signed {formatRegistered(x.signedAt)} by {x.signerName}{x.isGuardian ? ' (parent or guardian)' : ''}{' '}
                {x.termsPath && <Button onClick={() => void openCopy(x.termsPath ?? '')}>Terms (PDF)</Button>}{' '}
                {x.waiverPath && <Button onClick={() => void openCopy(x.waiverPath ?? '')}>Waiver (PDF)</Button>}
              </div>
            ))}
            <Msg m={copyMsg} />
          </div>
        )}
      </>
    );
  };

  return (
    <section className="record-section" aria-label="Personal details">
      <h3>Personal details</h3>
      {details.isError ? <Empty>Could not load their details.</Empty> : !details.data ? <Empty>Loading details…</Empty> : body(details.data)}
    </section>
  );
}
