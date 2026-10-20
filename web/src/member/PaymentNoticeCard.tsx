import { useQuery } from '@tanstack/react-query';
import { useReadyAuth } from '../auth/AuthProvider';
import { getMyPaymentNotice } from '../data/paymentNotice';
import { pounds } from '../reports/library';
import { paymentNoticeText } from './paymentNotice';

/** A red card on the member's home screen when a payment failed or Stripe ended their membership. Nothing at all otherwise (or if it cannot be read). */
export function PaymentNoticeCard() {
  const { gym } = useReadyAuth();
  const q = useQuery({ queryKey: ['m-payment-notice', gym.gymId], queryFn: () => getMyPaymentNotice(gym.gymId), retry: false });
  const text = q.data ? paymentNoticeText(q.data, pounds) : null;
  if (!text) return null;
  return (
    <section className="mem-card pay-problem" role="alert" aria-label="Payment problem">
      <b>{text.title}</b>
      <div className="muted small">{text.body}</div>
    </section>
  );
}
