// stripe-webhook: Stripe tells us a payment happened, so a membership is activated even if the member closed the page before it finished.
//
// Stripe calls this (no sign-in: it proves who it is with a signature, checked below). Set it up once in Stripe:
//   Developers > Webhooks > Add endpoint > "Listen to events on Connected accounts"
//   URL: https://<your-project>.supabase.co/functions/v1/stripe-webhook      (this function must NOT require a JWT)
//   Events: invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
//   Then copy the signing secret (whsec_...) into Supabase > Edge Functions > Secrets as STRIPE_WEBHOOK_SECRET.
// A paid invoice for a membership still waiting for its first payment makes it ACTIVE and records the payment and the card
// (only Stripe's token for it: no card detail is kept). Later paid invoices (monthly payments) are recorded too. Receiving the same event twice does nothing new.
// A failed payment is recorded as a FAILED payment (it then shows on the owner's Money owed list) and the member is emailed once per invoice.
// A subscription cancelled in Stripe ends the membership today and the member is told. If the email cannot be sent nothing else is undone.
//
// One file on purpose (it can be pasted into the Supabase function editor). The helpers at the top have no Deno-only code and are
// unit tested (web/tests/stripewebhook.test.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {})

// ---------------------------------------------------------------------------------------------------------------
// Helpers (tested)
// ---------------------------------------------------------------------------------------------------------------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Same length, same bytes, in time that does not depend on where they differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function sign(payload: string, secret: string, timestamp: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
}

/**
 * Stripe's signature check: the header "t=<time>,v1=<signature>" must match an HMAC of "<time>.<exact body>" made with the signing
 * secret, and the time must be recent (so an old captured request cannot be replayed).
 */
export async function verifySignature(payload: string, header: string, secret: string, nowSeconds: number, toleranceSeconds = 300): Promise<boolean> {
  if (!payload || !header || !secret) return false
  let t = 0
  const v1: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2)
    if (k?.trim() === 't') t = Number(v)
    else if (k?.trim() === 'v1' && v) v1.push(v.trim())
  }
  if (!Number.isFinite(t) || t <= 0 || v1.length === 0) return false
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false
  const expected = await sign(payload, secret, t)
  return v1.some((s) => safeEqual(s, expected))
}

/** The subscription an invoice belongs to, from either shape Stripe uses (newer: parent.subscription_details; older: subscription). */
export function subscriptionIdOf(invoice: Row): string {
  const a = str(obj(obj(invoice.parent).subscription_details).subscription)
  if (a) return a
  const b = invoice.subscription
  return typeof b === 'string' ? b : str(obj(b).id)
}

/** The id of a Stripe payment method ("pm_..."), from either the id itself or the expanded object. It is only a token: Stripe keeps the card, we keep nothing about it. */
export function paymentMethodId(pm: unknown): string {
  const id = typeof pm === 'string' ? pm : str(obj(pm).id)
  return /^pm_[A-Za-z0-9]+$/.test(id) ? id : ''
}

export function environmentOf(key: string): 'sandbox' | 'live' | null {
  if (/^[sr]k_test_/.test(key)) return 'sandbox'
  if (/^[sr]k_live_/.test(key)) return 'live'
  return null
}

export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))

export interface Mail { subject: string; html: string; text: string }

/** "1250" pence -> "£12.50". */
export const poundsOf = (pence: number) => `£${(Math.max(0, pence) / 100).toFixed(2)}`

/** The reason a card payment failed, in a few plain words. Stripe's own code is shown to nobody. */
export function failureWords(code: string): string {
  const c = code.toLowerCase()
  if (c.includes('insufficient')) return 'there was not enough money available'
  if (c.includes('expired')) return 'the card has expired'
  if (c.includes('lost') || c.includes('stolen') || c.includes('pickup')) return 'the card cannot be used'
  if (c.includes('declin')) return 'the card was declined'
  return 'the payment did not go through'
}

const para = (s: string) => `<p style="margin:0 0 12px;line-height:1.55">${s}</p>`
const shell = (gymName: string, heading: string, inner: string, link: string, button: string) => `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#101828"><div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border-radius:14px;padding:26px 24px;border:1px solid #e4e7ec"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#667085">${escapeHtml(gymName)}</div><h1 style="margin:10px 0 12px;font-size:21px;line-height:1.25">${escapeHtml(heading)}</h1>${inner}<p style="margin:22px 0 4px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#101828;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">${escapeHtml(button)}</a></p></div><p style="font-size:12px;color:#667085;margin:14px 6px">You are getting this because you have a membership at ${escapeHtml(gymName)} on HybridOne.</p></div></body></html>`

/** The member's payment did not go through. Tells them what to do and that the gym can help. */
export function paymentFailedMail(o: { gymName: string; firstName: string; amountPence: number; reason: string; link: string }): Mail {
  const hi = o.firstName ? `Hi ${o.firstName},` : 'Hi,'
  const a = `Your ${poundsOf(o.amountPence)} membership payment to ${o.gymName} did not go through: ${o.reason}.`
  const b = 'Your card will usually be tried again in the next few days. To avoid any gap in your membership, please check your card details or speak to the gym.'
  const button = 'Open my membership'
  return {
    subject: `Your ${o.gymName} payment did not go through`.replace(/[\r\n]+/g, ' ').slice(0, 200),
    html: shell(o.gymName, 'Your payment did not go through', para(escapeHtml(hi)) + para(escapeHtml(a)) + para(escapeHtml(b)), o.link, button),
    text: `${hi}\n\n${a}\n\n${b}\n\n${button}: ${o.link}\n\n${o.gymName}`,
  }
}

/** Stripe ended the subscription: the membership has ended. Says "payments could not be taken" only when Stripe's own reason is a payment failure. */
export function membershipEndedMail(o: { gymName: string; firstName: string; link: string; paymentFailed?: boolean }): Mail {
  const hi = o.firstName ? `Hi ${o.firstName},` : 'Hi,'
  const a = o.paymentFailed ? `Your membership at ${o.gymName} has ended because your payments could not be taken.` : `Your membership at ${o.gymName} has ended.`
  const b = 'If you would like to carry on, please speak to the gym or rejoin from the link below.'
  const button = 'Open HybridOne'
  return {
    subject: `Your ${o.gymName} membership has ended`.replace(/[\r\n]+/g, ' ').slice(0, 200),
    html: shell(o.gymName, 'Your membership has ended', para(escapeHtml(hi)) + para(escapeHtml(a)) + para(escapeHtml(b)), o.link, button),
    text: `${hi}\n\n${a}\n\n${b}\n\n${button}: ${o.link}\n\n${o.gymName}`,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The function
// ---------------------------------------------------------------------------------------------------------------
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const DEFAULT_V1_VERSION = '2025-03-31.basil'

// Just the parts of the Supabase client used here, so the helpers above stay free of its generated types.
type Admin = {
  rpc(fn: string, args: Row): PromiseLike<{ data: unknown; error: { message: string } | null }>
  from(table: string): { select(cols: string): { eq(col: string, v: string): { maybeSingle(): PromiseLike<{ data: unknown }> } } }
  auth: { admin: { getUserById(id: string): PromiseLike<{ data: { user?: { email?: string | null } | null } }> } }
}

/** Emails one member about their billing. Never throws and never undoes anything: the in-app notice does not depend on it. */
async function emailMember(admin: Admin, gymId: string, userId: string, build: (o: { gymName: string; firstName: string; link: string }) => Mail): Promise<boolean> {
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const site = (Deno.env.get('APP_URL') ?? 'https://www.hybridone.co.uk').replace(/\/+$/, '')
    if (!resendKey) return false
    const [gym, comms, profile, user] = await Promise.all([
      admin.from('gyms').select('name').eq('id', gymId).maybeSingle(),
      admin.from('gym_communication_settings').select('sender_name,sender_email,sender_domain_status,reply_to_email').eq('gym_id', gymId).maybeSingle(),
      admin.from('profiles').select('first_name').eq('id', userId).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ])
    const to = user.data.user?.email ?? ''
    if (!to) return false
    const gymName = str(obj(gym.data).name) || 'your gym'
    const c = obj(comms.data)
    const from = str(c.sender_domain_status) === 'verified' && str(c.sender_email) ? str(c.sender_email).toLowerCase() : 'noreply@hybridone.co.uk'
    const fromName = (str(c.sender_name) || gymName).replace(/[<>"\r\n]/g, '')
    const mail = build({ gymName, firstName: str(obj(profile.data).first_name), link: `${site}/` })
    const payload: Row = { from: `${fromName} <${from}>`, to: [to], subject: mail.subject, html: mail.html, text: mail.text }
    if (str(c.reply_to_email)) payload.reply_to = [str(c.reply_to_email)]
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` }, body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

async function onPaymentFailed(admin: Admin, invoice: Row): Promise<Response> {
  const subId = subscriptionIdOf(invoice)
  if (!subId) return json(200, { ok: true, ignored: 'not a subscription invoice' })
  const code = 'card_payment_failed'
  const amount = num(invoice.amount_due)
  const { data, error } = await admin.rpc('stripe_record_failed_payment', {
    p_subscription_id: subId, p_invoice_id: str(invoice.id), p_amount_pence: amount, p_currency: str(invoice.currency) || 'gbp',
    p_code: code, p_message: failureWords(code).replace(/^./, (c) => c.toUpperCase()),
  })
  if (error) return json(500, { error: error.message })
  const r = obj(data)
  let emailed = false
  // Stripe tries again and sends this event each time: the member is emailed once per invoice, on the first failure.
  if (r.ok === true && r.first_failure === true) {
    emailed = await emailMember(admin, str(r.gym_id), str(r.user_id), (o) => paymentFailedMail({ ...o, amountPence: amount, reason: failureWords(code) }))
  }
  return json(200, { ok: true, result: data, emailed })
}

async function onSubscription(admin: Admin, subId: string, status: string, deleted: boolean, reason: string): Promise<Response> {
  if (!subId) return json(200, { ok: true, ignored: 'no subscription' })
  const { data, error } = await admin.rpc('stripe_subscription_event', { p_subscription_id: subId, p_stripe_status: status, p_deleted: deleted })
  if (error) return json(500, { error: error.message })
  const r = obj(data)
  let emailed = false
  // Told only when Stripe is what ended the membership. If the app ended it first (a member leaving) nothing changed here, so no email.
  if (r.ok === true && r.changed === true && (deleted || status === 'canceled')) {
    emailed = await emailMember(admin, str(r.gym_id), str(r.user_id), (o) => membershipEndedMail({ ...o, paymentFailed: reason === 'payment_failed' }))
  }
  return json(200, { ok: true, result: data, emailed })
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const key = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    const version = (Deno.env.get('STRIPE_V1_API_VERSION') ?? '').trim() || DEFAULT_V1_VERSION
    if (!url || !service || !environmentOf(key) || !secret) return json(503, { error: 'Not configured' })

    const payload = await req.text()
    if (!(await verifySignature(payload, req.headers.get('Stripe-Signature') ?? '', secret, Math.floor(Date.now() / 1000)))) return json(400, { error: 'Bad signature' })
    const event = JSON.parse(payload) as Row
    const type = str(event.type)
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as Admin
    if (type === 'invoice.payment_failed') return await onPaymentFailed(admin, obj(obj(event.data).object))
    if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const sub = obj(obj(event.data).object)
      return await onSubscription(admin, str(sub.id), str(sub.status), type === 'customer.subscription.deleted', str(obj(sub.cancellation_details).reason))
    }
    if (type !== 'invoice.paid') return json(200, { ok: true, ignored: type })

    const account = str(event.account)
    const invoice = obj(obj(event.data).object)
    const subId = subscriptionIdOf(invoice)
    if (!account || !subId) return json(200, { ok: true, ignored: 'not a subscription invoice on a connected account' })

    // What the invoice does not say (which saved payment method it used, as a token) is asked of Stripe, using the platform key on that gym's account.
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
      headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': version, 'Stripe-Account': account },
    })
    const sub = (await res.json().catch(() => ({}))) as Row
    if (!res.ok) return json(502, { error: `Stripe ${res.status}` })
    const pmId = paymentMethodId(sub.default_payment_method)

    const { data, error } = await admin.rpc('stripe_activate_membership', {
      p_subscription_id: subId, p_invoice_id: str(invoice.id) || null, p_amount_pence: num(invoice.amount_paid), p_currency: str(invoice.currency) || 'gbp',
      p_paid_at: new Date().toISOString(), p_payment_method_id: pmId || null,
      p_card_brand: null, p_card_last4: null, p_card_exp_month: null, p_card_exp_year: null, // no card detail is kept: Stripe holds the card
    })
    if (error) return json(500, { error: error.message })
    // A retry that worked: the earlier failed record for this invoice becomes confirmed and the membership is no longer "failed".
    const cleared = await admin.rpc('stripe_clear_failed_payment', { p_subscription_id: subId, p_invoice_id: str(invoice.id) })
    if (cleared.error) return json(500, { error: cleared.error.message })
    return json(200, { ok: true, result: data })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Something went wrong' })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
