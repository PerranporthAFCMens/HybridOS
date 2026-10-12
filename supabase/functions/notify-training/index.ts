// notify-training: emails a client when their coach sets them workouts, or replies to a workout they did.
//
// The coach's own sign-in (JWT) calls it right after assigning or replying:
//   { kind: 'assigned', assignment_ids: [...] }   one email for the whole set, whatever its size
//   { kind: 'feedback', feedback_id: '...' }      one email for that reply
// The caller must be an owner, admin, staff or coach of the same gym, must be the person who set the workouts or wrote the
// reply, and it must have happened in the last 15 minutes, so this cannot be used to send someone an old or someone else's
// message. The in-app notice is separate (a database trigger) and does not depend on this: a failed email changes nothing else.
//
// One file on purpose, so it can be pasted into the Supabase dashboard's function editor as well as deployed with the CLI.
// The wording at the top has no Deno-only code and is unit tested (web/tests/trainingemail.test.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// ---------------------------------------------------------------------------------------------------------------
// The emails. Calm and plain: no deadline, no pressure.
// ---------------------------------------------------------------------------------------------------------------
export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))

export interface Mail { subject: string; html: string; text: string }

const shell = (gymName: string, heading: string, inner: string, link: string, button: string) => `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#101828"><div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border-radius:14px;padding:26px 24px;border:1px solid #e4e7ec"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#667085">${escapeHtml(gymName)}</div><h1 style="margin:10px 0 12px;font-size:21px;line-height:1.25">${escapeHtml(heading)}</h1>${inner}<p style="margin:22px 0 4px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#101828;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">${escapeHtml(button)}</a></p></div><p style="font-size:12px;color:#667085;margin:14px 6px">You are getting this because ${escapeHtml(gymName)} uses HybridOne to share training with you.</p></div></body></html>`

const joinTitles = (titles: string[]) => (titles.length <= 1 ? titles[0] ?? '' : `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`)

/** The coach has set one or several workouts. No deadline, do them whenever. */
export function assignedMail(o: { gymName: string; coachName: string; firstName: string; titles: string[]; note: string; link: string }): Mail {
  const n = o.titles.length
  const what = n === 1 ? 'a workout' : `${n} workouts`
  const hi = o.firstName ? `Hi ${o.firstName},` : 'Hi,'
  const note = o.note.trim()
  const html = shell(
    o.gymName,
    `${o.coachName} has set you ${what}`,
    `<p style="margin:0 0 12px;line-height:1.55">${escapeHtml(hi)}</p><p style="margin:0 0 12px;line-height:1.55"><b>${escapeHtml(joinTitles(o.titles))}</b>${n === 1 ? ' is' : ' are'} waiting for you in the app. There is no deadline. Do ${n === 1 ? 'it' : 'them'} whenever suits you, and if you change anything, just say what and why. ${escapeHtml(o.coachName)} will have a look afterwards.</p>${note ? `<p style="margin:0 0 12px;line-height:1.55;padding:10px 12px;background:#f2f4f7;border-radius:10px">&ldquo;${escapeHtml(note)}&rdquo;</p>` : ''}`,
    o.link,
    'Open my workouts',
  )
  const text = `${hi}\n\n${o.coachName} has set you ${what}: ${joinTitles(o.titles)}.\nThere is no deadline. Do ${n === 1 ? 'it' : 'them'} whenever suits you, and if you change anything, just say what and why.${note ? `\n\n"${note}"` : ''}\n\nOpen my workouts: ${o.link}\n\n${o.gymName}`
  return { subject: `${o.coachName} has set you ${what} - ${o.gymName}`.replace(/[\r\n]+/g, ' ').slice(0, 200), html, text }
}

/** The coach has replied to a workout the client did. */
export function feedbackMail(o: { gymName: string; coachName: string; firstName: string; title: string; reply: string; link: string }): Mail {
  const hi = o.firstName ? `Hi ${o.firstName},` : 'Hi,'
  const reply = o.reply.trim().slice(0, 1200)
  const html = shell(
    o.gymName,
    `${o.coachName} replied to your workout`,
    `<p style="margin:0 0 12px;line-height:1.55">${escapeHtml(hi)}</p><p style="margin:0 0 12px;line-height:1.55">About <b>${escapeHtml(o.title)}</b>:</p><p style="margin:0 0 12px;line-height:1.55;padding:10px 12px;background:#f2f4f7;border-radius:10px;white-space:pre-wrap">${escapeHtml(reply)}</p>`,
    o.link,
    'Read it in the app',
  )
  const text = `${hi}\n\n${o.coachName} replied to your workout, ${o.title}:\n\n"${reply}"\n\nRead it in the app: ${o.link}\n\n${o.gymName}`
  return { subject: `${o.coachName} replied to your workout - ${o.gymName}`.replace(/[\r\n]+/g, ' ').slice(0, 200), html, text }
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
const COACH_ROLES = ['owner', 'admin', 'staff', 'coach']

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
    const coachId = u.user.id

    stage = 'read_request'
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; assignment_ids?: unknown; feedback_id?: unknown }
    const kind = body.kind === 'feedback' ? 'feedback' : body.kind === 'assigned' ? 'assigned' : ''
    if (!kind) return reply(400, { error: 'kind must be assigned or feedback' })

    // What happened, and to whom.
    let gymId = ''
    let clientId = ''
    let titles: string[] = []
    let note = ''
    let assignmentId = ''
    let replyText = ''
    let idempotency = ''
    if (kind === 'assigned') {
      stage = 'load_assignments'
      const ids = Array.isArray(body.assignment_ids) ? body.assignment_ids.map(str).filter(Boolean).slice(0, 30) : []
      if (ids.length === 0) return reply(400, { error: 'assignment_ids is required' })
      const { data, error } = await admin.from('workout_assignments').select('id,gym_id,member_user_id,title,assigned_by,source,created_at,workout_snapshot').in('id', ids)
      if (error) return reply(500, { error: `Could not read the workouts: ${error.message}`, stage })
      const rows = (data ?? []) as Row[]
      if (rows.length !== ids.length) return reply(404, { error: 'Those workouts could not be found.', stage })
      if (!rows.every((r) => r.gym_id === rows[0]?.gym_id && r.member_user_id === rows[0]?.member_user_id)) return reply(400, { error: 'Those workouts are not all for one person.', stage })
      if (!rows.every((r) => r.source === 'pt' && r.assigned_by === coachId)) return reply(403, { error: 'You can only send the email for workouts you set.', stage })
      if (!rows.every((r) => recent(r.created_at))) return reply(400, { error: 'Those workouts were set too long ago to email about now.', stage })
      gymId = str(rows[0]?.gym_id)
      clientId = str(rows[0]?.member_user_id)
      titles = rows.map((r) => str(r.title)).filter(Boolean)
      const snap = rows[0]?.workout_snapshot as Row | null
      note = str(snap?.coach_note)
      idempotency = `training-assigned-${[...ids].sort().join('-')}`.slice(0, 250)
    } else {
      stage = 'load_feedback'
      const fid = str(body.feedback_id)
      if (!fid) return reply(400, { error: 'feedback_id is required' })
      const { data: f, error: fe } = await admin.from('workout_assignment_feedback').select('id,gym_id,assignment_id,author_id,body,created_at').eq('id', fid).maybeSingle()
      if (fe) return reply(500, { error: `Could not read the reply: ${fe.message}`, stage })
      if (!f) return reply(404, { error: 'That reply could not be found.', stage })
      if (f.author_id !== coachId) return reply(403, { error: 'You can only send the email for a reply you wrote.', stage })
      if (!recent(f.created_at)) return reply(400, { error: 'That reply was written too long ago to email about now.', stage })
      const { data: a, error: ae } = await admin.from('workout_assignments').select('id,member_user_id,title').eq('id', f.assignment_id).maybeSingle()
      if (ae || !a) return reply(500, { error: `Could not read the workout: ${ae?.message ?? 'not found'}`, stage })
      gymId = str(f.gym_id)
      clientId = str(a.member_user_id)
      titles = [str(a.title)]
      assignmentId = str(a.id)
      replyText = str(f.body)
      idempotency = `training-feedback-${fid}`
    }

    stage = 'check_access'
    const { data: gm, error: gmError } = await admin.from('gym_members').select('role,is_active,access_status').eq('gym_id', gymId).eq('user_id', coachId).limit(1).maybeSingle()
    if (gmError) return reply(500, { error: `Could not check your access: ${gmError.message}`, stage })
    if (!gm) return reply(403, { error: 'You are not part of this gym, so you cannot do that.', stage })
    if (gm.is_active !== true || gm.access_status !== 'active') return reply(403, { error: `Your access to this gym is not active (${String(gm.access_status)}).`, stage })
    if (!COACH_ROLES.includes(String(gm.role))) return reply(403, { error: `Only the team can do that (your role here is ${String(gm.role)}).`, stage })

    stage = 'load_context'
    const [gymQ, commsQ, coachQ, clientQ, target] = await Promise.all([
      admin.from('gyms').select('id,name').eq('id', gymId).maybeSingle(),
      admin.from('gym_communication_settings').select('sender_name,sender_email,sender_domain_status,reply_to_email').eq('gym_id', gymId).maybeSingle(),
      admin.from('profiles').select('first_name,last_name,display_name').eq('id', coachId).maybeSingle(),
      admin.from('profiles').select('first_name,last_name,display_name').eq('id', clientId).maybeSingle(),
      admin.auth.admin.getUserById(clientId),
    ])
    const gymName = str((gymQ.data as Row | null)?.name) || 'your gym'
    const comms = (commsQ.data ?? {}) as Row
    const coachName = nameOf(coachQ.data as Row | null, 'Your coach')
    const firstName = str((clientQ.data as Row | null)?.first_name).trim() || nameOf(clientQ.data as Row | null, '').split(' ')[0] || ''
    const to = target.data?.user?.email ?? ''

    if (!to) return reply(200, { ok: true, emailed: false, email_error: 'The client has no email address.' })
    if (!resendKey) return reply(200, { ok: true, emailed: false, email_error: 'Email is not configured.' })

    stage = 'send_email'
    const link = kind === 'assigned' ? `${site}/m/train` : `${site}/m/train/done/${assignmentId}`
    const mail = kind === 'assigned'
      ? assignedMail({ gymName, coachName, firstName, titles, note, link })
      : feedbackMail({ gymName, coachName, firstName, title: titles[0] ?? 'your workout', reply: replyText, link })
    const from = comms.sender_domain_status === 'verified' && str(comms.sender_email) ? str(comms.sender_email).toLowerCase() : DEFAULT_FROM
    const fromName = (str(comms.sender_name) || gymName).replace(/[<>"\r\n]/g, '')
    const payload: Record<string, unknown> = { from: `${fromName} <${from}>`, to: [to], subject: mail.subject, html: mail.html, text: mail.text }
    const rt = str(comms.reply_to_email)
    if (rt) payload.reply_to = [rt]
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}`, 'Idempotency-Key': idempotency },
      body: JSON.stringify(payload),
    })
    if (res.ok) return reply(200, { ok: true, emailed: true })
    return reply(200, { ok: true, emailed: false, email_error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
