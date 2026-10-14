// Browser gate: Quick join, the pay-first sign-up. A gym that chose it sends people through plan, email code (no password), the basics,
// and agree-and-pay; the emergency contact, waiver and address are a checklist afterwards, and the door code is held until it is done.
// Mocked network and a faked Stripe card form only: no real account, no real card, nothing leaves the machine.
import { base, launch, mockSupabase, reply, runChecks, serveApp, session, signedInPage, sizes } from './mock.mjs';

const GYM = '33333333-3333-4333-8333-333333333333';
const PLANS = [
  { id: 'plan-1', name: 'Hybrid', description: null, price_pence: 5900, billing_interval: 'monthly', includes_open_gym: true, includes_classes: true, classes_per_week: 3, includes_pt: false, min_term_months: 6, notice_days: 14 },
  { id: 'plan-free', name: 'Starter', description: 'Try us out', price_pence: 0, billing_interval: 'monthly' },
  { id: 'plan-pass', name: 'Day pass', description: 'One visit', price_pence: 800, billing_interval: 'one_off' },
];
const WORDING = 'I want the Hybrid membership at Puffin Performance to start today. I agree that Puffin Performance can charge this card £59.00 today.';
const DOCS = [
  { id: 'd-waiver', kind: 'waiver', version: 1, title: 'Waiver', source: 'text', file_path: null, file_name: null, body_text: 'I accept the risks of training.', acceptance_text: 'I have read the waiver and accept the risk.',
    questions: [{ id: 'q-heart', prompt: 'Do you have a heart condition?', answer_type: 'yes_no', details_if_yes: true, is_required: true }] },
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

const FAKE_STRIPE = () => {
  window.__stripe = { confirms: 0 };
  window.Stripe = () => ({
    elements: () => ({ create: () => ({ mount(el) { el.innerHTML = '<div style="height:100px">fake card form</div>'; }, on(event, cb) { if (event === 'ready') setTimeout(cb, 30); }, destroy() {} }) }),
    confirmPayment: async () => { window.__stripe.confirms += 1; return { paymentIntent: { status: 'succeeded' } }; },
  });
};

const newState = () => ({
  style: 'quick', mode: 'stripe', memberships: [], docs: true, otp: [], verified: [], accept: false, basics: null, prepared: null, finished: [],
  joined: null, signFirst: false, modeAskedSignedOut: 0, otpUrl: '', emergency: null, address: null, signed: null, finalised: null, done: new Set(), dob: '1990-04-12', doorOn: true,
});

/** Mock everything Quick join talks to. The checklist answers from `state.done`, so saving something ticks it off. */
async function wire(page, state) {
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/get_public_gym_join_options')) return reply(route, { gym_id: GYM, gym_name: 'Puffin Performance', logo_url: null, plans: PLANS });
    if (path.endsWith('/rpc/get_public_gym_join_style')) return reply(route, { join_style: state.style, ask_address: 'optional', ask_emergency: 'required', ask_documents: 'required', sign_before_paying: state.signFirst });
    if (path.endsWith('/rpc/get_public_gym_signup_documents')) return reply(route, state.docs ? DOCS : []);
    if (path.endsWith('/rpc/get_gym_payment_mode')) {
      // As in the real database: only a signed-in person may ask (a signed-out visitor is sent the anonymous key, not a user's token).
      if (!(route.request().headers().authorization ?? '').includes('x.y.z')) { state.modeAskedSignedOut += 1; return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'Sign in first' }) }); }
      return reply(route, state.mode);
    }
    if (path.endsWith('/rpc/save_my_basics')) { state.basics = body; return reply(route, { ok: true }); }
    if (path.endsWith('/memberships')) return reply(route, state.memberships);
    if (path.endsWith('/rpc/join_public_gym_with_membership')) { state.joined = body; return reply(route, { ok: true, gym_id: GYM, plan_name: 'Starter' }); }
    if (path.endsWith('/functions/v1/stripe-join')) {
      if (body.action === 'prepare') {
        // As in the real database: a gym that wants the waiver signed before paying refuses to set up payment until it is.
        if (state.signFirst && !state.done.has('documents')) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Complete your details before joining: signature on the terms and waiver' }) });
        state.prepared = body;
        return reply(route, { ok: true, publishable_key: 'pk_test_abc', stripe_account: 'acct_123', client_secret: 'pi_1_secret_x', subscription_id: 'sub_1', amount_due_pence: 5900, amount_pence: 5900, interval: 'monthly', next_payment_date: '2026-11-14', wording: WORDING, under18: !!body.guardian });
      }
      state.finished.push(body);
      return reply(route, { ok: true, status: 'active' });
    }
    if (path.endsWith('/rpc/get_my_ready_status')) {
      const items = [
        { key: 'emergency', label: 'Emergency contact', required: true, done: state.done.has('emergency') },
        { key: 'documents', label: 'Health questions and waiver', required: true, done: state.done.has('documents') },
        { key: 'address', label: 'Your address', required: false, done: state.done.has('address') },
      ];
      const ready = items.every((i) => i.done || !i.required);
      return reply(route, { style: 'quick', ready, held: !ready, items });
    }
    if (path.endsWith('/rpc/get_my_private_profile')) return reply(route, { date_of_birth: state.dob, gender: null });
    if (path.endsWith('/rpc/save_my_emergency')) { state.emergency = body; state.done.add('emergency'); return reply(route, { ok: true }); }
    if (path.endsWith('/rpc/save_my_address')) { state.address = body; state.done.add('address'); return reply(route, { ok: true }); }
    if (path.endsWith('/rpc/sign_gym_documents')) { state.signed = body; state.done.add('documents'); return reply(route, { ok: true, signature_id: 'sig-1' }); }
    if (path.endsWith('/functions/v1/finalise-signature')) { state.finalised = body; return reply(route, { ok: true, emailed: true }); }
    if (path.endsWith('/gym_access_settings')) return reply(route, state.done.has('emergency') && state.done.has('documents') && state.doorOn ? [{ access_enabled: true, access_code: '4821', member_label: 'Front door', member_note: 'Hold the button for 2 seconds.' }] : []);
    return false;
  });
  await page.route(/\/auth\/v1\/otp/, (route) => { state.otp.push(JSON.parse(route.request().postData() || '{}')); state.otpUrl = route.request().url(); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await page.route(/\/auth\/v1\/verify/, (route) => {
    state.verified.push(JSON.parse(route.request().postData() || '{}'));
    if (!state.accept) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
}

async function draw(page) {
  const box = await page.getByRole('img', { name: 'Your signature' }).boundingBox();
  await page.mouse.move(box.x + 20, box.y + 90);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + i * 14, box.y + 90 + Math.sin(i) * 30);
  await page.mouse.up();
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const c = runChecks();
  const errors = [];
  const ctx = await browser.newContext({ viewport });
  await serveApp(ctx);
  await ctx.addInitScript(FAKE_STRIPE);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => { if (!/Fetch API cannot load .* due to access control checks/.test(String(e))) errors.push(String(e)); });
  const state = newState();
  await wire(page, state);
  const alert = page.getByRole('alert');
  const fill = (label, value) => page.getByLabel(label, { exact: true }).fill(value);
  const press = (label) => page.getByRole('button', { name: label, exact: true }).click();

  // ---- 1. Plan first, with what each one includes ----
  await page.goto(`${base}/join/puffin`);
  await c.has('the plan comes first', page.getByRole('heading', { name: 'Choose your membership' }));
  await c.has('with an honest step count from the first screen', page.getByText('Step 1 of 4', { exact: true }));
  await c.has('a plan lists what it includes', page.getByText('3 classes / week'));
  await c.has('a free plan says Free', page.getByText('Free', { exact: true }).first());
  await c.has('and its terms are shown before choosing', page.getByText('6 months minimum · 2 weeks notice to leave'));
  c.ok('no password anywhere', (await page.getByLabel('Password').count()) === 0);
  c.ok('layout (plans)', (await page.evaluate(layoutProblems)).length === 0);
  await press('Choose Hybrid');

  // ---- 2. Email and code, no password ----
  await c.has('then the email, with no password', page.getByRole('heading', { name: 'What is your email?' }));
  await c.has('step 2 of 4', page.getByText('Step 2 of 4', { exact: true }));
  await c.has('the chosen plan is shown, with a way to change it', page.getByText('Hybrid · £59.00 / monthly'));
  await press('Send me a code');
  await c.has('a missing email is explained next to the box', page.getByText('Enter a valid email address.'));
  c.ok('and no code was sent', state.otp.length === 0);
  await fill('Email', 'sam@example.test');
  await press('Send me a code');
  await c.has('a code is sent to the address', page.getByText('sam@example.test', { exact: true }));
  c.ok('the payment question is not asked while signed out (the database refuses it)', state.modeAskedSignedOut === 0);
  c.ok('asking for it creates the account if it is new, and says which gym', state.otp[0]?.email === 'sam@example.test' && state.otp[0]?.create_user === true && state.otp[0]?.data?.gym_slug === 'puffin');
  c.ok('and the link back names the gym and its id, so the email can carry the gym name', decodeURIComponent(state.otpUrl).includes(`gym=puffin&gym_id=${GYM}`));
  c.ok('layout (code)', (await page.evaluate(layoutProblems)).length === 0);
  await fill('Code from the email', '1111 1111');
  await c.has('a wrong code says so in plain words, as soon as the last digit is in', alert.filter({ hasText: 'wrong or has run out' }));
  c.ok('the digits were sent tidied', state.verified[0]?.token === '11111111' && state.verified[0]?.type === 'email' && state.verified[0]?.email === 'sam@example.test');
  state.accept = true;
  await fill('Code from the email', '22222222');
  await c.has('the right code signs them in and carries on', page.getByRole('heading', { name: 'Just the basics' }));
  await c.has('step 3 of 4', page.getByText('Step 3 of 4', { exact: true }));

  // ---- 3. Just the basics ----
  await press('Continue to payment');
  await c.has('each missing answer is explained next to its own box', page.getByText('Enter your first name.'));
  await c.has('including the mobile number', page.getByText('Enter a valid mobile number, for example 07700 900123.'));
  c.ok('and nothing was saved', state.basics === null);
  await c.has('what comes after paying is listed first', page.getByText('Add an emergency contact'));
  await c.has('including the waiver, because this gym has one', page.getByText('Answer a few health questions and sign the waiver'));
  c.ok('no address, emergency contact or signature is asked for yet', (await page.getByLabel('Address line 1').count()) === 0 && (await page.getByLabel('Their name').count()) === 0);
  await fill('First name', 'Sam');
  await fill('Last name', 'Penrose');
  await fill('Date of birth', `${new Date().getFullYear() - 15}-06-01`);
  await c.has('a young date of birth asks for a parent or guardian right there', page.getByLabel('Parent or guardian name', { exact: true }));
  await press('Continue to payment');
  await c.has('their details are required', page.getByText("Enter your parent or guardian's name."));
  c.ok('layout (basics, under 18)', (await page.evaluate(layoutProblems)).length === 0);
  await fill('Date of birth', '1990-04-12');
  c.ok('and the boxes go away for an adult', (await page.getByLabel('Parent or guardian name', { exact: true }).count()) === 0);
  await fill('Mobile number', '07700 900123');
  c.ok('layout (basics)', (await page.evaluate(layoutProblems)).length === 0);
  await press('Continue to payment');

  // ---- 4. Agree and pay ----
  await c.has('then agree and pay', page.getByRole('heading', { name: 'Agree and pay' }));
  await c.has('step 4 of 4', page.getByText('Step 4 of 4', { exact: true }));
  c.ok('the basics were saved first, in the form the database wants', JSON.stringify(state.basics) === JSON.stringify({ p_first_name: 'Sam', p_last_name: 'Penrose', p_date_of_birth: '1990-04-12', p_phone: '+447700900123', p_guardian_name: '', p_guardian_phone: '' }));
  await c.has('it says what is charged today and after', page.getByText('£59.00 today, then £59.00 every month'));
  await press('Continue to payment');
  await c.has('the card form appears', page.getByText('fake card form'));
  await c.has('the agreement is shown word for word', page.getByText(WORDING));
  c.ok('payment was prepared for this gym and plan', state.prepared?.gym_id === GYM && state.prepared?.plan_id === 'plan-1');
  await page.getByRole('button', { name: 'Pay £59.00 and join' }).click();
  await c.has('paying without agreeing is refused', alert.filter({ hasText: 'Tick the box' }));
  await page.getByLabel(WORDING).check();
  await page.getByRole('button', { name: 'Pay £59.00 and join' }).click();

  // ---- 5. You're in, and what is left ----
  await c.has('a welcome that says they are in', page.getByRole('heading', { name: "You're in, Sam" }));
  await c.has('and that the plan is active', page.getByText('Hybrid is active.'));
  c.ok('the server confirmed the payment', state.finished.length === 1 && state.finished[0].subscription_id === 'sub_1');
  await c.has('the checklist follows', page.getByRole('heading', { name: 'Get ready for your first visit' }));
  await c.has('nothing is done yet', page.getByRole('img', { name: '0 of 3 done' }));
  await c.has('the door code is held back', page.getByText('Appears here when the things above are done.'));
  c.ok('so no code is on the page', (await page.getByText('4821').count()) === 0 && (await page.getByRole('button', { name: 'Tap to reveal' }).count()) === 0);
  c.ok('layout (welcome)', (await page.evaluate(layoutProblems)).length === 0);

  await press('Start with emergency contact');
  await press('Save');
  await c.has('an empty emergency contact is refused', alert.filter({ hasText: 'emergency contact' }));
  await fill('Their name', 'Alex Penrose');
  await fill('Their phone number', '07700 900124');
  await fill('How they are related to you', 'Partner');
  await press('Save');
  await c.has('saving it ticks it off', page.getByRole('img', { name: '1 of 3 done' }));
  c.ok('and sent what the database wants', state.emergency?.p_name === 'Alex Penrose' && state.emergency?.p_phone === '+447700900124' && state.emergency?.p_relationship === 'Partner');
  c.ok('the door code is still held', (await page.getByText('Appears here when the things above are done.').count()) === 1);

  await page.getByRole('button', { name: /Health questions and waiver/ }).click();
  await c.has('the waiver opens in place', page.getByText('I accept the risks of training.'));
  await press('Sign');
  await c.has('signing without answering is refused', alert.filter({ hasText: 'Do you have a heart condition?' }));
  await page.getByLabel('Do you have a heart condition?', { exact: true }).selectOption('no');
  await page.getByLabel('I have read the waiver and accept the risk.').check();
  await fill('Your full name', 'Sam Penrose');
  await draw(page);
  await press('Sign');
  await c.has('signing ticks it off', page.getByRole('img', { name: '2 of 3 done' }));
  c.ok('the signature was saved and the signed copies asked for', state.signed?.p_gym_slug === 'puffin' && state.signed?.p_signer_name === 'Sam Penrose' && state.finalised?.signature_id === 'sig-1');
  await c.has('with the required things done, the door code is released', page.getByRole('button', { name: 'Tap to reveal' }));
  await c.has('the address is optional but can still be added', page.getByText('30 seconds · optional'));
  await page.getByRole('button', { name: /Your address/ }).click();
  await fill('Address line 1', '1 Cliff Road');
  await fill('Town or city', 'Perranporth');
  await fill('Postcode', 'pl288ab');
  await press('Save');
  await c.has('everything done says so', page.getByRole('heading', { name: "You're all set" }));
  c.ok('the address was tidied and sent', state.address?.p_postcode === 'PL28 8AB' && state.address?.p_line1 === '1 Cliff Road');
  c.ok('layout (checklist done)', (await page.evaluate(layoutProblems)).length === 0);
  c.ok('the old join (no payment) was not used', state.joined === null);

  // ---- A free plan, already signed in: no email step, no payment ----
  const free = await signedInPage(browser, viewport);
  const fstate = newState();
  await wire(free.page, fstate);
  await free.page.goto(`${base}/join/puffin`);
  await c.has('a signed-in person skips the email step: step 1 of 3 (plan, basics, pay)', free.page.getByText('Step 1 of 3', { exact: true }));
  await c.has('a one-off pass says it cannot be paid for online', free.page.getByText('This one cannot be paid for online'));
  c.ok('and has no choose button', (await free.page.getByRole('button', { name: 'Choose Day pass' }).count()) === 0);
  await free.page.getByRole('button', { name: 'Choose Starter' }).click();
  await c.has('they go straight to the basics', free.page.getByRole('heading', { name: 'Just the basics' }));
  await c.has('and a free plan has no payment step: step 2 of 2', free.page.getByText('Step 2 of 2', { exact: true }));
  await c.has('and the button says Join, because there is nothing to pay', free.page.getByRole('button', { name: 'Join', exact: true }));
  await free.page.getByLabel('First name', { exact: true }).fill('Jo');
  await free.page.getByLabel('Last name', { exact: true }).fill('Penrose');
  await free.page.getByLabel('Date of birth', { exact: true }).fill('1990-04-12');
  await free.page.getByLabel('Mobile number', { exact: true }).fill('07700 900123');
  await free.page.getByRole('button', { name: 'Join', exact: true }).click();
  await c.has('a free plan is a member straight away', free.page.getByRole('heading', { name: "You're in, Jo" }));
  c.ok('through the usual join, after the basics were saved', fstate.joined?.p_gym_slug === 'puffin' && fstate.joined?.p_plan_id === 'plan-free' && fstate.basics?.p_first_name === 'Jo');
  c.ok('and no card was asked for', fstate.prepared === null);

  // ---- Already a member ----
  fstate.memberships = [{ status: 'active' }];
  await free.page.goto(`${base}/join/puffin`);
  await c.has('an existing member is told so', free.page.getByText('You are already a member. Your membership is active.'));
  c.ok('and never sees the plans', (await free.page.getByText('Choose your membership').count()) === 0);

  // ---- A gym on the full journey is untouched ----
  fstate.memberships = [];
  fstate.style = 'full';
  const full = await browser.newContext({ viewport });
  await serveApp(full);
  const fullPage = await full.newPage();
  fullPage.setDefaultTimeout(10000);
  await wire(fullPage, fstate);
  await fullPage.goto(`${base}/join/puffin`);
  await c.has('a gym that did not choose Quick join still starts with the account', fullPage.getByRole('heading', { name: 'Create your account' }));
  c.ok('and has the password box', (await fullPage.getByLabel('Password', { exact: true }).count()) === 1);
  await full.close();

  // A one-off pass picked before signing in (the page cannot know yet that this gym takes payment) is stopped once it does
  const pass = await browser.newContext({ viewport });
  await serveApp(pass);
  const passPage = await pass.newPage();
  passPage.setDefaultTimeout(10000);
  const pstate = newState();
  pstate.accept = true;
  await wire(passPage, pstate);
  await passPage.goto(`${base}/join/puffin`);
  await passPage.getByRole('button', { name: 'Choose Day pass' }).click();
  await passPage.getByLabel('Email', { exact: true }).fill('pat@example.test');
  await passPage.getByRole('button', { name: 'Send me a code', exact: true }).click();
  await passPage.getByLabel('Code from the email', { exact: true }).fill('33333333');
  await c.has('a person who chose a one-off pass before signing in reaches the basics', passPage.getByRole('heading', { name: 'Just the basics' }));
  await passPage.getByLabel('First name', { exact: true }).fill('Pat');
  await passPage.getByLabel('Last name', { exact: true }).fill('Penrose');
  await passPage.getByLabel('Date of birth', { exact: true }).fill('1990-04-12');
  await passPage.getByLabel('Mobile number', { exact: true }).fill('07700 900123');
  await passPage.getByRole('button', { name: 'Continue to payment' }).click();
  await c.has('and is told it cannot be paid for online, before anything is saved', passPage.getByRole('alert').filter({ hasText: 'cannot be paid for online' }));
  c.ok('nothing was saved or joined', pstate.basics === null && pstate.joined === null);
  await pass.close();

  // ---- A gym that wants the terms and waiver signed before paying ----
  const first = await browser.newContext({ viewport });
  await serveApp(first);
  await first.addInitScript(FAKE_STRIPE);
  const firstPage = await first.newPage();
  firstPage.setDefaultTimeout(10000);
  const sstate = newState();
  sstate.signFirst = true;
  sstate.accept = true;
  await wire(firstPage, sstate);
  await firstPage.goto(`${base}/join/puffin`);
  await c.has('with signing first there are five steps, from the first screen', firstPage.getByText('Step 1 of 5', { exact: true }));
  await firstPage.getByRole('button', { name: 'Choose Hybrid' }).click();
  await firstPage.getByLabel('Email', { exact: true }).fill('lee@example.test');
  await firstPage.getByRole('button', { name: 'Send me a code', exact: true }).click();
  await firstPage.getByLabel('Code from the email', { exact: true }).fill('44444444');
  await c.has('the basics come first', firstPage.getByRole('heading', { name: 'Just the basics' }));
  await c.has('it says what is next: reading and signing', firstPage.getByText('Next you will read and sign the terms and waiver.'));
  c.ok('and the waiver is not left until after paying', (await firstPage.getByText('Answer a few health questions and sign the waiver').count()) === 0);
  await firstPage.getByLabel('First name', { exact: true }).fill('Lee');
  await firstPage.getByLabel('Last name', { exact: true }).fill('Penrose');
  await firstPage.getByLabel('Date of birth', { exact: true }).fill('1990-04-12');
  await firstPage.getByLabel('Mobile number', { exact: true }).fill('07700 900123');
  await firstPage.getByRole('button', { name: 'Continue', exact: true }).click();
  await c.has('then read and sign, before any payment', firstPage.getByRole('heading', { name: 'Read and sign' }));
  await c.has('step 4 of 5', firstPage.getByText('Step 4 of 5', { exact: true }));
  c.ok('no payment was set up yet', sstate.prepared === null);
  c.ok('layout (sign before paying)', (await firstPage.evaluate(layoutProblems)).length === 0);
  await firstPage.getByRole('button', { name: 'Sign and continue to payment' }).click();
  await c.has('signing without answering is refused', firstPage.getByRole('alert').filter({ hasText: 'Do you have a heart condition?' }));
  await firstPage.getByLabel('Do you have a heart condition?', { exact: true }).selectOption('no');
  await firstPage.getByLabel('I have read the waiver and accept the risk.').check();
  await firstPage.getByLabel('Your full name', { exact: true }).fill('Lee Penrose');
  await draw(firstPage);
  await firstPage.getByRole('button', { name: 'Sign and continue to payment' }).click();
  await c.has('signing leads to agree and pay', firstPage.getByRole('heading', { name: 'Agree and pay' }));
  c.ok('the signature was saved before payment', sstate.signed?.p_signer_name === 'Lee Penrose');
  await firstPage.getByRole('button', { name: 'Continue to payment' }).click();
  await c.has('and now the card form can be set up', firstPage.getByText('fake card form'));
  await firstPage.getByLabel(WORDING).check();
  await firstPage.getByRole('button', { name: 'Pay £59.00 and join' }).click();
  await c.has('paying makes them a member', firstPage.getByRole('heading', { name: "You're in, Lee" }));
  await c.has('the waiver is already ticked off the list', firstPage.getByRole('img', { name: '1 of 3 done' }));
  await first.close();
  await free.ctx.close();

  // ---- The member app brings them back to the list, and shows nothing at a gym on the full journey ----
  process.env.MOCK_ROLE = 'member';
  const mem = await signedInPage(browser, viewport);
  const mstate = newState();
  let held = true;
  await mockSupabase(mem.page, async ({ route, path }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z', membership_plans: { name: 'Hybrid', includes_classes: true, includes_open_gym: true, includes_pt: false } }]);
    if (path.endsWith('/rpc/get_my_ready_status')) {
      if (!mstate.quickGym) return reply(route, { style: 'full', ready: true, held: false, items: [] });
      return reply(route, { style: 'quick', ready: false, held, items: [{ key: 'emergency', label: 'Emergency contact', required: true, done: false }, { key: 'address', label: 'Your address', required: false, done: false }] });
    }
    if (path.endsWith('/gyms')) return reply(route, { slug: 'puffin' });
    return false;
  });
  mstate.quickGym = true;
  await mem.page.goto(`${base}/m/today`);
  await c.has('a member with things left sees a card on Today', mem.page.getByRole('region', { name: 'Finish setting up' }));
  await c.has('it says the door code is waiting', mem.page.getByText('Your door code is waiting'));
  c.ok('and there is no door card yet', (await mem.page.getByRole('region', { name: 'Door access' }).count()) === 0);
  c.ok('layout (member today)', (await mem.page.evaluate(layoutProblems)).length === 0);
  await mem.page.getByRole('link', { name: 'Finish now' }).click();
  await c.has('it leads to the list', mem.page.getByRole('heading', { name: 'Get ready for your first visit' }));
  await c.has('with the emergency contact first', mem.page.getByRole('button', { name: /Emergency contact/ }));
  c.ok('layout (member list)', (await mem.page.evaluate(layoutProblems)).length === 0);
  mstate.quickGym = false;
  await mem.page.goto(`${base}/m/today`);
  await c.has('Today loads', mem.page.getByRole('heading', { level: 1 }));
  await mem.page.waitForTimeout(600);
  c.ok('a gym on the full journey shows no such card', (await mem.page.getByRole('region', { name: 'Finish setting up' }).count()) === 0);
  await mem.ctx.close();
  delete process.env.MOCK_ROLE;

  c.ok(`no script errors ${errors.join(' | ').slice(0, 400)}`, errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
