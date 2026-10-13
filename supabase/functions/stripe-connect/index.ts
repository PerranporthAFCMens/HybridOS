// stripe-connect: links a gym to its own Stripe account (Stripe Connect, Standard accounts) and keeps our copy of its status up to date.
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

/** Stripe wants form encoding with brackets for nested values: { metadata: { gym_id: 'x' } } -> metadata[gym_id]=x */
export function stripeForm(values: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object') parts.push(stripeForm(v as Record<string, unknown>, key))
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
  }
  return parts.filter(Boolean).join('&')
}

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

export interface AccountState { details_submitted: boolean; charges_enabled: boolean; payouts_enabled: boolean; last_error: string | null }

/** What we keep of Stripe's account: three yes/no answers and, if Stripe is waiting on something, the first thing it says. */
export function accountState(a: Row): AccountState {
  const req = (a.requirements ?? {}) as Row
  const disabled = str(req.disabled_reason)
  const due = Array.isArray(req.currently_due) ? (req.currently_due as unknown[]).map(str).filter(Boolean) : []
  let last: string | null = null
  if (disabled) last = `Stripe has paused this account (${disabled.replace(/[._]/g, ' ')}).`
  else if (a.charges_enabled !== true && due.length > 0) last = `Stripe still needs: ${due.slice(0, 3).map((d) => d.replace(/[._]/g, ' ')).join(', ')}${due.length > 3 ? ' and more' : ''}.`
  return { details_submitted: a.details_submitted === true, charges_enabled: a.charges_enabled === true, payouts_enabled: a.payouts_enabled === true, last_error: last }
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
const API = 'https://api.stripe.com/v1'

async function stripe(key: string, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, idempotency?: string): Promise<{ ok: boolean; status: number; json: Row }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (idempotency) headers['Idempotency-Key'] = idempotency
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? stripeForm(body) : undefined })
  const json = (await res.json().catch(() => ({}))) as Row
  return { ok: res.ok, status: res.status, json }
}
const stripeError = (r: { status: number; json: Row }) => `Stripe ${r.status}: ${str(((r.json.error ?? {}) as Row).message) || 'something went wrong'}`

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
        const { data: gym, error: ge } = await admin.from('gyms').select('id,name,country_code').eq('id', gymId).maybeSingle()
        if (ge || !gym) return reply(500, { error: `Could not read the gym: ${ge?.message ?? 'not found'}`, stage })
        const made = await stripe(key, 'POST', '/accounts', { type: 'standard', country: str(gym.country_code) || 'GB', business_profile: { name: str(gym.name) }, metadata: { gym_id: gymId } }, `hybridone-account-${environment}-${gymId}`)
        if (!made.ok) return reply(502, { error: stripeError(made), stage })
        accountId = str(made.json.id)
        if (!accountId) return reply(502, { error: 'Stripe did not return an account.', stage })
        const saved = await admin.from('gym_stripe_accounts').insert({ gym_id: gymId, stripe_account_id: accountId, environment, ...accountState(made.json) })
        // Two clicks at once give the same account (the idempotency key), so a duplicate here is fine.
        if (saved.error && saved.error.code !== '23505') return reply(500, { error: `Could not save the Stripe link: ${saved.error.message}`, stage })
      }
      stage = 'create_link'
      const link = await stripe(key, 'POST', '/account_links', { account: accountId, refresh_url: returnTo, return_url: returnTo, type: 'account_onboarding' })
      if (!link.ok) return reply(502, { error: stripeError(link), stage })
      return reply(200, { ok: true, url: str(link.json.url) })
    }

    // refresh
    if (!accountId) return reply(200, { ok: true, status: { linked: false } })
    stage = 'read_account'
    const acct = await stripe(key, 'GET', `/accounts/${encodeURIComponent(accountId)}`)
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
