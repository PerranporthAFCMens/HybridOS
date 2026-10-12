import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient('https://mzgnhmeydhhpzgxlgudh.supabase.co', 'sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function stamp(iso) {
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London', timeZoneName: 'short' }).formatToParts(new Date(iso));
  const p = (t) => parts.find((x) => x.type === t)?.value ?? '';
  return `${p('weekday')} ${p('day')} ${p('month')} ${p('year')} at ${p('hour')}:${p('minute')}:${p('second')} ${p('timeZoneName')}`;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function bytes(path) {
  const u = await supabase.storage.from('signed-documents').createSignedUrl(path, 120);
  if (u.error) throw new Error(u.error.message);
  const r = await fetch(u.data.signedUrl);
  if (!r.ok) throw new Error('Could not fetch the file');
  return new Uint8Array(await r.arrayBuffer());
}

/** The terms and the waiver as one PDF. A single file is handed over untouched. */
async function signedPdf(paths) {
  const files = await Promise.all(paths.map(bytes));
  if (files.length === 1) return new Blob([files[0]], { type: 'application/pdf' });
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(f);
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}

async function mount() {
  const profile = document.getElementById('profile');
  if (!profile || document.getElementById('signedDocsCard')) return;
  const { data: s } = await supabase.auth.getSession();
  const gymId = new URLSearchParams(location.search).get('gym_id') || sessionStorage.getItem('hybrid-gym-id') || '';
  if (!s.session || !gymId) return;
  const card = document.createElement('div');
  card.id = 'signedDocsCard';
  card.className = 'card';
  card.style.marginTop = '16px';
  card.innerHTML = '<div class="eyebrow">Your agreements</div><h3 style="margin:4px 0">Your signed documents</h3><div class="muted" id="signedDocsBody">Loading…</div>';
  profile.appendChild(card);
  const body = card.querySelector('#signedDocsBody');
  const r = await supabase.from('member_signatures').select('signed_at, signed_terms_path, signed_waiver_path').eq('gym_id', gymId).eq('user_id', s.session.user.id).order('signed_at', { ascending: false }).limit(1);
  if (r.error) { body.textContent = `Could not load your signed documents. ${r.error.message}`; return; }
  const latest = r.data?.[0];
  if (!latest) { body.textContent = 'There are no signed documents on this account for this gym. If you signed up with a different email, sign in with that one, or ask the gym.'; return; }
  const paths = [latest.signed_terms_path, latest.signed_waiver_path].filter(Boolean);
  body.innerHTML = `You signed the terms and waiver on ${esc(stamp(latest.signed_at))}.`;
  if (!paths.length) { body.insertAdjacentHTML('beforeend', '<div style="margin-top:8px">Your signed copy is not ready yet. Ask the gym to send it to you.</div>'); return; }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn secondary';
  btn.style.marginTop = '12px';
  btn.textContent = 'Download my signed copy';
  const msg = document.createElement('div');
  msg.setAttribute('role', 'alert');
  msg.style.marginTop = '8px';
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Getting it…'; msg.textContent = '';
    try {
      const blob = await signedPdf(paths);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(document.getElementById('gymName')?.textContent || 'gym')}-my-signed-copy-${latest.signed_at.slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) {
      console.warn('Signed copy download failed', e);
      msg.textContent = 'Could not get your signed copy. Try again.';
    } finally { btn.disabled = false; btn.textContent = 'Download my signed copy'; }
  });
  body.append(document.createElement('br'), btn, msg);
}

const start = () => { mount().catch((e) => console.warn('Signed documents card failed', e)); };
// The page builds its profile after sign-in, so wait until the app is showing.
const app = document.getElementById('app');
if (app && app.classList.contains('hidden')) {
  new MutationObserver((_, o) => { if (!app.classList.contains('hidden')) { o.disconnect(); start(); } }).observe(app, { attributes: true, attributeFilter: ['class'] });
} else start();
