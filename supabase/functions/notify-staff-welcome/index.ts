// notify-staff-welcome: emails a new team member to welcome them and give them the link to the staff app.
//
// The owner's or admin's own sign-in (JWT) calls it right after adding the login:
//   { gym_id: '...', user_id: '...' }
// The caller must be an active owner or admin of that gym, and the person must have been made staff or coach in that gym in the
// last 15 minutes, so this cannot be used to send anyone an email out of the blue. The email never contains a password: a new
// login's temporary password is shown to the owner on screen, to pass on. A failed email changes nothing else.
//
// One file on purpose, so it can be pasted into the Supabase dashboard's function editor as well as deployed with the CLI.
// The wording at the top has no Deno-only code and is unit tested (web/tests/staffwelcome.test.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// ---------------------------------------------------------------------------------------------------------------
// The email. Warm and plain.
// ---------------------------------------------------------------------------------------------------------------
export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))

export interface Mail { subject: string; html: string; text: string }

export const roleWords = (role: string) => (role === 'coach' ? 'a coach' : 'a member of the team')

const para = (s: string) => `<p style="margin:0 0 12px;line-height:1.55">${s}</p>`

const shell = (gymName: string, heading: string, inner: string, link: string, button: string) => `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#101828"><div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border-radius:14px;padding:26px 24px;border:1px solid #e4e7ec"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#667085">${escapeHtml(gymName)}</div><h1 style="margin:10px 0 12px;font-size:21px;line-height:1.25">${escapeHtml(heading)}</h1>${inner}<p style="margin:22px 0 4px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#101828;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">${escapeHtml(button)}</a></p></div><p style="font-size:12px;color:#667085;margin:14px 6px">You are getting this because ${escapeHtml(gymName)} added you to its team on HybridOne.</p></div></body></html>`

/** Welcome to the team, with the way in. */
export function welcomeMail(o: { gymName: string; adderName: string; firstName: string; role: string; email: string; link: string }): Mail {
  const hi = o.firstName ? `Hi ${o.firstName},` : 'Hi,'
  const who = o.adderName ? `${o.adderName} has` : 'Your gym has'
  const intro = `${who} added you to the team at ${o.gymName} as ${roleWords(o.role)}. The staff app is where you will find your timetable and your working hours.`
  const how = `To sign in, open the link below and enter this email address: ${o.email}. If you were given a temporary password, use it. If not, choose "Email me a sign-in link" and we will send you one. You can pick your own password at any time with "Forgot password?".`
  const html = shell(o.gymName, `Welcome to the team at ${o.gymName}`, para(escapeHtml(hi)) + para(escapeHtml(intro)) + para(escapeHtml(how)), o.link, 'Open the staff app')
  const text = `${hi}\n\n${intro}\n\n${how}\n\nOpen the staff app: ${o.link}\n\n${o.gymName}`
  return { subject: `Welcome to the team at ${o.gymName}`.replace(/[\r\n]+/g, ' ').slice(0, 200), html, text }
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

const DEFAULT_FROM = 'noreply@hybridone.co.uk'
const DEFAULT_SITE = 'https://www.hybridone.co.uk'
const RECENT_MS = 15 * 60 * 1000

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const nameOf = (p: Row | null | undefined, fallback: string) => str(p?.display_name).trim() || [str(p?.first_name), str(p?.last_name)].filter(Boolean).join(' ').trim() || fallback
const recent = (iso: unknown) => Date.now() - Date.parse(str(iso)) < RECENT_MS

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = 'start'
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const site = (Deno.env.get('APP_URL') ?? DEFAULT_SITE).replace(/\/+$/, '')
    if (!url || !service) return reply(500, { error: 'Not configured' })
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

    stage = 'authenticate'
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return reply(401, { error: 'Unauthorised' })
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u?.user) return reply(401, { error: 'Unauthorised' })
    const callerId = u.user.id

    stage = 'read_request'
    const body = (await req.json().catch(() => ({}))) as { gym_id?: unknown; user_id?: unknown }
    const gymId = str(body.gym_id)
    const userId = str(body.user_id)
    if (!gymId || !userId) return reply(400, { error: 'gym_id and user_id are required' })

    stage = 'check_access'
    const { data: caller, error: callerError } = await admin.from('gym_members').select('role,is_active,access_status').eq('gym_id', gymId).eq('user_id', callerId).limit(1).maybeSingle()
    if (callerError) return reply(500, { error: `Could not check your access: ${callerError.message}`, stage })
    if (!caller || caller.is_active !== true || caller.access_status !== 'active' || !['owner', 'admin'].includes(String(caller.role))) return reply(403, { error: 'Only an owner or admin can welcome someone to the team.', stage })

    stage = 'check_person'
    const { data: person, error: personError } = await admin.from('gym_members').select('role,is_active,access_status,created_at,updated_at').eq('gym_id', gymId).eq('user_id', userId).limit(1).maybeSingle()
    if (personError) return reply(500, { error: `Could not read the team member: ${personError.message}`, stage })
    if (!person || !['staff', 'coach'].includes(String(person.role)) || person.is_active !== true) return reply(404, { error: 'That person is not on this gym\'s team.', stage })
    if (!recent(person.created_at) && !recent(person.updated_at)) return reply(400, { error: 'That person was added too long ago to send a welcome now.', stage })

    stage = 'load_context'
    const [gymQ, commsQ, callerQ, personQ, target] = await Promise.all([
      admin.from('gyms').select('id,name').eq('id', gymId).maybeSingle(),
      admin.from('gym_communication_settings').select('sender_name,sender_email,sender_domain_status,reply_to_email').eq('gym_id', gymId).maybeSingle(),
      admin.from('profiles').select('first_name,last_name,display_name').eq('id', callerId).maybeSingle(),
      admin.from('profiles').select('first_name,last_name,display_name').eq('id', userId).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ])
    const gymName = str((gymQ.data as Row | null)?.name) || 'your gym'
    const comms = (commsQ.data ?? {}) as Row
    const adderName = nameOf(callerQ.data as Row | null, '')
    const firstName = str((personQ.data as Row | null)?.first_name).trim() || nameOf(personQ.data as Row | null, '').split(' ')[0] || ''
    const to = target.data?.user?.email ?? ''

    if (!to) return reply(200, { ok: true, emailed: false, email_error: 'That person has no email address.' })
    if (!resendKey) return reply(200, { ok: true, emailed: false, email_error: 'Email is not configured.' })

    stage = 'send_email'
    const link = `${site}/login?gym_id=${encodeURIComponent(gymId)}`
    const mail = welcomeMail({ gymName, adderName, firstName, role: String(person.role), email: to, link })
    const from = comms.sender_domain_status === 'verified' && str(comms.sender_email) ? str(comms.sender_email).toLowerCase() : DEFAULT_FROM
    const fromName = (str(comms.sender_name) || gymName).replace(/[<>"\r\n]/g, '')
    const payload: Record<string, unknown> = { from: `${fromName} <${from}>`, to: [to], subject: mail.subject, html: mail.html, text: mail.text }
    const rt = str(comms.reply_to_email)
    if (rt) payload.reply_to = [rt]
    const day = new Date().toISOString().slice(0, 10)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}`, 'Idempotency-Key': `staff-welcome-${gymId}-${userId}-${day}`.slice(0, 250) },
      body: JSON.stringify(payload),
    })
    if (res.ok) return reply(200, { ok: true, emailed: true })
    return reply(200, { ok: true, emailed: false, email_error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
