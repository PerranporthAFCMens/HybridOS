// stripe-join: takes a new member's first payment when they join a gym, on the GYM'S OWN Stripe account (a direct charge).
//
// The member's own sign-in (JWT) calls it from the sign-up page, after they have saved their details and signed:
//   { action: 'prepare', gym_id, plan_id, guardian?: { name, email } }
//        sets up the payment and returns what the card form needs: { publishable_key, stripe_account, client_secret, subscription_id,
//        amount_due_pence, next_payment_date, wording }. The membership is created PENDING (no access) and what the member is agreeing
//        to is recorded word for word. Calling it again (another card, a retry) reuses the same pending membership.
//   { action: 'finish', subscription_id }
//        after the card form says it worked: asks Stripe (not the browser) whether it did, and only then makes the membership ACTIVE.
// A person under 18 needs a parent or guardian: their name and email are required and they are the one who agrees and pays.
// The Stripe webhook (stripe-webhook) does the same activation if the member closes the page before 'finish'; doing it twice is harmless.
//
// Secrets (Supabase > Edge Functions > Secrets): STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY. Optional: STRIPE_V1_API_VERSION.
// One file on purpose (it can be pasted into the Supabase function editor). The helpers at the top have no Deno-only code and are
// unit tested (web/tests/stripejoin.test.ts).
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

/** How a membership plan's billing interval looks to Stripe. One-off plans are not subscriptions and are not handled here. */
export function recurringOf(interval: string): { interval: 'week' | 'month' | 'year'; interval_count: number } | null {
  switch (interval) {
    case 'weekly': return { interval: 'week', interval_count: 1 }
    case 'monthly': return { interval: 'month', interval_count: 1 }
    case 'quarterly': return { interval: 'month', interval_count: 3 }
    case 'annual': return { interval: 'year', interval_count: 1 }
    default: return null
  }
}

export const poundsText = (pence: number) => `£${(Math.max(0, Math.round(pence)) / 100).toFixed(2)}`

/** Under 18 on the given day (YYYY-MM-DD). An unreadable date counts as not under 18, and the database has already checked it. */
export function isUnder18(dob: string, today: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today)
  if (!m || !t) return false
  return Date.UTC(Number(m[1]) + 18, Number(m[2]) - 1, Number(m[3])) > Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]))
}

const EVERY: Record<string, string> = { weekly: 'week', monthly: 'month', quarterly: '3 months', annual: 'year' }
const dayText = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ''} ${m[1]}`
}

/**
 * The exact words the member agrees to, saved word for word with the payment. Server-made, so the page cannot change them.
 * It covers: starting today and the 14 day cooling-off (people who join online), the amounts and dates, and being charged later.
 */
export function agreementWording(o: { gymName: string; planName: string; interval: string; amountPence: number; dueTodayPence: number; nextPaymentDate: string; memberName: string; guardianName: string | null; minTermMonths?: number | null; noticeDays?: number | null }): string {
  const every = EVERY[o.interval] ?? 'period'
  const who = o.guardianName ? `I am ${o.memberName}'s parent or guardian. I agree to pay for this membership, to be responsible for ${o.memberName} while at the gym, and ` : 'I '
  return [
    `${who}want the ${o.planName} membership at ${o.gymName} to start today. I understand I can cancel within 14 days of joining, and that I would then pay for the days I have used.`,
    `I agree that ${o.gymName} can charge this card ${poundsText(o.dueTodayPence)} today, then ${poundsText(o.amountPence)} every ${every} from ${dayText(o.nextPaymentDate)}, and for any classes, visits or passes I buy and any payment I miss.`,
    termsWording(o.minTermMonths ?? null, o.noticeDays ?? null),
  ].filter(Boolean).join(' ')
}

/** The plan's term and notice in the agreement, in the person's own words. Empty when the plan sets neither. */
export function termsWording(term: number | null, notice: number | null): string {
  const noticeText = (d: number) => (d % 30 === 0 ? (d === 30 ? '1 month' : `${d / 30} months`) : d % 7 === 0 ? (d === 7 ? '1 week' : `${d / 7} weeks`) : d === 1 ? '1 day' : `${d} days`)
  const parts: string[] = []
  if (term !== null) parts.push(term > 0 ? `this membership has a minimum term of ${term === 1 ? '1 month' : `${term} months`}` : 'this membership has no minimum term')
  if (notice !== null) parts.push(notice > 0 ? `I need to give ${noticeText(notice)} notice to cancel` : 'I can cancel at any time')
  if (parts.length === 0) return ''
  const text = parts.join(' and ')
  return `I understand that ${text}.`
}

/** The client secret the card form needs, from either shape of invoice Stripe may send (newer: confirmation_secret; older: payment_intent). */
export function invoiceSecret(invoice: Row): string {
  const a = str(obj(invoice.confirmation_secret).client_secret)
  if (a) return a
  return str(obj(invoice.payment_intent).client_secret)
}

/** The id of a Stripe payment method ("pm_..."), from either the id itself or the expanded object. It is only a token: Stripe keeps the card, we keep nothing about it. */
export function paymentMethodId(pm: unknown): string {
  const id = typeof pm === 'string' ? pm : str(obj(pm).id)
  return /^pm_[A-Za-z0-9]+$/.test(id) ? id : ''
}

/** The date the next payment is due, as YYYY-MM-DD in UTC, from a Stripe subscription (item period end, or the subscription's own). */
export function nextPaymentDate(sub: Row): string {
  const item = obj(Array.isArray(obj(sub.items).data) ? (obj(sub.items).data as unknown[])[0] : null)
  const end = num(item.current_period_end) || num(sub.current_period_end)
  return end ? new Date(end * 1000).toISOString().slice(0, 10) : ''
}

export const todayUtc = (now: number) => new Date(now).toISOString().slice(0, 10)

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

async function stripe(key: string, version: string, account: string, method: 'GET' | 'POST' | 'DELETE', path: string, body?: Row, idempotency?: string): Promise<{ ok: boolean; status: number; json: Row }> {
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

    if (action === 'finish') {
      const subId = str(body.subscription_id)
      if (!/^sub_[A-Za-z0-9]+$/.test(subId) || !gymId || !str(body.plan_id)) return reply(400, { error: 'gym_id, plan_id and subscription_id are required' })
      stage = 'context'
      const { data: ctx, error: ce } = await admin.rpc('stripe_join_context', { p_gym_id: gymId, p_user_id: userId, p_plan_id: str(body.plan_id) })
      // The membership must be this person's own, tied to this subscription.
      const c = obj(ctx)
      const mine = obj(c.membership)
      if (ce) return reply(500, { error: `Could not check your membership: ${ce.message}`, stage })
      if (str(mine.provider_subscription_id) !== subId) return reply(403, { error: 'That payment is not yours.', stage })
      const acct = str(obj(c.account).stripe_account_id)
      if (!acct) return reply(409, { error: 'This gym has no Stripe account.', stage })
      stage = 'read_subscription'
      const sub = await stripe(key, version, acct, 'GET', `/v1/subscriptions/${subId}?expand[]=latest_invoice`)
      if (!sub.ok) return reply(502, { error: stripeError(sub), stage })
      const status = str(sub.json.status)
      if (status !== 'active' && status !== 'trialing') return reply(200, { ok: true, status: 'pending', stripe_status: status })
      const inv = obj(sub.json.latest_invoice)
      const pmId = paymentMethodId(sub.json.default_payment_method)
      stage = 'activate'
      const { data: act, error: ae } = await admin.rpc('stripe_activate_membership', {
        p_subscription_id: subId, p_invoice_id: str(inv.id) || null, p_amount_pence: num(inv.amount_paid), p_currency: str(inv.currency) || 'gbp',
        p_paid_at: new Date().toISOString(), p_payment_method_id: pmId || null,
        p_card_brand: null, p_card_last4: null, p_card_exp_month: null, p_card_exp_year: null, // no card detail is kept: Stripe holds the card
      })
      if (ae) return reply(500, { error: `Could not start your membership: ${ae.message}`, stage })
      return reply(200, { ok: true, status: 'active', membership_id: str(obj(act).membership_id), next_payment_date: nextPaymentDate(sub.json) })
    }

    // ---- prepare ----
    const planId = str(body.plan_id)
    if (!gymId || !planId) return reply(400, { error: 'gym_id and plan_id are required' })
    stage = 'context'
    const { data: ctxRaw, error: ce } = await admin.rpc('stripe_join_context', { p_gym_id: gymId, p_user_id: userId, p_plan_id: planId })
    if (ce) return reply(500, { error: `Could not read the membership: ${ce.message}`, stage })
    const c = obj(ctxRaw)
    if (c.ok !== true) return reply(404, { error: str(c.reason) || 'That membership is not available.', stage })
    if (c.takes_payments !== true) return reply(409, { error: 'This gym is not taking payments through the sign-up page.', stage })
    const gaps = Array.isArray(c.gaps) ? (c.gaps as unknown[]).map(str).filter(Boolean) : []
    if (gaps.length > 0) return reply(409, { error: `Finish your details first: ${gaps.join(', ')}.`, stage })
    const acct = obj(c.account)
    const accountId = str(acct.stripe_account_id)
    if (!accountId || acct.charges_enabled !== true) return reply(409, { error: 'This gym cannot take card payments yet.', stage })
    if (str(acct.environment) !== environment) return reply(409, { error: 'This gym is connected with different Stripe keys (test or live) from the ones now set.', stage })
    const plan = obj(c.plan)
    const gym = obj(c.gym)
    const person = obj(c.person)
    const planName = str(plan.name)
    const amount = num(plan.price_pence)
    const rec = recurringOf(str(plan.billing_interval))
    if (!rec || amount <= 0) return reply(409, { error: 'This membership cannot be paid for online yet. Please ask the gym.', stage })
    const currency = (str(gym.currency) || 'GBP').toLowerCase()
    const status = str(obj(c.membership).status)
    if (c.membership && status !== 'pending') return reply(409, { error: 'You already have a membership at this gym. Contact your gym to change it.', stage })

    // A parent or guardian pays for anyone under 18.
    const under18 = isUnder18(str(person.date_of_birth), todayUtc(Date.now()))
    const g = obj(body.guardian)
    const guardianName = str(g.name).trim()
    const guardianEmail = str(g.email).trim().toLowerCase()
    if (under18 && (guardianName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))) return reply(400, { error: 'A parent or guardian pays for anyone under 18. Enter their name and email address.', stage })
    const memberName = [str(person.first_name), str(person.last_name)].filter(Boolean).join(' ').trim() || 'the member'
    const payerEmail = under18 ? guardianEmail : email

    stage = 'price'
    let priceId = str(obj(c.price).stripe_price_id)
    const priceOk = priceId && num(obj(c.price).amount_pence) === amount && str(obj(c.price).billing_interval) === str(plan.billing_interval) && str(obj(c.price).environment) === environment
    if (!priceOk) {
      const prod = str(obj(c.price).stripe_product_id) && str(obj(c.price).environment) === environment
        ? { ok: true, status: 200, json: { id: str(obj(c.price).stripe_product_id) } as Row }
        : await stripe(key, version, accountId, 'POST', '/v1/products', { name: `${str(gym.name)}: ${planName}`, metadata: { plan_id: planId, gym_id: gymId } }, `hybridone-product-${planId}-${environment}`)
      if (!prod.ok) return reply(502, { error: stripeError(prod), stage })
      const price = await stripe(key, version, accountId, 'POST', '/v1/prices', { product: str(prod.json.id), currency, unit_amount: amount, recurring: rec, metadata: { plan_id: planId } }, `hybridone-price-${planId}-${amount}-${str(plan.billing_interval)}-${environment}`)
      if (!price.ok) return reply(502, { error: stripeError(price), stage })
      priceId = str(price.json.id)
      const { error: se } = await admin.rpc('stripe_save_plan_price', { p_plan_id: planId, p_product_id: str(prod.json.id), p_price_id: priceId, p_amount_pence: amount, p_interval: str(plan.billing_interval), p_environment: environment })
      if (se) return reply(500, { error: `Could not save the price: ${se.message}`, stage })
    }

    stage = 'customer'
    let customerId = str(obj(c.customer).stripe_customer_id)
    if (!customerId || str(obj(c.customer).environment) !== environment) {
      const cust = await stripe(key, version, accountId, 'POST', '/v1/customers', { email: payerEmail, name: under18 ? guardianName : memberName, metadata: { user_id: userId, gym_id: gymId, member_name: memberName } }, `hybridone-customer-${gymId}-${userId}-${environment}`)
      if (!cust.ok) return reply(502, { error: stripeError(cust), stage })
      customerId = str(cust.json.id)
      const { error: se } = await admin.rpc('stripe_save_customer', { p_gym_id: gymId, p_user_id: userId, p_customer_id: customerId, p_environment: environment })
      if (se) return reply(500, { error: `Could not save your customer record: ${se.message}`, stage })
    } else if (payerEmail) {
      await stripe(key, version, accountId, 'POST', `/v1/customers/${customerId}`, { email: payerEmail, name: under18 ? guardianName : memberName })
    }

    stage = 'subscription'
    // A retry (another card after a decline, or coming back later) reuses the open subscription if it is still for this price, else starts afresh.
    const existingSub = str(obj(c.membership).provider_subscription_id)
    let sub: { ok: boolean; status: number; json: Row } | null = null
    if (existingSub && status === 'pending') {
      const old = await stripe(key, version, accountId, 'GET', `/v1/subscriptions/${existingSub}?expand[]=latest_invoice.confirmation_secret`)
      const oldPrice = str(obj(obj(Array.isArray(obj(old.json.items).data) ? (obj(old.json.items).data as unknown[])[0] : null).price).id)
      if (old.ok && str(old.json.status) === 'incomplete' && oldPrice === priceId && invoiceSecret(obj(old.json.latest_invoice))) sub = old
      else if (old.ok && str(old.json.status) === 'incomplete') await stripe(key, version, accountId, 'DELETE', `/v1/subscriptions/${existingSub}`)
    }
    if (!sub) {
      sub = await stripe(key, version, accountId, 'POST', '/v1/subscriptions', {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
        metadata: { user_id: userId, gym_id: gymId, plan_id: planId },
      })
      if (!sub.ok) return reply(502, { error: stripeError(sub), stage })
    }
    const invoice = obj(sub.json.latest_invoice)
    const clientSecret = invoiceSecret(invoice)
    if (!clientSecret) return reply(502, { error: 'Stripe did not return a payment form.', stage })
    const dueToday = num(invoice.amount_due) || amount
    const next = nextPaymentDate(sub.json)
    const wording = agreementWording({ gymName: str(gym.name), planName, interval: str(plan.billing_interval), amountPence: amount, dueTodayPence: dueToday, nextPaymentDate: next, memberName, guardianName: under18 ? guardianName : null,
      minTermMonths: typeof plan.min_term_months === 'number' ? plan.min_term_months : null, noticeDays: typeof plan.notice_days === 'number' ? plan.notice_days : null })

    stage = 'save'
    const { error: be } = await admin.rpc('stripe_begin_membership', {
      p_gym_id: gymId, p_user_id: userId, p_plan_id: planId, p_subscription_id: str(sub.json.id), p_customer_id: customerId, p_wording: wording,
      p_signer_name: under18 ? guardianName : memberName, p_signer_is_guardian: under18, p_amount_pence: dueToday, p_first_payment_date: todayUtc(Date.now()),
    })
    if (be) return reply(409, { error: be.message, stage })
    return reply(200, { ok: true, publishable_key: publishable, stripe_account: accountId, client_secret: clientSecret, subscription_id: str(sub.json.id), amount_due_pence: dueToday, amount_pence: amount, interval: str(plan.billing_interval), next_payment_date: next, wording, under18 })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
