import { useState, type FormEvent } from 'react';
import { cleanCode, checkCode } from '../join/calc';
import { confirmWithCode } from '../data/auth';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import './signin.css';

/**
 * The "type the code from the email" step of every new-account screen (member join and Admin/Owner invitation).
 * One component, so a change to this step lands in both flows.
 */
export function EmailCodeForm({ email, resend, onConfirmed, onUseOtherEmail }: {
  email: string;
  resend: () => Promise<void>;
  onConfirmed: () => void | Promise<void>;
  onUseOtherEmail?: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);

  const run = async (problem: string | null, work: () => Promise<void>, good?: string) => {
    if (problem) return setMsg({ text: problem, good: false });
    setBusy(true);
    setMsg(null);
    try {
      await work();
      if (good) setMsg({ text: good, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.', good: false });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(checkCode(code), async () => {
      await confirmWithCode(email, cleanCode(code));
      setCode('');
      await onConfirmed();
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <h2>Check your email</h2>
      <p>We sent a code to <b>{email}</b>. Type it in here to confirm your email address and carry on.</p>
      <Field label="Code from the email" htmlFor="email-code">
        <Input id="email-code" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      {msg && <p className={`signin-msg${msg.good ? ' good' : ''}`} role={msg.good ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="code-nav">
        {onUseOtherEmail ? <Button onClick={() => { setMsg(null); setCode(''); onUseOtherEmail(); }} disabled={busy}>Use a different email</Button> : <span />}
        <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Confirm'}</Button>
      </div>
      <p><Button onClick={() => void run(null, resend, 'A new code is on its way. Use the newest email.')} disabled={busy}>Send me a new code</Button></p>
      <p className="muted small">It can take a minute. Check your spam folder too.</p>
    </form>
  );
}
