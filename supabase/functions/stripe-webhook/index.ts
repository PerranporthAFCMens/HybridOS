// stripe-webhook: Stripe tells us a payment happened, so a membership is activated even if the member closed the page before it finished.
//
// Stripe calls this (no sign-in: it proves who it is with a signature, checked below). Set it up once in Stripe:
//   Developers > Webhooks > Add endpoint > "Listen to events on Connected accounts"
//   URL: https://<your-project>.supabase.co/functions/v1/stripe-webhook      (this function must NOT require a JWT)
//   Events: invoice.paid
//   Then copy the signing secret (whsec_...) into Supabase > Edge Functions > Secrets as STRIPE_WEBHOOK_SECRET.
// A paid invoice for a membership still waiting for its first payment makes it ACTIVE and records the payment and the card
// (brand, last four, expiry). Later paid invoices (monthly payments) are recorded too. Receiving the same event twice does nothing new.
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

export function cardOf(pm: Row | null | undefined): { id: string; brand: string; last4: string; month: number; year: number } | null {
  const c = obj(obj(pm).card)
  const last4 = str(c.last4)
  if (!pm || !/^\d{4}$/.test(last4)) return null
  return { id: str(obj(pm).id), brand: str(c.brand) || 'card', last4, month: num(c.exp_month), year: num(c.exp_year) }
}

export function environmentOf(key: string): 'sandbox' | 'live' | null {
  if (/^[sr]k_test_/.test(key)) return 'sandbox'
  if (/^[sr]k_live_/.test(key)) return 'live'
  return null
}

// ---------------------------------------------------------------------------------------------------------------
// The function
// ---------------------------------------------------------------------------------------------------------------
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const DEFAULT_V1_VERSION = '2025-03-31.basil'

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
    if (type !== 'invoice.paid') return json(200, { ok: true, ignored: type })

    const account = str(event.account)
    const invoice = obj(obj(event.data).object)
    const subId = subscriptionIdOf(invoice)
    if (!account || !subId) return json(200, { ok: true, ignored: 'not a subscription invoice on a connected account' })

    // What the invoice does not say (the card) is asked of Stripe, using the platform key on that gym's account.
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}?expand[]=default_payment_method`, {
      headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': version, 'Stripe-Account': account },
    })
    const sub = (await res.json().catch(() => ({}))) as Row
    if (!res.ok) return json(502, { error: `Stripe ${res.status}` })
    const card = cardOf(obj(sub.default_payment_method))

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await admin.rpc('stripe_activate_membership', {
      p_subscription_id: subId, p_invoice_id: str(invoice.id) || null, p_amount_pence: num(invoice.amount_paid), p_currency: str(invoice.currency) || 'gbp',
      p_paid_at: new Date().toISOString(), p_payment_method_id: card?.id ?? null, p_card_brand: card?.brand ?? null, p_card_last4: card?.last4 ?? null,
      p_card_exp_month: card?.month ?? null, p_card_exp_year: card?.year ?? null,
    })
    if (error) return json(500, { error: error.message })
    return json(200, { ok: true, result: data })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Something went wrong' })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
