// Browser gate: the sign-up link a gym sends to new members. Mocked network only; no real account.
// Checks the whole journey for an adult and for an under-18, what is sent to the database, the refusals, and the layout.
import { base, launch, mockSupabase, reply, runChecks, session, sizes } from './mock.mjs';

const GYM = '33333333-3333-4333-8333-333333333333';
const PLANS = [
  { id: 'plan-1', name: 'Hybrid', description: null, price_pence: 5900, billing_interval: 'monthly', includes_open_gym: true, includes_classes: true, classes_per_week: 3, includes_pt: false },
  { id: 'plan-2', name: 'Day pass', description: 'One visit', price_pence: 800, billing_interval: 'one_off' },
];

const DOCS = [
  { id: 'd-terms', kind: 'terms', version: 2, title: 'Terms and conditions', source: 'pdf', file_path: `${GYM}/terms-1.pdf`, file_name: 'terms.pdf', body_text: null, acceptance_text: 'I agree to the terms.', questions: [] },
  { id: 'd-waiver', kind: 'waiver', version: 1, title: 'Waiver', source: 'text', file_path: null, file_name: null, body_text: 'I accept the risks of training.', acceptance_text: 'I have read the waiver and accept the risk.',
    questions: [
      { id: 'q-heart', prompt: 'Do you have a heart condition?', answer_type: 'yes_no', details_if_yes: true, is_required: true },
      { id: 'q-injury', prompt: 'Any injuries we should know about?', answer_type: 'text', details_if_yes: false, is_required: false },
    ] },
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${e.tagName.toLowerCase()} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && r.height < 40) problems.push(`${e.tagName.toLowerCase()} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const state = { saved: null, signed: null, joined: null, docs: true };
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/get_public_gym_join_options')) {
      if (body?.p_gym_slug === 'nope') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Gym not found' }) }).then(() => true);
      return reply(route, { gym_id: GYM, gym_name: 'Puffin Performance', logo_url: null, plans: PLANS });
    }
    if (path.endsWith('/rpc/get_public_gym_signup_documents')) return reply(route, state.docs ? DOCS : []);
    if (path.endsWith('/rpc/save_my_join_details')) { state.saved = body; return reply(route, { ok: true, under_18: !!body.p_guardian_name }); }
    if (path.endsWith('/rpc/sign_gym_documents')) { state.signed = body; return reply(route, { ok: true, signature_id: 'sig-1' }); }
    if (path.endsWith('/rpc/join_public_gym_with_membership')) { state.joined = body; return reply(route, { ok: true, gym_id: GYM, plan_name: 'Hybrid' }); }
    return false;
  });
  // The shared mock answers every sign-in call with a bare user; sign-up must hand back a session. Later routes win.
  await page.route(/\/auth\/v1\/signup/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }));
  const c = runChecks();
  const fill = (label, value) => page.getByLabel(label, { exact: true }).fill(value);
  const next = (label) => page.getByRole('button', { name: label, exact: true }).click();
  const alert = page.getByRole('alert');

  // The gym's link is hybridone.co.uk/join/<gym>: the server hands out the app page there (a rewrite in vercel.json), and the page carries on to the real address.
  const appHtml = await (await page.request.get(`${base}/next/index.html`)).text();
  await page.route(/\/join\/puffin$/, (route) => route.fulfill({ contentType: 'text/html', body: appHtml }));
  await page.goto(`${base}/join/puffin`);
  await c.has('the clean sign-up link opens the journey', page.getByRole('heading', { name: 'Join Puffin Performance' }));
  c.ok('and ends at the real address of the sign-up screen', page.url().includes('/next/#/join/puffin'));
  await page.unroute(/\/join\/puffin$/);

  await page.goto(`${base}/next/#/join/nope`);
  await c.has('a bad link says so', page.getByText('This sign-up link is not valid'));

  await page.goto(`${base}/next/#/join/puffin`);
  await c.has('the link shows the gym', page.getByRole('heading', { name: 'Join Puffin Performance' }));
  await c.has('it starts at the account step', page.getByRole('heading', { name: 'Create your account' }));
  await next('Create account');
  await c.has('an empty account is refused', alert.filter({ hasText: 'valid email' }));
  await fill('Email', 'sam@example.test');
  await fill('Password', 'longenough1');
  await fill('Confirm password', 'different11');
  await next('Create account');
  await c.has('mismatched passwords are refused', alert.filter({ hasText: 'do not match' }));
  await fill('Confirm password', 'longenough1');
  await next('Create account');

  await c.has('about you step', page.getByRole('heading', { name: 'About you' }));
  await next('Continue');
  await c.has('an empty name is refused', alert.filter({ hasText: 'first name' }));
  await fill('First name', 'Sam');
  await fill('Last name', 'Penrose');
  await fill('Date of birth', '1990-04-12');
  await fill('Mobile number', '07700 900123');
  c.ok('layout (about you)', (await page.evaluate(layoutProblems)).length === 0);
  await next('Continue');

  await c.has('address step', page.getByRole('heading', { name: 'Your address' }));
  await fill('Address line 1', '1 Cliff Road');
  await fill('Town or city', 'Perranporth');
  await fill('Postcode', 'nonsense');
  await next('Continue');
  await c.has('a bad postcode is refused', alert.filter({ hasText: 'valid UK postcode' }));
  await fill('Postcode', 'pl28 8ab');
  await next('Continue');

  await c.has('emergency contact step', page.getByRole('heading', { name: 'Emergency contact' }));
  await fill('Their name', 'Alex Penrose');
  await fill('Their phone number', '07700 900124');
  await next('Save and continue');
  await c.has('relationship is required', alert.filter({ hasText: 'related to you' }));
  await fill('How they are related to you', 'Partner');
  await next('Save and continue');

  await c.has('the read and sign step (the gym has documents)', page.getByRole('heading', { name: 'Read and sign' }));
  c.ok('details were saved once, tidied, with no guardian for an adult',
    JSON.stringify(state.saved) === JSON.stringify({
      p_first_name: 'Sam', p_last_name: 'Penrose', p_date_of_birth: '1990-04-12', p_phone: '+447700900123',
      p_address_line1: '1 Cliff Road', p_address_line2: '', p_town: 'Perranporth', p_postcode: 'PL28 8AB',
      p_emergency_name: 'Alex Penrose', p_emergency_phone: '+447700900124', p_emergency_relationship: 'Partner',
      p_guardian_name: '', p_guardian_phone: '',
    }));
  c.ok('no guardian step for an adult', (await page.getByRole('heading', { name: 'Parent or guardian' }).count()) === 0);
  await c.has('a PDF document links to the PDF', page.getByRole('link', { name: /Open the PDF to read it \(terms\.pdf\)/ }));
  await c.has('typed wording is shown on screen', page.getByText('I accept the risks of training.'));
  await c.has('each document has its own tick-box sentence', page.getByText('I have read the waiver and accept the risk.'));
  c.ok('layout (sign)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('a required question must be answered', alert.filter({ hasText: 'Answer this question: Do you have a heart condition?' }));
  await page.getByLabel('Do you have a heart condition?', { exact: true }).selectOption('yes');
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('a yes needs details', alert.filter({ hasText: 'Give a few details for' }));
  await page.getByLabel('Details: Do you have a heart condition?').fill('Mild, controlled');
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('every document must be ticked', alert.filter({ hasText: 'Tick the box under each document' }));
  await page.getByLabel('I agree to the terms.').check();
  await page.getByLabel('I have read the waiver and accept the risk.').check();
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('a name is required', alert.filter({ hasText: 'Type your full name' }));
  await fill('Your full name', 'Sam Penrose');
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('a signature is required', alert.filter({ hasText: 'Draw your signature' }));
  c.ok('nothing signed yet', state.signed === null);
  const pad = page.getByRole('img', { name: 'Your signature' });
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 90);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 14, box.y + 90 + Math.sin(i) * 30);
  await page.mouse.up();
  c.ok('clear is available once something is drawn', await page.getByRole('button', { name: 'Clear' }).isEnabled());
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('clearing removes the signature', alert.filter({ hasText: 'Draw your signature' }));
  await page.mouse.move(box.x + 20, box.y + 90);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 14, box.y + 90 + Math.sin(i) * 30);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Sign and continue' }).click();
  await c.has('signing moves on to the plan', page.getByRole('heading', { name: 'Choose your membership' }));
  const g = state.signed;
  c.ok('the signature, name and answers were sent', g?.p_gym_slug === 'puffin' && g?.p_signer_name === 'Sam Penrose' && g?.p_signature_png.startsWith('data:image/png;base64,') && g?.p_signature_png.length > 1500
    && JSON.stringify(g?.p_answers) === JSON.stringify([{ question_id: 'q-heart', yes: true, text: 'Mild, controlled' }]));

  await c.has('plan step', page.getByRole('heading', { name: 'Choose your membership' }));
  await c.has('plans show price and what is in them', page.getByText('£59.00 / monthly'));
  await c.has('a one-off plan has no interval', page.getByText('£8.00', { exact: true }));
  c.ok('layout (plans)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Choose Hybrid' }).click();
  await c.has('done', page.getByRole('heading', { name: 'Hybrid is active' }));
  c.ok('joined the chosen plan at this gym', state.joined?.p_gym_slug === 'puffin' && state.joined?.p_plan_id === 'plan-1');
  c.ok('layout (done)', (await page.evaluate(layoutProblems)).length === 0);

  // An under-18, at a gym with no documents: a guardian step, and no sign step.
  state.docs = false;
  state.saved = null;
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await c.has('signed in already, it skips the account step', page.getByRole('heading', { name: 'About you' }));
  const year = new Date().getFullYear() - 15;
  await fill('First name', 'Jo');
  await fill('Last name', 'Penrose');
  await fill('Date of birth', `${year}-06-01`);
  await fill('Mobile number', '07700 900125');
  await next('Continue');
  await fill('Address line 1', '2 Cliff Road');
  await fill('Town or city', 'Perranporth');
  await fill('Postcode', 'PL28 8AB');
  await next('Continue');
  await fill('Their name', 'Sam Penrose');
  await fill('Their phone number', '07700 900123');
  await fill('How they are related to you', 'Parent');
  await next('Continue');
  await c.has('an under-18 gets the guardian step', page.getByRole('heading', { name: 'Parent or guardian' }));
  await next('Save and continue');
  await c.has('the guardian is required', alert.filter({ hasText: "parent or guardian's name" }));
  await fill('Their name', 'Sam Penrose');
  await fill('Their phone number', '07700 900123');
  await next('Save and continue');
  await c.has('no sign step when the gym has no documents', page.getByRole('heading', { name: 'Choose your membership' }));
  c.ok('guardian details were sent', state.saved?.p_guardian_name === 'Sam Penrose' && state.saved?.p_guardian_phone === '+447700900123');

  // Safari reports a request that was still in flight when the page was reloaded as a script error. That is the check's own reload, not the app.
  const real = errors.filter((e) => !/Fetch API cannot load .* due to access control checks/.test(e));
  c.ok(`no script errors ${real.join(' | ').slice(0, 400)}`, real.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
