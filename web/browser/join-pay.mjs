// Browser gate: paying to join. A gym that takes card payments sends a paid plan through a payment step; everything else joins as before.
// Mocked network and a faked Stripe card form only: no real account, no real card, nothing leaves the machine.
import { base, launch, mockSupabase, reply, runChecks, sizes, signedInPage } from './mock.mjs';

const GYM = '33333333-3333-4333-8333-333333333333';
const PLANS = [
  { id: 'plan-1', name: 'Hybrid', description: null, price_pence: 5900, billing_interval: 'monthly', includes_open_gym: true, includes_classes: true, classes_per_week: 3, includes_pt: false },
  { id: 'plan-free', name: 'Starter', description: 'Free to join', price_pence: 0, billing_interval: 'monthly' },
  { id: 'plan-pass', name: 'Day pass', description: 'One visit', price_pence: 800, billing_interval: 'one_off' },
];
const WORDING = 'I want the Hybrid membership at Puffin Performance to start today. I agree that Puffin Performance can charge this card £59.00 today.';

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

// A stand-in for Stripe.js: records how it was used and lets a check make the next payment fail.
const FAKE_STRIPE = () => {
  window.__stripe = { keys: [], secrets: [], confirms: 0, declineNext: false };
  window.Stripe = (key, opts) => {
    window.__stripe.keys.push([key, opts?.stripeAccount]);
    return {
      elements: ({ clientSecret }) => {
        window.__stripe.secrets.push(clientSecret);
        return {
          create: () => ({
            mount(el) { el.innerHTML = '<div style="height:100px">fake card form</div>'; },
            on(event, cb) { if (event === 'ready') setTimeout(cb, 30); },
            destroy() {},
          }),
        };
      },
      confirmPayment: async () => {
        window.__stripe.confirms += 1;
        if (window.__stripe.declineNext) { window.__stripe.declineNext = false; return { error: { message: 'Your card was declined.' } }; }
        return { paymentIntent: { status: 'succeeded' } };
      },
    };
  };
};

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await ctx.addInitScript(FAKE_STRIPE);
  const state = { prepared: null, finished: [], joined: null, finishStatus: 'active', memberships: [], mode: 'stripe' };
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/get_public_gym_join_options')) return reply(route, { gym_id: GYM, gym_name: 'Puffin Performance', logo_url: null, plans: PLANS });
    if (path.endsWith('/rpc/get_public_gym_signup_documents')) return reply(route, []);
    if (path.endsWith('/rpc/get_gym_payment_mode')) return reply(route, state.mode);
    if (path.endsWith('/rpc/save_my_join_details')) return reply(route, { ok: true });
    if (path.endsWith('/memberships')) return reply(route, state.memberships);
    if (path.endsWith('/rpc/join_public_gym_with_membership')) { state.joined = body; return reply(route, { ok: true, gym_id: GYM, plan_name: 'Starter' }); }
    if (path.endsWith('/functions/v1/stripe-join')) {
      if (body.action === 'prepare') {
        state.prepared = body;
        return reply(route, { ok: true, publishable_key: 'pk_test_abc', stripe_account: 'acct_123', client_secret: 'pi_1_secret_x', subscription_id: 'sub_1', amount_due_pence: 5900, amount_pence: 5900, interval: 'monthly', next_payment_date: '2026-11-14', wording: WORDING, under18: !!body.guardian });
      }
      state.finished.push(body);
      return reply(route, { ok: true, status: state.finishStatus });
    }
    return false;
  });
  const c = runChecks();
  const fill = (label, value) => page.getByLabel(label, { exact: true }).fill(value);
  const next = (label) => page.getByRole('button', { name: label, exact: true }).click();
  const alert = page.getByRole('alert');

  async function details(minor) {
    await c.has('about you', page.getByRole('heading', { name: 'About you' }));
    await fill('First name', minor ? 'Jo' : 'Sam');
    await fill('Last name', 'Penrose');
    await fill('Date of birth', minor ? `${new Date().getFullYear() - 15}-06-01` : '1990-04-12');
    await fill('Mobile number', '07700 900123');
    await next('Continue');
    await fill('Address line 1', '1 Cliff Road');
    await fill('Town or city', 'Perranporth');
    await fill('Postcode', 'PL28 8AB');
    await next('Continue');
    await fill('Their name', 'Alex Penrose');
    await fill('Their phone number', '07700 900124');
    await fill('How they are related to you', minor ? 'Parent' : 'Partner');
    await next(minor ? 'Continue' : 'Save and continue');
    if (minor) {
      await fill('Their name', 'Sam Penrose');
      await fill('Their phone number', '07700 900123');
      await next('Save and continue');
    }
  }

  // ---- An adult pays with a card ----
  await page.goto(`${base}/join/puffin`);
  await details(false);
  await c.has('plans are offered', page.getByRole('heading', { name: 'Choose your membership' }));
  await c.has('a one-off pass says it cannot be paid for online', page.getByText('This one cannot be paid for online'));
  c.ok('and has no choose button', (await page.getByRole('button', { name: 'Choose Day pass' }).count()) === 0);
  await page.getByRole('button', { name: 'Choose Hybrid' }).click();
  await c.has('a paid plan goes to the payment step', page.getByRole('heading', { name: 'Payment' }));
  await c.has('it says what is charged today and after', page.getByText('£59.00 today, then £59.00 every monthly'.replace('monthly', 'month')));
  c.ok('no guardian email asked of an adult', (await page.getByLabel('Parent or guardian email').count()) === 0);
  c.ok('no payment set up until they continue', state.prepared === null);
  await next('Continue to payment');
  await c.has('the card form appears', page.getByText('fake card form'));
  c.ok('payment was prepared for this gym and plan, with no guardian', state.prepared?.gym_id === GYM && state.prepared?.plan_id === 'plan-1' && !('guardian' in state.prepared));
  const stripeUse = await page.evaluate(() => window.__stripe);
  c.ok('the card form is on the gym\'s own Stripe account with the sent secret', JSON.stringify(stripeUse.keys) === JSON.stringify([['pk_test_abc', 'acct_123']]) && stripeUse.secrets[0] === 'pi_1_secret_x');
  await c.has('the agreement is shown word for word', page.getByText(WORDING));
  await c.has('the button shows the amount', page.getByRole('button', { name: 'Pay £59.00 and join' }));
  c.ok('layout (payment)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Pay £59.00 and join' }).click();
  await c.has('paying without agreeing is refused', alert.filter({ hasText: 'Tick the box' }));
  c.ok('and nothing was charged', (await page.evaluate(() => window.__stripe.confirms)) === 0);
  await page.getByLabel(WORDING).check();
  await page.evaluate(() => { window.__stripe.declineNext = true; });
  await page.getByRole('button', { name: 'Pay £59.00 and join' }).click();
  await c.has('a declined card says so and stays on the form', alert.filter({ hasText: 'Your card was declined.' }));
  c.ok('and the membership is not switched on', state.finished.length === 0);
  await page.getByRole('button', { name: 'Pay £59.00 and join' }).click();
  await c.has('a second try that works makes them a member', page.getByRole('heading', { name: 'Hybrid is active' }));
  c.ok('the server was asked to confirm the payment for their subscription', JSON.stringify(state.finished) === JSON.stringify([{ action: 'finish', gym_id: GYM, plan_id: 'plan-1', subscription_id: 'sub_1' }]));
  c.ok('the old join (no payment) was not used', state.joined === null);
  c.ok('layout (done)', (await page.evaluate(layoutProblems)).length === 0);

  // ---- The bank has not confirmed yet ----
  state.prepared = null; state.finished = []; state.finishStatus = 'pending';
  await page.goto(`${base}/join/puffin`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await details(false);
  await page.getByRole('button', { name: 'Choose Hybrid' }).click();
  await next('Continue to payment');
  await page.getByLabel(WORDING).check();
  await page.getByRole('button', { name: 'Pay £59.00 and join' }).click();
  await c.has('an unconfirmed payment says it is received and not to pay again', page.getByRole('heading', { name: 'Payment received' }));
  await c.has('with the reason', page.getByText(/Please do not pay again/));
  c.ok('the server was asked more than once', state.finished.length > 1);

  // ---- Under 18: the parent or guardian pays ----
  state.prepared = null; state.finished = []; state.finishStatus = 'active';
  await page.goto(`${base}/join/puffin`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await details(true);
  await page.getByRole('button', { name: 'Choose Hybrid' }).click();
  await c.has('it says the parent or guardian agrees and pays', page.getByText(/Sam Penrose agrees and pays/));
  await next('Continue to payment');
  await c.has('their email is required', alert.filter({ hasText: 'email address' }));
  c.ok('and nothing was set up', state.prepared === null);
  await page.getByLabel('Parent or guardian email').fill('sam@example.test');
  await next('Continue to payment');
  await c.has('the card form appears for the guardian', page.getByText('fake card form'));
  c.ok('their name and email were sent', JSON.stringify(state.prepared?.guardian) === JSON.stringify({ name: 'Sam Penrose', email: 'sam@example.test' }));
  c.ok('layout (guardian payment)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Change membership' }).click();
  await c.has('they can go back and change plan', page.getByRole('heading', { name: 'Choose your membership' }));

  // ---- A free plan needs no card ----
  state.joined = null;
  await page.getByRole('button', { name: 'Choose Starter' }).click();
  await c.has('a free plan joins straight away', page.getByRole('heading', { name: 'Starter is active' }));
  c.ok('through the usual join', state.joined?.p_gym_slug === 'puffin' && state.joined?.p_plan_id === 'plan-free');

  // ---- An unfinished payment can be picked up again; a finished membership cannot ----
  state.memberships = [{ status: 'pending' }];
  await page.goto(`${base}/join/puffin`);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await c.has('a pending membership is not "already a member": they can carry on and pay', page.getByRole('heading', { name: 'About you' }));
  state.memberships = [{ status: 'active' }];
  await page.reload();
  await c.has('an active member is still told so', page.getByRole('heading', { name: 'You are already a member of Puffin Performance' }));

  // ---- A gym that does not take payment here joins as before, pending or not ----
  state.mode = 'off'; state.memberships = [{ status: 'pending' }];
  await page.reload();
  await c.has('with payments off, pending still blocks as it always did', page.getByRole('heading', { name: 'You are already a member of Puffin Performance' }));

  c.ok(`no script errors ${errors.join(' | ').slice(0, 400)}`, errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
