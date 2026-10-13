import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { loadPayments, type PaymentsData, refreshStripe, savePaymentSettings, startStripe } from '../data/payments';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox, Field, Select } from '../ui/Field';
import { hourOptions, stripeStatus, windowText } from './calc';
import '../members/members.css';
import '../staff/staff.css';

/** Settings > Payments: link the gym's Stripe account, the "take payments" switch, and how long before a class a member can cancel. */
export function Payments() {
  const { gym } = useReadyAuth();
  const qc = useQueryClient();
  const key = ['payments', gym.gymId];
  const data = useQuery({ queryKey: key, queryFn: () => loadPayments(gym.gymId) });
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const fail = (e: Error) => { setSaved(''); setMessage(e.message); };

  const link = data.data?.link ?? null;
  // Coming back from Stripe (or any visit while set-up is unfinished): ask Stripe once how the account is doing.
  useQuery({
    queryKey: ['stripe-refresh', gym.gymId],
    enabled: !!link && !link.chargesEnabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      await refreshStripe(gym.gymId);
      await qc.invalidateQueries({ queryKey: key });
      return true;
    },
  });

  const connect = useMutation({
    mutationFn: () => startStripe(gym.gymId, `${window.location.origin}${window.location.pathname}`),
    onSuccess: (url) => window.location.assign(url),
    onError: fail,
  });
  const check = useMutation({
    mutationFn: () => refreshStripe(gym.gymId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: fail,
  });
  const save = useMutation({
    mutationFn: (v: { enabled: boolean; cancellationHours: number }) => savePaymentSettings(gym.gymId, v),
    // The switch and the list move at once; they go back only if saving fails (the database refuses to switch payments on before Stripe is ready).
    onMutate: (v) => {
      void qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<PaymentsData>(key);
      qc.setQueryData<PaymentsData>(key, (old) => (old ? { ...old, settings: v } : old));
      return { before };
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: key }); setSaved('Saved.'); },
    onError: (e, _v, ctx) => { qc.setQueryData(key, ctx?.before); fail(e); },
  });

  const status = stripeStatus(link);
  const settings = data.data?.settings;

  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Payments</h1>
          <div className="muted">Let members pay for classes by card through your own Stripe account.</div>
        </div>
      </header>
      {message && <div className="error" role="alert">{message}</div>}
      {data.isPending && <div className="muted">Loading…</div>}
      {data.isError && <div className="error" role="alert">Could not load your payment settings.</div>}

      {data.data && settings && (
        <>
          <Card>
            <h3>Stripe</h3>
            <div role="status"><b>{status.headline}</b></div>
            <div className="muted">{status.detail}</div>
            {link?.environment === 'sandbox' && <div className="muted small">This is a test connection: no real money moves.</div>}
            <div className="staff-top">
              <Button variant="primary" onClick={() => { setMessage(''); connect.mutate(); }} disabled={connect.isPending}>{connect.isPending ? 'Opening Stripe…' : status.button}</Button>
              {link && <Button onClick={() => { setMessage(''); check.mutate(); }} disabled={check.isPending}>{check.isPending ? 'Checking…' : 'Check again'}</Button>}
            </div>
          </Card>

          <Card>
            <h3>Take payments</h3>
            <Checkbox
              label="Members can pay by card"
              checked={settings.enabled}
              disabled={status.step !== 'ready' || save.isPending}
              onChange={(on) => { setMessage(''); setSaved(''); save.mutate({ ...settings, enabled: on }); }}
            />
            <div className="muted" role="status">
              {status.step !== 'ready'
                ? 'Connect Stripe first. This stays off until Stripe says your account can take card payments.'
                : settings.enabled
                  ? 'Payments are on.'
                  : 'Payments are off. Nothing is charged to anyone while this is off.'}
            </div>
          </Card>

          <Card>
            <h3>Cancelling a class</h3>
            <Field label="Members can cancel" htmlFor="pay-hours" hint={`Members can cancel ${windowText(settings.cancellationHours)}. After that, a pass credit is used or a charge is made.`}>
              <Select id="pay-hours" value={String(settings.cancellationHours)} disabled={save.isPending} onChange={(e) => { setMessage(''); setSaved(''); save.mutate({ ...settings, cancellationHours: Number(e.target.value) }); }}>
                {hourOptions(settings.cancellationHours).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            {saved && <div className="muted" role="status">{saved}</div>}
          </Card>
        </>
      )}
    </>
  );
}
