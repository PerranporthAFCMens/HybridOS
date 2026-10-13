// stripe-membership-sync: makes STRIPE match what HybridOne says about a membership, so a member who has left is not billed.
//
// Called by the app (with the signed-in person's own sign-in) after anything that ends, schedules the end of, or takes back the end of
// a membership: a member asking to leave, staff approving or declining, staff ending a membership, a member taking a request back.
//   { membership_id }
// It reads the truth from the database and changes the Stripe subscription (on the gym's own Stripe account) to match:
//   - membership is over (cancelled / expired), or its end date has come   ->  the subscription is cancelled now, nothing more is charged
//   - an ending is booked for a future last day                             ->  the subscription is set to stop on that day (no later payment is taken)
//   - nothing is booked (a request was withdrawn or declined)               ->  any scheduled stop on the subscription is removed
// It never decides anything itself and never touches a membership: it only copies the database's answer to Stripe, so calling it twice,
// or by someone who should not have, can only make Stripe agree with the database. The caller must be able to see the membership.
//
// Secrets: STRIPE_SECRET_KEY. Optional: STRIPE_V1_API_VERSION. One file on purpose (it can be pasted into the Supabase function editor).
// The helpers at the top have no Deno-only code and are unit tested (web/tests/stripesync.test.ts).
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

export function stripeForm(values: Row): string {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}

export function environmentOf(key: string): 'sandbox' | 'live' | null {
  if (/^[sr]k_test_/.test(key)) return 'sandbox'
  if (/^[sr]k_live_/.test(key)) return 'live'
  return null
}

/** The moment (Unix seconds) a London day begins, for a date "YYYY-MM-DD". Handles summer and winter time. */
export function londonMidnightUnix(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return 0
  const utcMidnight = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false })
  // In summer London is an hour ahead, so its midnight is an hour BEFORE UTC midnight.
  for (const candidate of [utcMidnight - 3600_000, utcMidnight]) {
    if (fmt.format(new Date(candidate)).replace(/\D/g, '') === '0000' || fmt.format(new Date(candidate)) === '24:00') return candidate / 1000
  }
  return utcMidnight / 1000
}

export type SyncAction =
  | { kind: 'none'; why: string }
  | { kind: 'cancel_now' }
  | { kind: 'cancel_at'; at: number; lastDay: string }
  | { kind: 'clear' }

const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10)

/**
 * What to do to the Stripe subscription, given the database's state (from stripe_membership_state) and the subscription as Stripe has it.
 * A request's effective_on is the day AFTER the last day, so billing stops at the start of that day.
 */
export function actionFor(state: Row, sub: Row): SyncAction {
  const membership = obj(state.membership)
  if (membership.payment_provider !== 'stripe' || !str(membership.provider_subscription_id)) return { kind: 'none', why: 'Not a Stripe membership' }
  if (str(sub.status) === 'canceled') return { kind: 'none', why: 'Already cancelled in Stripe' }
  const status = str(membership.status)
  const today = str(state.today)
  const cancel = state.cancel === null || state.cancel === undefined ? null : obj(state.cancel)
  const effective = cancel ? str(cancel.effective_on) : ''
  if (status === 'cancelled' || status === 'expired') return { kind: 'cancel_now' }
  if (cancel && effective && today && effective <= today) return { kind: 'cancel_now' }
  if (cancel && effective) {
    const at = londonMidnightUnix(effective)
    if (num(sub.cancel_at) === at) return { kind: 'none', why: 'Stripe already stops on that day' }
    return { kind: 'cancel_at', at, lastDay: dayBefore(effective) }
  }
  if (num(sub.cancel_at) || sub.cancel_at_period_end === true) return { kind: 'clear' }
  return { kind: 'none', why: 'Nothing booked, nothing scheduled' }
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

async function stripe(key: string, version: string, account: string, method: 'GET' | 'POST' | 'DELETE', path: string, body?: Row): Promise<{ ok: boolean; status: number; json: Row }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Stripe-Version': version, 'Stripe-Account': account }
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
  const res = await fetch(`https://api.stripe.com${path}`, { method, headers, body: method === 'POST' && body ? stripeForm(body) : undefined })
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Row }
}
const stripeError = (r: { status: number; json: Row }) => `Stripe ${r.status}: ${str(obj(r.json.error).message) || 'something went wrong'}`

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = 'start'
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const key = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    const version = (Deno.env.get('STRIPE_V1_API_VERSION') ?? '').trim() || DEFAULT_V1_VERSION
    if (!url || !service || !anon) return reply(500, { error: 'Not configured' })
    if (!environmentOf(key)) return reply(503, { error: 'Payments are not set up yet: the STRIPE_SECRET_KEY secret is missing.', stage })

    stage = 'authenticate'
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return reply(401, { error: 'Unauthorised' })
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u?.user) return reply(401, { error: 'Unauthorised' })

    stage = 'read_request'
    const body = (await req.json().catch(() => ({}))) as Row
    const membershipId = str(body.membership_id)
    if (!/^[0-9a-f-]{36}$/i.test(membershipId)) return reply(400, { error: 'membership_id is required' })

    stage = 'check_access'
    // The caller must be able to see this membership (their own, or one at a gym they work at). Row security decides.
    const mine = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } })
    const seen = await mine.from('memberships').select('id').eq('id', membershipId).maybeSingle()
    if (seen.error || !seen.data) return reply(404, { error: 'Membership not found' })

    stage = 'read_state'
    const { data: stateRaw, error: se } = await admin.rpc('stripe_membership_state', { p_membership_id: membershipId })
    if (se) return reply(500, { error: `Could not read the membership: ${se.message}`, stage })
    const state = obj(stateRaw)
    if (state.ok !== true) return reply(404, { error: str(state.reason) || 'Membership not found', stage })
    const membership = obj(state.membership)
    const subId = str(membership.provider_subscription_id)
    const account = obj(state.account)
    if (membership.payment_provider !== 'stripe' || !subId) return reply(200, { ok: true, action: 'none', why: 'Not a Stripe membership' })
    const accountId = str(account.stripe_account_id)
    if (!accountId) return reply(409, { error: 'This gym has no Stripe account.', stage })
    if (str(account.environment) !== environmentOf(key)) return reply(409, { error: 'This gym is connected with different Stripe keys (test or live) from the ones now set.', stage })

    stage = 'read_subscription'
    const sub = await stripe(key, version, accountId, 'GET', `/v1/subscriptions/${encodeURIComponent(subId)}`)
    if (!sub.ok) return reply(502, { error: stripeError(sub), stage })

    const action = actionFor(state, sub.json)
    stage = 'change_subscription'
    if (action.kind === 'cancel_now') {
      const r = await stripe(key, version, accountId, 'DELETE', `/v1/subscriptions/${encodeURIComponent(subId)}`)
      if (!r.ok) return reply(502, { error: stripeError(r), stage })
    } else if (action.kind === 'cancel_at') {
      const r = await stripe(key, version, accountId, 'POST', `/v1/subscriptions/${encodeURIComponent(subId)}`, { cancel_at: action.at, proration_behavior: 'none' })
      if (!r.ok) return reply(502, { error: stripeError(r), stage })
    } else if (action.kind === 'clear') {
      const r = await stripe(key, version, accountId, 'POST', `/v1/subscriptions/${encodeURIComponent(subId)}`, { cancel_at: '', cancel_at_period_end: 'false', proration_behavior: 'none' })
      if (!r.ok) return reply(502, { error: stripeError(r), stage })
    }
    return reply(200, { ok: true, action: action.kind, ...(action.kind === 'cancel_at' ? { last_day: action.lastDay } : {}), ...(action.kind === 'none' ? { why: action.why } : {}) })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
