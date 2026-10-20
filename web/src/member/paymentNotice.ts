export interface PaymentNotice {
  failedCount: number;
  owedPence: number;
  endedForNonPayment: boolean;
}

/** Reads what the database sent, tolerating anything odd (no notice rather than a broken screen). */
export function readPaymentNotice(v: unknown): PaymentNotice {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
  return { failedCount: n(o.failed_count), owedPence: n(o.owed_pence), endedForNonPayment: o.ended_for_non_payment === true };
}

/** The heading and sentence a member sees, or null when there is nothing to say. */
export function paymentNoticeText(n: PaymentNotice, pounds: (pence: number) => string): { title: string; body: string } | null {
  if (n.endedForNonPayment) {
    return { title: 'Your membership has ended', body: 'Your payments could not be taken, so your membership has ended. Speak to the gym if you would like to carry on.' };
  }
  if (n.failedCount > 0) {
    const amount = n.owedPence > 0 ? ` of ${pounds(n.owedPence)}` : '';
    return {
      title: n.failedCount === 1 ? 'Your last payment did not go through' : `${n.failedCount} payments did not go through`,
      body: `A membership payment${n.failedCount === 1 ? '' : 's'}${amount} could not be taken from your card. It will usually be tried again soon. Please check your card or speak to the gym so your membership carries on.`,
    };
  }
  return null;
}
