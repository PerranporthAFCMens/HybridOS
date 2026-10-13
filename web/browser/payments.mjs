// Browser gate: Settings > Payments (admin). The gym links its Stripe account (Stripe's own page does the set-up), flips the
// "members can pay by card" switch (only once Stripe says the account can take cards) and chooses how long before a class a
// member can still cancel. Signed in as an owner, phone and desktop width. Supabase and the stripe-connect function are mocked;
// the exact request of every action is checked.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side') || e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const calls = [];
  let settings = [];
  let link = [];
  let stripeReply = null; // what the function answers next, when not the usual
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await page.route('https://connect.stripe.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Stripe set-up</body></html>' }));
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/functions/v1/stripe-connect')) {
      calls.push(body);
      if (stripeReply) { const r = stripeReply; stripeReply = null; await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) }); return true; }
      if (body.action === 'start') { link = [{ environment: 'sandbox', details_submitted: false, charges_enabled: false, payouts_enabled: false, last_error: null }]; return reply(route, { ok: true, url: 'https://connect.stripe.com/setup/e/acct_TEST1/abc' }); }
      // refresh: Stripe says the account is ready
      link = [{ environment: 'sandbox', details_submitted: true, charges_enabled: true, payouts_enabled: true, last_error: null }];
      return reply(route, { ok: true, status: { linked: true } });
    }
    if (path.endsWith('/gym_stripe_accounts')) return reply(route, link);
    if (path.endsWith('/gym_payment_settings')) {
      if (method === 'POST') { writes.push({ query: Object.fromEntries(url.searchParams), body }); settings = [{ payments_enabled: body.payments_enabled, cancellation_hours: body.cancellation_hours }]; await route.fulfill({ status: 204, body: '' }); return true; }
      return reply(route, settings);
    }
    return false;
  });

  // 1. Nothing connected yet
  await page.goto(`${base}/payments`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Payments', level: 1 }));
  await c.has('says Stripe is not connected', page.getByText('Stripe is not connected.'));
  const sw = page.getByRole('checkbox', { name: 'Members can pay by card' });
  c.ok('the pay switch is off and cannot be used yet', !(await sw.isChecked()) && (await sw.isDisabled()));
  await c.has('and says why', page.getByText('Connect Stripe first.'));
  c.ok('the window is the usual 24 hours', (await page.getByLabel('Members can cancel').inputValue()) === '24');
  c.ok('looking wrote nothing and did not call Stripe', writes.length === 0 && calls.length === 0);
  c.ok('layout (not connected)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/payments-none-${name}.png`, fullPage: true });

  // 2. A refused connect shows the reason
  stripeReply = { status: 403, body: { error: 'Only an owner or admin can manage payments (your role here is staff).' } };
  await page.getByRole('button', { name: 'Connect Stripe' }).click();
  await c.has('a refusal is shown in words', page.getByText('Only an owner or admin can manage payments'));

  // 3. Connect: asks the function, then goes to Stripe's own page
  calls.length = 0;
  await page.getByRole('button', { name: 'Connect Stripe' }).click();
  await page.waitForURL('https://connect.stripe.com/**');
  c.ok('the function is asked to start, for this gym, returning to this page', calls.length === 1 && calls[0].action === 'start' && calls[0].gym_id === GYM && calls[0].return_to.endsWith('/payments') && calls[0].return_to.startsWith('http') && !calls[0].return_to.includes('?'));
  c.ok('and the owner lands on Stripe', page.url().startsWith('https://connect.stripe.com/setup/e/acct_TEST1'));

  // 4. Back from Stripe: asked once how the account is doing
  calls.length = 0;
  await page.goto(`${base}/payments`);
  await c.has('the account is now ready', page.getByText('Stripe is connected and can take card payments.'));
  c.ok('Stripe was asked once, for this gym', calls.length === 1 && calls[0].action === 'refresh' && calls[0].gym_id === GYM);
  c.ok('a test connection says no real money moves', await page.getByText('This is a test connection: no real money moves.').isVisible());
  c.ok('the pay switch can now be used', !(await sw.isDisabled()) && !(await sw.isChecked()));
  c.ok('layout (connected)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/payments-ready-${name}.png`, fullPage: true });

  // 5. The switch
  await sw.check();
  await c.has('turning payments on says so', page.getByText('Payments are on.'));
  c.ok('saved exactly: this gym, on, the usual window', writes.length === 1 && writes[0].body.gym_id === GYM && writes[0].body.payments_enabled === true && writes[0].body.cancellation_hours === 24 && writes[0].query.on_conflict === 'gym_id');
  await sw.uncheck();
  await c.has('and off again', page.getByText('Payments are off. Nothing is charged to anyone while this is off.'));
  c.ok('saved off', writes.length === 2 && writes[1].body.payments_enabled === false);

  // 6. The cancellation window
  await page.getByLabel('Members can cancel').selectOption('48');
  await c.has('the window is saved and explained', page.getByText('Members can cancel up to 2 days before the class.'));
  c.ok('saved exactly: 48 hours, payments still off', writes.length === 3 && writes[2].body.cancellation_hours === 48 && writes[2].body.payments_enabled === false);
  await page.getByLabel('Members can cancel').selectOption('0');
  await c.has('no notice needed reads naturally', page.getByText('Members can cancel right up to the start of the class.'));
  c.ok('saved as 0', writes[3].body.cancellation_hours === 0);

  // 7. Linked from Settings
  await page.goto(`${base}/settings`);
  await c.has('Settings links to it', page.getByText('Connect Stripe so members can pay by card'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
