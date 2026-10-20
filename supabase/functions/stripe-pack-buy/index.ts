// stripe-pack-buy: a member buys a class pack by card, on the GYM'S OWN Stripe account (a direct charge).
//
// The member's own sign-in (JWT) calls it from the app:
//   { action: 'prepare', gym_id, pack_type_id }
//        sets up a one-off payment and returns what the card form needs: { publishable_key, stripe_account, client_secret,
//        payment_intent_id, amount_pence, pack, wording }. Nothing is charged until the member confirms the card form.
//   { action: 'finish', gym_id, payment_intent_id }
//        after the card form says it worked: asks Stripe (not the browser) whether the payment really went through, and only then
//        makes the pack. { ok: true, status: 'paid', pack_id } or { ok: true, status: 'pending' } if it has not cleared yet.
// The Stripe webhook (stripe-webhook, event payment_intent.succeeded) does the same if the member closes the page before 'finish'.
// A payment makes exactly one pack however many times it is seen (the database holds the payment id as unique).
//
// Secrets (Supabase > Edge Functions > Secrets): STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY. Optional: STRIPE_V1_API_VERSION.
// One file on purpose (it can be pasted into the Supabase function editor). The helpers at the top have no Deno-only code and are
// unit tested (web/tests/stripepackbuy.test.ts).
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

/** Stripe's form encoding: nested objects as a[b]=c, lists as a[0][b]=c, lists of plain values as a[]=x. */
export function stripeForm(values: Row, prefix = ''): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') parts.push(stripeForm(item as Row, `${key}[${i}]`))
        else parts.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(String(item))}`)
      })
    } else if (typeof v === 'object') parts.push(stripeForm(v as Row, key))
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  return parts.filter(Boolean).join('&')
}

export function environmentOf(key: string): 'sandbox' | 'live' | null {
  if (/^[sr]k_test_/.test(key)) return 'sandbox'
  if (/^[sr]k_live_/.test(key)) return 'live'
  return null
}

export const poundsText = (pence: number) => `£${(Math.max(0, Math.round(pence)) / 100).toFixed(2)}`

/** "10 classes" / "1 class", with how long it lasts. */
export function packWords(name: string, credits: number, validDays: number | null): string {
  const classes = `${credits} ${credits === 1 ? 'class' : 'classes'}`
  const lasts = validDays ? `, to use within ${validDays} ${validDays === 1 ? 'day' : 'days'} of buying` : ', with no end date'
  return `${name} (${classes}${lasts})`
}

/** The words the member agrees to when they pay. Server-made, so the page cannot change them. */
export function packWording(o: { gymName: string; name: string; credits: number; validDays: number | null; amountPence: number }): string {
  return `I want to buy ${packWords(o.name, o.credits, o.validDays)} from ${o.gymName} and agree that ${o.gymName} can charge this card ${poundsText(o.amountPence)} once, today. I understand a class is used when I book and comes back if I cancel in time.`
}

/** A Stripe payment id ("pi_...") and nothing else, so it is safe to put in a URL. */
export const isPaymentIntentId = (v: string) => /^pi_[A-Za-z0-9]+$/.test(v)

/** What a paid class pack payment says about itself (metadata our own server put on it), or null if it is not one of ours. */
export function packPaymentFrom(pi: Row): { paymentId: string; gymId: string; userId: string; packTypeId: string; amountPence: number } | null {
  const m = obj(pi.metadata)
  const id = str(pi.id)
  if (str(m.kind) !== 'class_pack' || !isPaymentIntentId(id)) return null
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
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors })
const DEFAULT_V1_VERSION = '2025-03-31.basil'

async function stripe(key: string, version: string, account: string, method: 'GET' | 'POST', path: string, body?: Row, idempotency?: string): Promise<{ ok: boolean; status: number; json: Row }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Stripe-Version': version, 'Stripe-Account': account }
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (idempotency) headers['Idempotency-Key'] = idempotency
  const res = await fetch(`https://api.stripe.com${path}`, { method, headers, body: method === 'POST' && body ? stripeForm(body) : undefined })
  const json = (await res.json().catch(() => ({}))) as Row
  return { ok: res.ok, status: res.status, json }
}
const stripeError = (r: { status: number; json: Row }) => `Stripe ${r.status}: ${str(obj(r.json.error).message) || 'something went wrong'}`

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = 'start'
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const key = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    const publishable = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? ''
    const version = (Deno.env.get('STRIPE_V1_API_VERSION') ?? '').trim() || DEFAULT_V1_VERSION
    if (!url || !service) return reply(500, { error: 'Not configured' })
    const environment = environmentOf(key)
    if (!environment) return reply(503, { error: 'Payments are not set up yet: the STRIPE_SECRET_KEY secret is missing.', stage })
    if (!/^pk_(test|live)_/.test(publishable)) return reply(503, { error: 'Payments are not set up yet: the STRIPE_PUBLISHABLE_KEY secret is missing.', stage })
    if ((environment === 'sandbox') !== publishable.startsWith('pk_test_')) return reply(503, { error: 'The Stripe keys do not match: one is a test key and the other is live.', stage })
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

    stage = 'authenticate'
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return reply(401, { error: 'Unauthorised' })
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u?.user) return reply(401, { error: 'Unauthorised' })
    const userId = u.user.id
    const email = u.user.email ?? ''

    stage = 'read_request'
    const body = (await req.json().catch(() => ({}))) as Row
    const action = body.action === 'prepare' ? 'prepare' : body.action === 'finish' ? 'finish' : ''
    const gymId = str(body.gym_id)
    if (!action) return reply(400, { error: 'action (prepare or finish) is required' })
    if (!gymId) return reply(400, { error: 'gym_id is required' })

    if (action === 'finish') {
      const piId = str(body.payment_intent_id)
      if (!isPaymentIntentId(piId)) return reply(400, { error: 'payment_intent_id is required' })
      stage = 'account'
      const { data: acctRaw, error: ae } = await admin.from('gym_stripe_accounts').select('stripe_account_id').eq('gym_id', gymId).maybeSingle()
      const accountId = str(obj(acctRaw).stripe_account_id)
      if (ae || !accountId) return reply(409, { error: 'This gym has no Stripe account.', stage })
      stage = 'read_payment'
      const pi = await stripe(key, version, accountId, 'GET', `/v1/payment_intents/${piId}`)
      if (!pi.ok) return reply(502, { error: stripeError(pi), stage })
      const paid = packPaymentFrom(pi.json)
      // The payment must be a class pack payment made for this person at this gym.
      if (!paid || paid.userId !== userId || paid.gymId !== gymId) return reply(403, { error: 'That payment is not yours.', stage })
      if (str(pi.json.status) !== 'succeeded') return reply(200, { ok: true, status: 'pending', stripe_status: str(pi.json.status) })
      stage = 'record'
      const { data: packId, error: re } = await admin.rpc('stripe_record_pack_purchase', {
        p_gym_id: paid.gymId, p_user_id: paid.userId, p_pack_type_id: paid.packTypeId, p_payment_id: paid.paymentId, p_amount_pence: paid.amountPence,
      })
      if (re) return reply(500, { error: `Could not add your pack: ${re.message}`, stage })
      return reply(200, { ok: true, status: 'paid', pack_id: str(packId) })
    }

    // ---- prepare ----
    const packTypeId = str(body.pack_type_id)
    if (!packTypeId) return reply(400, { error: 'pack_type_id is required' })
    stage = 'context'
    const { data: ctxRaw, error: ce } = await admin.rpc('stripe_pack_context', { p_gym_id: gymId, p_user_id: userId, p_pack_type_id: packTypeId })
    if (ce) return reply(500, { error: `Could not read the class pack: ${ce.message}`, stage })
    const c = obj(ctxRaw)
    if (c.ok !== true) return reply(404, { error: str(c.reason) || 'That class pack is not available.', stage })
    if (c.takes_payments !== true) return reply(409, { error: 'This gym is not taking card payments yet.', stage })
    const acct = obj(c.account)
    const accountId = str(acct.stripe_account_id)
    if (!accountId || acct.charges_enabled !== true) return reply(409, { error: 'This gym cannot take card payments yet.', stage })
    if (str(acct.environment) !== environment) return reply(409, { error: 'This gym is connected with different Stripe keys (test or live) from the ones now set.', stage })
    const pack = obj(c.pack)
    const gym = obj(c.gym)
    const amount = num(pack.price_pence)
    if (amount < 30) return reply(409, { error: 'This class pack cannot be paid for online. Please ask the gym.', stage })
    const currency = (str(gym.currency) || 'GBP').toLowerCase()
    const validDays = typeof pack.valid_days === 'number' ? pack.valid_days : null

    stage = 'customer'
    let customerId = str(obj(c.customer).stripe_customer_id)
    if (!customerId || str(obj(c.customer).environment) !== environment) {
      const cust = await stripe(key, version, accountId, 'POST', '/v1/customers', { email, metadata: { user_id: userId, gym_id: gymId } }, `hybridone-customer-${gymId}-${userId}-${environment}`)
      if (!cust.ok) return reply(502, { error: stripeError(cust), stage })
      customerId = str(cust.json.id)
      const { error: se } = await admin.rpc('stripe_save_customer', { p_gym_id: gymId, p_user_id: userId, p_customer_id: customerId, p_environment: environment })
      if (se) return reply(500, { error: `Could not save your customer record: ${se.message}`, stage })
    }

    stage = 'payment'
    const pi = await stripe(key, version, accountId, 'POST', '/v1/payment_intents', {
      amount, currency, customer: customerId, automatic_payment_methods: { enabled: true },
      description: `${str(gym.name)}: ${str(pack.name)}`,
      metadata: { kind: 'class_pack', user_id: userId, gym_id: gymId, pack_type_id: packTypeId },
    })
    if (!pi.ok) return reply(502, { error: stripeError(pi), stage })
    const clientSecret = str(pi.json.client_secret)
    if (!clientSecret) return reply(502, { error: 'Stripe did not return a payment form.', stage })
    const wording = packWording({ gymName: str(gym.name), name: str(pack.name), credits: num(pack.credits), validDays, amountPence: amount })
    return reply(200, {
      ok: true, publishable_key: publishable, stripe_account: accountId, client_secret: clientSecret, payment_intent_id: str(pi.json.id),
      amount_pence: amount, pack: { id: packTypeId, name: str(pack.name), credits: num(pack.credits), valid_days: validDays }, wording,
    })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
