// stripe-connect: links a gym to its own Stripe account (Stripe Connect, Accounts v2, with the full Stripe Dashboard for the gym) and keeps our copy of its status up to date.
//
// The owner's or an admin's own sign-in (JWT) calls it from Settings > Payments:
//   { action: 'start',   gym_id, return_to }   creates the gym's Stripe account if it has none, and returns { url }: Stripe's own
//                                              page where the gym finishes setting the account up (identity, bank, and so on)
//   { action: 'refresh', gym_id }              asks Stripe how that account is doing and saves it; returns { status }
// The caller must be an active owner or admin of that gym. The Stripe secret key never leaves this function: it is a Supabase
// secret named STRIPE_SECRET_KEY (set it in Edge Functions > Secrets, never in the app). Nothing here charges anyone.
//
// One file on purpose, so it can be pasted into the Supabase dashboard's function editor as well as deployed with the CLI.
// The small helpers at the top have no Deno-only code and are unit tested (web/tests/stripeconnect.test.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------
type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** A test key (sk_test_..., rk_test_...) means sandbox, anything else that looks like a key means live; no key at all is not allowed. */
export function environmentOf(key: string): 'sandbox' | 'live' | null {
  if (/^[sr]k_test_/.test(key)) return 'sandbox'
  if (/^[sr]k_live_/.test(key)) return 'live'
  return null
}

/** Where Stripe may send the owner back to: only our own site, never an address the request invents. */
export function returnAllowed(url: string, origins: string[]): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return origins.some((o) => o.replace(/\/+$/, '') === u.origin)
  } catch {
    return false
  }
}

/**
 * Stops two quick clicks making two Stripe accounts. Stripe replays the saved answer for the same key for 24 hours, errors included,
 * so the key changes every minute: a retry after fixing something on Stripe's side is never answered with the old failure.
 */
export const accountIdempotencyKey = (environment: string, gymId: string, now: number) => `hybridone-account-${environment}-${gymId}-${Math.floor(now / 60000)}`

export interface AccountState { details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean; last_error: string | null }

const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {})
const words = (v: string) => v.replace(/[._]/g, ' ')

/**
 * What we keep of a Stripe Accounts v2 account: three yes/no answers and, if Stripe is waiting on something, the first thing it says.
 *   charges_enabled     the merchant card_payments capability is active
 *   details_submitted   the gym has sent what Stripe asked for (the capability is active or Stripe is reviewing it)
 *   payouts_enabled     the merchant stripe_balance payouts capability is active
 */
export function accountState(a: Row): AccountState {
  const merchant = obj(obj(a.configuration).merchant)
  const caps = obj(merchant.capabilities)
  const card = str(obj(caps.card_payments).status)
  const payouts = str(obj(obj(caps.stripe_balance).payouts).status)
  const charges = card === 'active'
  const entries = Array.isArray(obj(a.requirements).entries) ? (obj(a.requirements).entries as unknown[]).map(obj) : []
  const due = entries.filter((e) => ['currently_due', 'past_due'].includes(str(obj(e.minimum_deadline).status))).map((e) => words(str(e.description) || str(e.reference_type) || 'something')).filter(Boolean)
  let last: string | null = null
  if (!charges && due.length > 0) last = `Stripe still needs: ${due.slice(0, 3).join(', ')}${due.length > 3 ? ' and more' : ''}.`
  else if (card === 'restricted' || card === 'unsupported') last = `Stripe has not allowed card payments on this account (${card}).`
  return { details_submitted: charges || card === 'pending' || (card === 'restricted' && due.length === 0), charges_enabled: charges, payouts_enabled: payouts === 'active', last_error: last }
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

const DEFAULT_ORIGINS = ['https://www.hybridone.co.uk', 'https://hybridone.co.uk', 'https://perranporthafcmens.github.io']
const ADMIN_ROLES = ['owner', 'admin']
const API = 'https://api.stripe.com'

// Accounts v2 speaks JSON and uses the account's default API version.
async function stripe(key: string, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, idempotency?: string): Promise<{ ok: boolean; status: number; json: Row }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
  if (body) headers['Content-Type'] = 'application/json'
  if (idempotency) headers['Idempotency-Key'] = idempotency
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = (await res.json().catch(() => ({}))) as Row
  return { ok: res.ok, status: res.status, json }
}
const stripeError = (r: { status: number; json: Row }) => `Stripe ${r.status}: ${str(obj(r.json.error).message) || 'something went wrong'}`
const INCLUDE = ['configuration.merchant', 'requirements']

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = 'start'
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const key = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    if (!url || !service) return reply(500, { error: 'Not configured' })
    const origins = [...DEFAULT_ORIGINS, ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)]
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

    stage = 'authenticate'
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return reply(401, { error: 'Unauthorised' })
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u?.user) return reply(401, { error: 'Unauthorised' })

    stage = 'read_request'
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; gym_id?: unknown; return_to?: unknown }
    const action = body.action === 'start' ? 'start' : body.action === 'refresh' ? 'refresh' : ''
    const gymId = str(body.gym_id)
    if (!action || !gymId) return reply(400, { error: 'action (start or refresh) and gym_id are required' })

    stage = 'check_access'
    const { data: gm, error: gmError } = await admin.from('gym_members').select('role,is_active,access_status').eq('gym_id', gymId).eq('user_id', u.user.id).limit(1).maybeSingle()
    if (gmError) return reply(500, { error: `Could not check your access: ${gmError.message}`, stage })
    if (!gm || gm.is_active !== true || gm.access_status !== 'active') return reply(403, { error: 'You are not part of this gym, so you cannot do that.', stage })
    if (!ADMIN_ROLES.includes(String(gm.role))) return reply(403, { error: `Only an owner or admin can manage payments (your role here is ${String(gm.role)}).`, stage })

    const environment = environmentOf(key)
    if (!environment) return reply(503, { error: 'Stripe is not set up yet: the STRIPE_SECRET_KEY secret is missing or is not a secret key.', stage })

    stage = 'load_account'
    const existing = await admin.from('gym_stripe_accounts').select('stripe_account_id,environment,connected_at').eq('gym_id', gymId).maybeSingle()
    if (existing.error) return reply(500, { error: `Could not read the Stripe link: ${existing.error.message}`, stage })
    let accountId = str(existing.data?.stripe_account_id)
    if (accountId && existing.data?.environment !== environment) {
      return reply(409, { error: `This gym was linked using ${existing.data?.environment === 'live' ? 'live' : 'test'} Stripe keys, but the keys now set are ${environment === 'live' ? 'live' : 'test'} ones. Switch the keys back, or ask for the link to be reset.`, stage })
    }

    if (action === 'start') {
      const returnTo = str(body.return_to)
      if (!returnAllowed(returnTo, origins)) return reply(400, { error: 'return_to must be a page on the HybridOne site.', stage })
      if (!accountId) {
        stage = 'create_account'
        const { data: gym, error: ge } = await admin.from('gyms').select('id,name,country_code,currency').eq('id', gymId).maybeSingle()
        if (ge || !gym) return reply(500, { error: `Could not read the gym: ${ge?.message ?? 'not found'}`, stage })
        const made = await stripe(key, 'POST', '/v2/core/accounts', {
          display_name: str(gym.name),
          contact_email: u.user.email ?? undefined,
          dashboard: 'full',
          identity: { country: (str(gym.country_code) || 'GB').toLowerCase() },
          configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
          defaults: { currency: (str(gym.currency) || 'GBP').toLowerCase(), responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
          metadata: { gym_id: gymId },
          include: INCLUDE,
        }, accountIdempotencyKey(environment, gymId, Date.now()))
        if (!made.ok) return reply(502, { error: stripeError(made), stage })
        accountId = str(made.json.id)
        if (!accountId) return reply(502, { error: 'Stripe did not return an account.', stage })
        const saved = await admin.from('gym_stripe_accounts').insert({ gym_id: gymId, stripe_account_id: accountId, environment, ...accountState(made.json) })
        // Two clicks at once give the same account (the idempotency key), so a duplicate here is fine.
        if (saved.error && saved.error.code !== '23505') return reply(500, { error: `Could not save the Stripe link: ${saved.error.message}`, stage })
      }
      stage = 'create_link'
      const link = await stripe(key, 'POST', '/v2/core/account_links', { account: accountId, use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['merchant'], refresh_url: returnTo, return_url: returnTo } } })
      if (!link.ok) return reply(502, { error: stripeError(link), stage })
      return reply(200, { ok: true, url: str(link.json.url) })
    }

    // refresh
    if (!accountId) return reply(200, { ok: true, status: { linked: false } })
    stage = 'read_account'
    const acct = await stripe(key, 'GET', `/v2/core/accounts/${encodeURIComponent(accountId)}?${INCLUDE.map((i) => `include=${encodeURIComponent(i)}`).join('&')}`)
    if (!acct.ok) return reply(502, { error: stripeError(acct), stage })
    const state = accountState(acct.json)
    const patch: Row = { ...state, updated_at: new Date().toISOString() }
    if (state.charges_enabled && !existing.data?.connected_at) patch.connected_at = new Date().toISOString()
    stage = 'save_account'
    const upd = await admin.from('gym_stripe_accounts').update(patch).eq('gym_id', gymId)
    if (upd.error) return reply(500, { error: `Could not save the Stripe link: ${upd.error.message}`, stage })
    return reply(200, { ok: true, status: { linked: true, ...state } })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
