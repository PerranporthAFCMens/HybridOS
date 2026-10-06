import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

type EmailData = {
  token?: string
  token_hash?: string
  redirect_to?: string
  email_action_type?: string
  site_url?: string
  token_new?: string
  token_hash_new?: string
  old_email?: string
  old_phone?: string
  provider?: string
  factor_type?: string
}

type HookUser = {
  id: string
  email?: string
  new_email?: string
  user_metadata?: Record<string, unknown>
}

type GymContext = {
  id: string
  name: string
  slug?: string | null
  senderName: string
  senderEmail: string
  replyTo?: string | null
  accent: string
  logoUrl?: string | null
  footer: string
  invitedBy?: string | null
  inviteRole?: string | null
  accessInvite: boolean
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const HOOK_SECRET_RAW = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''
const DEFAULT_FROM = 'noreply@hybridone.co.uk'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[c] ?? c))

const safeSubject = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 220)
const safeAccent = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value) : '#0b1020'
const safeHttpsUrl = (value: unknown) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'https:' ? url.toString() : null
  } catch { return null }
}
const fill = (value: unknown, fallback: string, vars: Record<string, string>) => {
  let out = String(value || fallback)
  for (const [key, replacement] of Object.entries(vars)) out = out.replaceAll(`{{${key}}}`, replacement)
  return out
}
const asParagraphs = (text: string) => text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(p).replaceAll('\n', '<br>')}</p>`).join('')

function parseRedirect(value?: string) {
  try { return value ? new URL(value) : null } catch { return null }
}

function contextFromRow(row: any): GymContext {
  const configuredFrom = String(row?.sender_email || '').trim().toLowerCase()
  const senderEmail = row?.sender_domain_status === 'verified' && configuredFrom ? configuredFrom : DEFAULT_FROM
  return {
    id: String(row.gym_id),
    name: String(row.gym_name),
    slug: row.gym_slug || null,
    senderName: String(row.sender_name || row.gym_name),
    senderEmail,
    replyTo: row.reply_to_email || null,
    accent: safeAccent(row.accent_color),
    logoUrl: safeHttpsUrl(row.logo_url),
    footer: String(row.footer_text || `Sent by ${row.gym_name} via HybridOne`),
    invitedBy: row.invited_by || null,
    inviteRole: row.invite_role || null,
    accessInvite: row.access_invite === true,
  }
}

async function resolveGymContext(user: HookUser, emailData: EmailData): Promise<GymContext | null> {
  const redirect = parseRedirect(emailData.redirect_to)
  if (!redirect) return null

  const accessToken = redirect.searchParams.get('access_invite') || ''
  const gymId = redirect.searchParams.get('gym_id') || ''
  let signupSlug: string | null = null

  if (emailData.email_action_type === 'signup') {
    signupSlug = redirect.searchParams.get('gym') || ''
    const pathLooksLikeJoin = /(?:^|\/)join(?:\.html)?$/i.test(redirect.pathname)
    if (!signupSlug || !pathLooksLikeJoin) return null
  }

  if (!accessToken && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gymId)) return null

  const { data: rows, error } = await admin.rpc('get_auth_email_context', {
    p_user_id: user.id || null,
    p_email: String(user.email || ''),
    p_gym_id: gymId || null,
    p_access_invite: accessToken || null,
    p_signup_slug: signupSlug || null,
  })
  if (error) throw error
  const row = rows?.[0]
  return row ? contextFromRow(row) : null
}

function actionDefaults(action: string, gymName: string, accessInvite: boolean) {
  if (accessInvite) return {
    key: 'access_invite', subject: `You've been invited to ${gymName} on HybridOne`, preheader: `Join ${gymName} on HybridOne.`,
    heading: `You've been invited to ${gymName}`, body: `{{invited_by}} has invited you to join ${gymName} as {{role}} on HybridOne.`, button: 'Accept invitation',
  }
  const map: Record<string, {key:string;subject:string;preheader:string;heading:string;body:string;button:string}> = {
    signup: { key:'signup_confirmation', subject:`Confirm your email for ${gymName}`, preheader:`Finish setting up your ${gymName} account.`, heading:'Confirm your email address', body:`Confirm this email address to finish setting up your ${gymName} account.`, button:'Confirm email' },
    magiclink: { key:'magic_link', subject:`Your ${gymName} sign-in link`, preheader:`Securely sign in to ${gymName}.`, heading:`Sign in to ${gymName}`, body:'Use the secure button below to sign in. This link expires and can only be used as intended.', button:'Sign in securely' },
    recovery: { key:'password_reset', subject:`Reset your ${gymName} password`, preheader:`Choose a new password for ${gymName}.`, heading:'Reset your password', body:`We received a request to reset the password used for ${gymName}. If this was you, use the secure button below.`, button:'Reset password' },
    invite: { key:'account_invite', subject:`You've been invited to ${gymName}`, preheader:`Your ${gymName} invitation.`, heading:`You've been invited to ${gymName}`, body:`You've been invited to access ${gymName}. Use the secure button below to continue.`, button:'Accept invitation' },
    email_change: { key:'email_change', subject:`Confirm your new email for ${gymName}`, preheader:'Confirm your new email address.', heading:'Confirm your new email address', body:`Confirm this email address to update your ${gymName} account.`, button:'Confirm new email' },
    reauthentication: { key:'reauthentication', subject:`Your ${gymName} verification code`, preheader:'Your secure verification code.', heading:'Verify it’s you', body:'Use the verification code below to continue.', button:'' },
    password_changed_notification: { key:'password_changed_notification', subject:`Your ${gymName} password was changed`, preheader:'Security notice.', heading:'Your password was changed', body:'The password for your account was recently changed. If you did not make this change, request a password reset immediately.', button:'' },
    email_changed_notification: { key:'email_changed_notification', subject:`Your ${gymName} email address was changed`, preheader:'Security notice.', heading:'Your email address was changed', body:'The email address for your account was recently changed. If you did not make this change, contact your gym.', button:'' },
    phone_changed_notification: { key:'phone_changed_notification', subject:`Your ${gymName} phone number was changed`, preheader:'Security notice.', heading:'Your phone number was changed', body:'The phone number for your account was recently changed. If you did not make this change, contact your gym.', button:'' },
    identity_linked_notification: { key:'identity_linked_notification', subject:`A sign-in method was added to ${gymName}`, preheader:'Security notice.', heading:'A sign-in method was added', body:'A new sign-in method was linked to your account. If you did not make this change, contact your gym.', button:'' },
    identity_unlinked_notification: { key:'identity_unlinked_notification', subject:`A sign-in method was removed from ${gymName}`, preheader:'Security notice.', heading:'A sign-in method was removed', body:'A sign-in method was removed from your account. If you did not make this change, contact your gym.', button:'' },
    mfa_factor_enrolled_notification: { key:'mfa_factor_enrolled_notification', subject:`A verification method was added to ${gymName}`, preheader:'Security notice.', heading:'A verification method was added', body:'A new verification method was added to your account. If you did not make this change, contact your gym.', button:'' },
    mfa_factor_unenrolled_notification: { key:'mfa_factor_unenrolled_notification', subject:`A verification method was removed from ${gymName}`, preheader:'Security notice.', heading:'A verification method was removed', body:'A verification method was removed from your account. If you did not make this change, contact your gym.', button:'' },
  }
  return map[action] || { key:'auth_notice', subject:`${gymName} account notice`, preheader:`A secure message from ${gymName}.`, heading:`${gymName} account notice`, body:'A secure account action was requested.', button:'' }
}

async function loadTemplate(context: GymContext | null, action: string) {
  const gymName = context?.name || 'HybridOne'
  const defaults = actionDefaults(action, gymName, context?.accessInvite === true)
  const vars = {
    gym_name: gymName,
    invited_by: context?.invitedBy || 'A gym Owner',
    role: context?.inviteRole || 'staff',
  }
  const resolvedDefaults = {
    ...defaults,
    subject: fill(defaults.subject, defaults.subject, vars),
    preheader: fill(defaults.preheader, defaults.preheader, vars),
    heading: fill(defaults.heading, defaults.heading, vars),
    body: fill(defaults.body, defaults.body, vars),
    button: fill(defaults.button, defaults.button, vars),
  }
  if (!context) return resolvedDefaults
  const { data: rows, error } = await admin.rpc('get_auth_email_template', {
    p_gym_id: context.id,
    p_template_key: defaults.key,
  })
  if (error) throw error
  const data = rows?.[0]
  if (!data || data.enabled === false) return resolvedDefaults
  return {
    ...resolvedDefaults,
    subject: fill(data.subject, resolvedDefaults.subject, vars),
    preheader: fill(data.preheader, resolvedDefaults.preheader, vars),
    heading: fill(data.heading, resolvedDefaults.heading, vars),
    body: fill(data.body_text, resolvedDefaults.body, vars),
    button: fill(data.button_label, resolvedDefaults.button, vars),
  }
}

function verificationUrl(emailData: EmailData, tokenHash?: string) {
  if (!tokenHash || !emailData.email_action_type) return null
  const u = new URL('/auth/v1/verify', SUPABASE_URL)
  u.searchParams.set('token', tokenHash)
  u.searchParams.set('type', emailData.email_action_type)
  if (emailData.redirect_to) u.searchParams.set('redirect_to', emailData.redirect_to)
  return u.toString()
}

function renderEmail(context: GymContext | null, template: Awaited<ReturnType<typeof loadTemplate>>, emailData: EmailData, link: string | null) {
  const gymName = context?.name || 'HybridOne'
  const accent = context?.accent || '#0b1020'
  const logo = context?.logoUrl ? `<img src="${escapeHtml(context.logoUrl)}" alt="${escapeHtml(gymName)}" style="display:block;max-width:220px;max-height:64px;margin:0 0 24px">` : ''
  const powered = context ? `<div style="margin-top:26px;font-size:11px;color:#98a2b3">Powered by <a href="https://www.hybridone.co.uk" style="color:#667085;text-decoration:none;font-weight:700">HybridOne</a></div>` : ''
  const otp = emailData.email_action_type === 'reauthentication' && emailData.token ? `<div style="font-size:30px;font-weight:900;letter-spacing:8px;margin:24px 0">${escapeHtml(emailData.token)}</div>` : ''
  const button = link && template.button ? `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:800">${escapeHtml(template.button)}</a></p>` : ''
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#101828"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(template.preheader)}</div><div style="padding:28px 14px"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e7ebf2;border-radius:18px;padding:32px">${logo}<div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:8px">${escapeHtml(gymName)}</div><h1 style="font-size:28px;line-height:1.2;margin:0 0 18px">${escapeHtml(template.heading)}</h1>${asParagraphs(template.body)}${otp}${button}<div style="border-top:1px solid #e7ebf2;margin-top:28px;padding-top:18px;font-size:12px;line-height:1.5;color:#667085">${escapeHtml(context?.footer || 'Secure account email from HybridOne')}${powered}</div></div></div></body></html>`
}

async function sendViaResend(args: { to: string; from: string; replyTo?: string | null; subject: string; html: string; idempotency: string }) {
  const body: Record<string, unknown> = { from: args.from, to: [args.to], subject: safeSubject(args.subject), html: args.html }
  if (args.replyTo) body.reply_to = [args.replyTo]
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}`, 'Idempotency-Key': args.idempotency },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

function hookSecrets() {
  return HOOK_SECRET_RAW.split('|').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^v1,whsec_/, ''))
}

function verifyPayload(payload: string, headers: Record<string, string>) {
  let lastError: unknown = null
  for (const secret of hookSecrets()) {
    try { return new Webhook(secret).verify(payload, headers) as { user: HookUser; email_data: EmailData } }
    catch (error) { lastError = error }
  }
  throw lastError || new Error('No Send Email Hook secret configured')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('not allowed', { status: 405 })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY || !HOOK_SECRET_RAW) return new Response(JSON.stringify({ error: { message: 'Email hook is not configured' } }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const { user, email_data: emailData } = verifyPayload(payload, headers)
    const action = String(emailData.email_action_type || '')
    const context = await resolveGymContext(user, emailData)
    const template = await loadTemplate(context, action)
    const fromName = context?.senderName || 'HybridOne'
    const fromEmail = context?.senderEmail || DEFAULT_FROM
    const from = `${fromName.replace(/[<>\r\n]/g, '').trim()} <${fromEmail}>`
    const idBase = `${user.id}:${action}:${emailData.token_hash || emailData.token_hash_new || emailData.token || 'notice'}`

    if (action === 'email_change' && user.new_email && emailData.token_hash && emailData.token_hash_new) {
      const currentLink = verificationUrl(emailData, emailData.token_hash_new)
      const newLink = verificationUrl(emailData, emailData.token_hash)
      await Promise.all([
        sendViaResend({ to: String(user.email || ''), from, replyTo: context?.replyTo, subject: template.subject, html: renderEmail(context, template, emailData, currentLink), idempotency: `hybridone:${idBase}:current` }),
        sendViaResend({ to: String(user.new_email), from, replyTo: context?.replyTo, subject: template.subject, html: renderEmail(context, template, { ...emailData, token: emailData.token_new }, newLink), idempotency: `hybridone:${idBase}:new` }),
      ])
    } else {
      const target = action === 'email_change' && user.new_email ? String(user.new_email) : String(user.email || '')
      if (!target) throw new Error('No recipient email')
      const tokenHash = emailData.token_hash || emailData.token_hash_new
      const link = ['signup','invite','magiclink','recovery','email_change'].includes(action) ? verificationUrl(emailData, tokenHash) : null
      await sendViaResend({ to: target, from, replyTo: context?.replyTo, subject: template.subject, html: renderEmail(context, template, emailData, link), idempotency: `hybridone:${idBase}` })
    }

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('send-auth-email failed', error)
    return new Response(JSON.stringify({ error: { message: String((error as Error)?.message || error) } }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
})
