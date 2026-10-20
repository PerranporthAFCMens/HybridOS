// stripe-webhook: Stripe tells us a payment happened, so a membership is activated even if the member closed the page before it finished.
//
// Stripe calls this (no sign-in: it proves who it is with a signature, checked below). Set it up once in Stripe:
//   Developers > Webhooks > Add endpoint > "Listen to events on Connected accounts"
//   URL: https://<your-project>.supabase.co/functions/v1/stripe-webhook      (this function must NOT require a JWT)
//   Events: invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted, payment_intent.succeeded
//   Then copy the signing secret (whsec_...) into Supabase > Edge Functions > Secrets as STRIPE_WEBHOOK_SECRET.
// A paid invoice for a membership still waiting for its first payment makes it ACTIVE and records the payment and the card
// (only Stripe's token for it: no card detail is kept). Later paid invoices (monthly payments) are recorded too. Receiving the same event twice does nothing new.
// A failed payment is recorded as a FAILED payment (it then shows on the owner's Money owed list) and the member is emailed once per invoice.
// A paid class pack (a one-off card payment our own server marked as a class pack) makes the member's pack, once per payment. Other payments are ignored here.
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

const para = (s: string) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:#C9CFDC">${s}</p>`
const SANS = "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace"
// HybridOne look (BRAND.md): Midnight page, Deep card, logo, Volt button with Midnight text. Table layout and inline styles so it holds up in mail apps.
const shell = (gymName: string, heading: string, inner: string, link: string, button: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${escapeHtml(heading)}</title></head><body style="margin:0;padding:0;background:#0B1020;-webkit-text-size-adjust:100%"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0B1020" style="background:#0B1020"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px"><tr><td style="padding:0 4px 20px"><img src="https://www.hybridone.co.uk/assets/brand/logo/png/hybridone-logo-on-dark-800.png" width="132" alt="HybridOne" style="display:block;width:132px;height:auto;border:0;font-family:${SANS};font-size:18px;color:#ffffff"></td></tr><tr><td bgcolor="#121A2E" style="background:#121A2E;border:1px solid #232C44;border-radius:16px;padding:32px 28px;font-family:${SANS};font-size:16px;line-height:26px;color:#C9CFDC"><div style="font-family:${MONO};font-size:12px;line-height:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#8B95AB;padding:0 0 12px">${escapeHtml(gymName)}</div><div style="font-family:${SANS};font-size:28px;line-height:34px;font-weight:600;letter-spacing:-0.5px;color:#ffffff;padding:0 0 18px">${escapeHtml(heading)}</div>${inner}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 8px"><tr><td align="center" bgcolor="#C6F135" style="background:#C6F135;border-radius:10px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:600;color:#0B1020;text-decoration:none;border-radius:10px">${escapeHtml(button)}</a></td></tr></table></td></tr><tr><td style="padding:20px 8px 0;font-family:${SANS};font-size:12px;line-height:18px;color:#8B95AB">You are getting this because you have a membership at ${escapeHtml(gymName)} on HybridOne.<br><a href="https://www.hybridone.co.uk" style="color:#C9CFDC;text-decoration:none">Powered by HybridOne</a></td></tr></table></td></tr></table></body></html>`

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

/** What a paid class pack payment says about itself (metadata our own server put on it), or null if it is not one of ours. */
export function packPaymentFrom(pi: Row): { paymentId: string; gymId: string; userId: string; packTypeId: string; amountPence: number } | null {
  const m = obj(pi.metadata)
  const id = str(pi.id)
  if (str(m.kind) !== 'class_pack' || !/^pi_[A-Za-z0-9]+$/.test(id)) return null
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const gymId = str(m.gym_id)
  const userId = str(m.user_id)
  const packTypeId = str(m.pack_type_id)
  if (!uuid.test(gymId) || !uuid.test(userId) || !uuid.test(packTypeId)) return null
  return { paymentId: id, gymId, userId, packTypeId, amountPence: num(pi.amount_received) || num(pi.amount) }
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

async function onPackPaid(admin: Admin, pi: Row): Promise<Response> {
  const paid = packPaymentFrom(pi)
  if (!paid) return json(200, { ok: true, ignored: 'not a class pack payment' })
  const { data, error } = await admin.rpc('stripe_record_pack_purchase', {
    p_gym_id: paid.gymId, p_user_id: paid.userId, p_pack_type_id: paid.packTypeId, p_payment_id: paid.paymentId, p_amount_pence: paid.amountPence,
  })
  if (error) return json(500, { error: error.message })
  return json(200, { ok: true, pack_id: data })
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
    if (type === 'payment_intent.succeeded') return await onPackPaid(admin, obj(obj(event.data).object))
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
