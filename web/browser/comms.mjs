// Browser gate: Communications (gym logo, sender details, access-invitation email), signed in as an owner, at phone
// and desktop width. Supabase is mocked at the network layer. Checks the live preview, the logo upload rules and
// exact requests, that another domain is never marked verified, and that refused forms write nothing.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const p = e.parentElement;
    if (p && cs.position !== 'fixed' && cs.position !== 'absolute' && !e.closest('.menu-btn')) {
      const pr = p.getBoundingClientRect();
      if (getComputedStyle(p).display !== 'contents' && (r.right > pr.right + 1 || r.left < pr.left - 1)) problems.push(`${name} sticks out of its parent`);
    }
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}



const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const uploads = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.includes('/storage/v1/object/gym-logos/')) { uploads.push({ path, method, type: route.request().headers()['content-type'] }); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'gym-logos/x' }) }); return true; }
    const table = ['gyms', 'gym_communication_settings', 'gym_email_templates'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) { writes.push({ table, method, query: Object.fromEntries(url.searchParams), body }); await route.fulfill({ status: 204, body: '' }); return true; }
    if (path.endsWith('/gyms')) return reply(route, [{ logo_url: null }]);
    if (path.endsWith('/gym_communication_settings')) return reply(route, [{ sender_name: 'Puffin Mail', sender_email: 'hello@puffin.example', reply_to_email: null, accent_color: '#112233', logo_url: null, footer_text: 'Be well', sender_domain_status: 'unverified' }]);
    if (path.endsWith('/gym_email_templates')) return reply(route, [{ subject: 'Join {{gym_name}}', preheader: null, heading: 'Welcome to {{gym_name}}', body_text: '{{invited_by}} invited you as {{role}}.', button_label: 'Join now' }]);
    return false;
  });
  await page.goto(`${base}/communications`);
  const c = runChecks();
  const preview = page.getByLabel('Preview of the invitation email');
  await c.has('heading', page.getByRole('heading', { name: 'Communications', level: 1 }));
  c.ok('saved sender details shown', (await page.getByLabel('Email brand name').inputValue()) === 'Puffin Mail' && (await page.getByLabel('From email').inputValue()) === 'hello@puffin.example' && (await page.getByLabel('Optional member footer text').inputValue()) === 'Be well');
  await c.has('unverified domain warned', page.getByText(/Needs verification: hello@puffin.example/));
  await c.has('preview fills placeholders', preview.getByText('Welcome to Puffin Performance'));
  await c.has('preview body', preview.getByText('Gym owner invited you as Admin.'));
  await c.has('preview button', preview.getByText('Join now'));
  c.ok('layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/communications-${name}.png`, fullPage: true });

  // Logo
  await page.getByLabel('Choose a logo image').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await c.has('wrong type refused', page.getByText('Use a PNG, JPG or WebP image.'));
  await page.getByLabel('Choose a logo image').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 10) });
  await c.has('too big refused', page.getByText('That image is over 2 MB. Please use a smaller file.'));
  c.ok('nothing uploaded or written for refused files', uploads.length === 0 && writes.length === 0);
  await page.getByLabel('Choose a logo image').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
  await c.has('logo saved message', page.getByText('Logo saved. It now shows across your gym.'));
  c.ok('stored in the gym folder', uploads.length === 1 && uploads[0].method === 'POST' && uploads[0].path.includes(`/gym-logos/${GYM}/logo-`) && uploads[0].path.endsWith('.png'));
  const gl = writes.find((w) => w.table === 'gyms');
  c.ok('gym logo set to the public address, scoped to this gym', gl && gl.method === 'PATCH' && gl.query.id === `eq.${GYM}` && gl.body.logo_url.includes(`/object/public/gym-logos/${GYM}/logo-`));
  c.ok('email settings logo updated too', writes.some((w) => w.table === 'gym_communication_settings' && w.method === 'PATCH' && w.query.gym_id === `eq.${GYM}` && w.body.logo_url === gl.body.logo_url));

  // Sender details
  writes.length = 0;
  await page.getByLabel('From email').fill('nope');
  await page.getByRole('button', { name: 'Save sender details' }).click();
  await c.has('bad from refused', page.getByText('Enter a valid From email address.'));
  await page.getByLabel('From email').fill('hello@puffin.example');
  await page.getByLabel('Logo link (optional)').fill('http://insecure.example/a.png');
  await page.getByRole('button', { name: 'Save sender details' }).click();
  await c.has('insecure logo link refused', page.getByText('The logo link must start with https://.'));
  c.ok('nothing written when refused', writes.length === 0);
  await page.getByLabel('Logo link (optional)').fill('');
  await page.getByLabel('Brand colour').fill('#ff0000');
  await c.has('preview colour follows', page.locator('.cx-head[style*="rgb(255, 0, 0)"]'));
  await page.getByRole('button', { name: 'Save sender details' }).click();
  await c.has('unverified message', page.getByText('Sender details saved. This sending domain still needs verification.'));
  const sw = writes.find((w) => w.table === 'gym_communication_settings' && w.method === 'POST');
  c.ok('sender upsert exact, another domain stays unverified', sw && sw.query.on_conflict === 'gym_id' && sw.body.gym_id === GYM && sw.body.sender_domain_status === 'unverified' && sw.body.sender_email === 'hello@puffin.example' && sw.body.accent_color === '#ff0000' && sw.body.reply_to_email === null && sw.body.logo_url === null);
  writes.length = 0;
  await page.getByLabel('From email').fill('noreply@hybridone.co.uk');
  await page.getByRole('button', { name: 'Save sender details' }).click();
  await c.has('verified message', page.getByText('Sender details saved and ready to use.'));
  c.ok('the HybridOne address is verified', writes.some((w) => w.body?.sender_domain_status === 'verified'));

  // Template
  writes.length = 0;
  await page.getByLabel('Heading').fill('Hello from {{gym_name}}');
  await c.has('preview follows the heading', preview.getByText('Hello from Puffin Performance'));
  await page.getByLabel('Subject').fill(' ');
  await page.getByRole('button', { name: 'Save template' }).click();
  await c.has('blank subject refused', page.getByText('Subject, heading and body are required.'));
  c.ok('nothing written for a refused template', writes.length === 0);
  await page.getByLabel('Subject').fill('You are invited');
  await page.getByRole('button', { name: 'Save template' }).click();
  await c.has('template saved', page.getByText('Access invitation template saved.'));
  const tw = writes.find((w) => w.table === 'gym_email_templates' && w.method === 'POST');
  c.ok('template upsert exact', tw && tw.query.on_conflict === 'gym_id,template_key' && tw.body.gym_id === GYM && tw.body.template_key === 'access_invite' && tw.body.category === 'transactional' && tw.body.subject === 'You are invited' && tw.body.heading === 'Hello from {{gym_name}}' && tw.body.preheader === null && tw.body.enabled === true);
  await page.getByRole('button', { name: 'Restore HybridOne default' }).click();
  c.ok('restore asks first and changes nothing yet', (await page.getByLabel('Subject').inputValue()) === 'You are invited');
  await page.getByRole('button', { name: 'Yes, restore' }).click();
  c.ok('restore fills the default wording (not saved)', (await page.getByLabel('Button text').inputValue()) === 'Accept invitation' && (await page.getByLabel('Subject').inputValue()).includes('invited to {{gym_name}}'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
