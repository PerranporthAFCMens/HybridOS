// finalise-signature: after a member signs the gym's terms and waiver (public.sign_gym_documents), this makes the signed copies,
// keeps them in storage ('signed-documents'), and emails them to the member through Resend.
//
// The member's own sign-in (JWT) calls it with { signature_id }. It only acts on that member's own signature. A failed email never
// undoes the signature: the reason is written to member_signatures.email_error and the copies stay saved.
//
// One file on purpose, so it can be pasted into the Supabase dashboard's function editor as well as deployed with the CLI.
// The PDF builder at the top has no Deno-only code and is unit tested (web/tests/signedpdf.test.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// ---------------------------------------------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------------------------------------------
export interface SignedDoc {
  kind: 'terms' | 'waiver'
  title: string
  version: number
  source: 'pdf' | 'text'
  body: string | null
  pdfBytes: Uint8Array | null
  acceptance: string
  qa: { prompt: string; answer: string }[]
}

export interface SignedMeta {
  signatureId: string
  gymName: string
  memberName: string
  signerName: string
  signerIsGuardian: boolean
  signedAt: Date
  signaturePng: Uint8Array
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 50

/** Text the standard PDF fonts cannot draw (emoji, most non-Latin scripts) becomes "?" instead of failing the whole document. */
export function safeText(font: PDFFont, text: string): string {
  let out = ''
  for (const ch of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')) {
    if (ch === '\n') { out += ch; continue }
    try {
      font.encodeText(ch)
      out += ch
    } catch {
      out += '?'
    }
  }
  return out
}

/** Breaks text into lines that fit the width, keeping paragraph breaks and splitting any word that is too long on its own. */
export function wrapLines(font: PDFFont, text: string, size: number, width: number): string[] {
  const lines: string[] = []
  for (const para of safeText(font, text).split('\n')) {
    if (para.trim() === '') { lines.push(''); continue }
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word
      while (font.widthOfTextAtSize(w, size) > width) {
        let cut = w.length - 1
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--
        if (line) { lines.push(line); line = '' }
        lines.push(w.slice(0, cut))
        w = w.slice(cut)
      }
      const next = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(next, size) <= width) line = next
      else { lines.push(line); line = w }
    }
    lines.push(line)
  }
  return lines
}

class Writer {
  page: PDFPage
  y: number
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage(A4)
    this.y = A4[1] - MARGIN
  }
  private room(h: number) {
    if (this.y - h < MARGIN) {
      this.page = this.doc.addPage(A4)
      this.y = A4[1] - MARGIN
    }
  }
  gap(h: number) { this.y -= h }
  text(t: string, o: { size?: number; bold?: boolean; colour?: [number, number, number]; indent?: number } = {}) {
    const size = o.size ?? 11
    const f = o.bold ? this.bold : this.font
    const lines = wrapLines(f, t, size, A4[0] - 2 * MARGIN - (o.indent ?? 0))
    for (const l of lines) {
      this.room(size * 1.4)
      this.y -= size * 1.4
      if (l) this.page.drawText(l, { x: MARGIN + (o.indent ?? 0), y: this.y, size, font: f, color: rgb(...(o.colour ?? [0.07, 0.09, 0.15])) })
    }
  }
  async image(png: Uint8Array, maxW: number, maxH: number) {
    const img = await this.doc.embedPng(png)
    const s = Math.min(maxW / img.width, maxH / img.height, 1)
    const w = img.width * s
    const h = img.height * s
    this.room(h + 10)
    this.y -= h
    this.page.drawRectangle({ x: MARGIN - 4, y: this.y - 4, width: w + 8, height: h + 8, borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 0.75 })
    this.page.drawImage(img, { x: MARGIN, y: this.y, width: w, height: h })
    this.y -= 12
  }
}

const London = (d: Date) => d.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'short' })

/** The document as the gym wrote it (an uploaded PDF, or typed wording turned into pages) with a signature page added at the end. */
export async function buildSignedPdf(doc: SignedDoc, meta: SignedMeta): Promise<Uint8Array> {
  const out = doc.source === 'pdf' && doc.pdfBytes ? await PDFDocument.load(doc.pdfBytes, { ignoreEncryption: true }) : await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)

  if (!(doc.source === 'pdf' && doc.pdfBytes)) {
    const w = new Writer(out, font, bold)
    w.text(meta.gymName, { size: 10, colour: [0.4, 0.44, 0.5] })
    w.gap(6)
    w.text(doc.title, { size: 18, bold: true })
    w.text(`Version ${doc.version}`, { size: 10, colour: [0.4, 0.44, 0.5] })
    w.gap(10)
    w.text(doc.body ?? '')
  }

  const s = new Writer(out, font, bold)
  s.text('Signature page', { size: 10, colour: [0.4, 0.44, 0.5] })
  s.text(doc.title, { size: 16, bold: true })
  s.text(`${meta.gymName}  |  Version ${doc.version}`, { size: 10, colour: [0.4, 0.44, 0.5] })
  s.gap(14)
  s.text('What was agreed', { bold: true })
  s.text(doc.acceptance)
  if (doc.qa.length) {
    s.gap(12)
    s.text('Questions and answers', { bold: true })
    for (const q of doc.qa) {
      s.gap(3)
      s.text(q.prompt, { size: 10, colour: [0.35, 0.39, 0.45] })
      s.text(q.answer || '(no answer)', { indent: 12 })
    }
  }
  s.gap(14)
  s.text('Signed by', { bold: true })
  s.text(meta.signerName)
  if (meta.signerIsGuardian) s.text(`as parent or guardian of ${meta.memberName}`, { size: 10, colour: [0.35, 0.39, 0.45] })
  else s.text(`Member: ${meta.memberName}`, { size: 10, colour: [0.35, 0.39, 0.45] })
  s.gap(8)
  s.text(London(meta.signedAt), { size: 10 })
  s.gap(10)
  await s.image(meta.signaturePng, 240, 90)
  s.gap(8)
  s.text(`Signed electronically through HybridOne. Reference ${meta.signatureId}.`, { size: 8, colour: [0.5, 0.54, 0.6] })
  return await out.save()
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
const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c))
const fileSafe = (v: string) => v.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'document'

function base64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function pngFromDataUrl(url: string): Uint8Array {
  const raw = atob(url.replace(/^data:image\/png;base64,/, ''))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = 'start'
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!url || !service) return reply(500, { error: 'Not configured' })
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

    stage = 'authenticate'
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return reply(401, { error: 'Unauthorised' })
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u?.user) return reply(401, { error: 'Unauthorised' })
    const user = u.user as { id: string; email?: string }

    stage = 'read_request'
    const body = (await req.json().catch(() => ({}))) as { signature_id?: unknown }
    const sigId = str(body.signature_id)
    if (!sigId) return reply(400, { error: 'signature_id is required' })

    stage = 'load_signature'
    const { data: sig } = (await admin.from('member_signatures').select('*').eq('id', sigId).maybeSingle()) as { data: Row | null }
    if (!sig || sig.user_id !== user.id) return reply(404, { error: 'Not found' })
    if (sig.emailed_at) return reply(200, { ok: true, emailed: true, already: true })

    stage = 'load_context'
    const gymId = str(sig.gym_id)
    const docIds = [sig.terms_document_id, sig.waiver_document_id].filter((x): x is string => typeof x === 'string')
    const [gymQ, commsQ, profQ, docsQ, qsQ, ansQ] = await Promise.all([
      admin.from('gyms').select('id,name').eq('id', gymId).maybeSingle(),
      admin.from('gym_communication_settings').select('sender_name,sender_email,sender_domain_status,reply_to_email').eq('gym_id', gymId).maybeSingle(),
      admin.from('profiles').select('first_name,last_name,display_name').eq('id', user.id).maybeSingle(),
      admin.from('gym_signup_documents').select('*').in('id', docIds),
      admin.from('gym_signup_questions').select('*').in('document_id', docIds).order('position'),
      admin.from('member_signature_answers').select('*').eq('signature_id', sigId),
    ])
    const gym = (gymQ.data ?? {}) as Row
    const comms = (commsQ.data ?? {}) as Row
    const prof = (profQ.data ?? {}) as Row
    const gymName = str(gym.name) || 'your gym'
    const memberName = str(prof.display_name) || [str(prof.first_name), str(prof.last_name)].filter(Boolean).join(' ') || str(sig.signer_name)
    const docs = (docsQ.data ?? []) as Row[]
    const questions = (qsQ.data ?? []) as Row[]
    const answers = (ansQ.data ?? []) as Row[]
    const png = pngFromDataUrl(str(sig.signature_png))

    stage = 'build_pdfs'
    const made: { kind: 'terms' | 'waiver'; title: string; path: string; bytes: Uint8Array }[] = []
    for (const d of docs) {
      const kind = d.kind === 'waiver' ? 'waiver' : 'terms'
      let pdfBytes: Uint8Array | null = null
      if (d.source === 'pdf' && typeof d.file_path === 'string') {
        const dl = await admin.storage.from('gym-signup-documents').download(d.file_path)
        if (dl.error || !dl.data) throw new Error(`Could not read the ${kind} PDF`)
        pdfBytes = new Uint8Array(await dl.data.arrayBuffer())
      }
      const qa = questions.filter((q) => q.document_id === d.id).map((q) => {
        const a = answers.find((x) => x.question_id === q.id)
        const text = a ? str(a.answer_text) : ''
        const answer = q.answer_type === 'yes_no' ? (a ? `${a.answer_yes ? 'Yes' : 'No'}${text ? ` - ${text}` : ''}` : '') : text
        return { prompt: str(q.prompt), answer }
      })
      const bytes = await buildSignedPdf(
        { kind, title: str(d.title), version: Number(d.version) || 1, source: d.source === 'pdf' ? 'pdf' : 'text', body: typeof d.body_text === 'string' ? d.body_text : null, pdfBytes, acceptance: str(d.acceptance_text), qa },
        { signatureId: sigId, gymName, memberName, signerName: str(sig.signer_name), signerIsGuardian: sig.signer_is_guardian === true, signedAt: new Date(str(sig.signed_at) || Date.now()), signaturePng: png },
      )
      const path = `${user.id}/${gymId}/${sigId}-${kind}.pdf`
      const up = await admin.storage.from('signed-documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
      if (up.error) throw new Error(`Could not save the signed ${kind}: ${up.error.message}`)
      made.push({ kind, title: str(d.title), path, bytes })
    }

    stage = 'save_paths'
    const upd = await admin.from('member_signatures').update({
      signed_terms_path: made.find((m) => m.kind === 'terms')?.path ?? null,
      signed_waiver_path: made.find((m) => m.kind === 'waiver')?.path ?? null,
    }).eq('id', sigId)
    if (upd.error) throw new Error(upd.error.message)

    stage = 'send_email'
    const to = user.email ?? ''
    let emailed = false
    let emailError: string | null = null
    if (!to) emailError = 'The account has no email address'
    else if (!resendKey) emailError = 'Email is not configured'
    else {
      const from = comms.sender_domain_status === 'verified' && str(comms.sender_email) ? str(comms.sender_email).toLowerCase() : DEFAULT_FROM
      const fromName = str(comms.sender_name) || gymName
      const list = made.map((m) => `<li>${escapeHtml(m.title)}</li>`).join('')
      const html = `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#101828"><div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border-radius:14px;padding:26px"><h1 style="margin:0 0 12px;font-size:20px">Your signed copy</h1><p style="line-height:1.6;margin:0 0 12px">Thank you for joining ${escapeHtml(gymName)}. Attached ${made.length === 1 ? 'is a copy' : 'are copies'} of what you signed, for your records:</p><ul style="line-height:1.7;margin:0 0 14px">${list}</ul><p style="line-height:1.6;margin:0;color:#667085;font-size:13px">Please keep this email. If anything looks wrong, reply to it or speak to ${escapeHtml(gymName)}.</p></div><div style="margin-top:16px;font-size:11px;color:#98a2b3;text-align:center">Sent by ${escapeHtml(gymName)} via HybridOne</div></div></body></html>`
      const mail: Record<string, unknown> = {
        from: `${fromName.replace(/[<>"\r\n]/g, '')} <${from}>`,
        to: [to],
        subject: `Your signed copy - ${gymName}`.replace(/[\r\n]+/g, ' ').slice(0, 200),
        html,
        attachments: made.map((m) => ({ filename: `${fileSafe(gymName)}-${m.kind}-${fileSafe(memberName)}.pdf`, content: base64(m.bytes) })),
      }
      const rt = str(comms.reply_to_email)
      if (rt) mail.reply_to = [rt]
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}`, 'Idempotency-Key': `signed-docs-${sigId}` },
        body: JSON.stringify(mail),
      })
      if (res.ok) emailed = true
      else emailError = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`
    }

    stage = 'record_email'
    await admin.from('member_signatures').update(emailed ? { emailed_at: new Date().toISOString(), email_error: null } : { email_error: emailError }).eq('id', sigId)
    return reply(200, { ok: true, emailed, ...(emailError ? { email_error: emailError } : {}) })
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : 'Something went wrong', stage })
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(handle)
