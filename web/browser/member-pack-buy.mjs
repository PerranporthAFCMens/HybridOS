// Browser gate: a member buying a class pack by card from the Classes screen. A gym that sells packs and takes cards shows them;
// the card form is Stripe's (faked here); the pack is only counted after the server confirms. Mocked network, nothing leaves the machine.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const classes = [{ session_id: 'b1', name: 'Pack Hyrox', description: '', starts_at: hours(50), ends_at: hours(51), capacity: 10, booked_count: 3, available_spaces: 7, is_booked: false }];
const TYPES = [
  { id: 'k1', name: '10 class pack', credits: 10, price_pence: 6000, valid_days: 90, is_active: true },
  { id: 'k2', name: 'Off sale pack', credits: 5, price_pence: 3000, valid_days: null, is_active: false },
];
const WORDING = 'I want to buy 10 class pack (10 classes, to use within 90 days of buying) from Puffin Performance and agree that Puffin Performance can charge this card £60.00 once, today.';

const FAKE_STRIPE = () => {
  window.__stripe = { confirms: 0, declineNext: false };
  window.Stripe = () => ({
    elements: () => ({ create: () => ({ mount(el) { el.innerHTML = '<div style="height:100px">fake card form</div>'; }, on(event, cb) { if (event === 'ready') setTimeout(cb, 30); }, destroy() {} }) }),
    confirmPayment: async () => {
      window.__stripe.confirms += 1;
      if (window.__stripe.declineNext) { window.__stripe.declineNext = false; return { error: { message: 'Your card was declined.' } }; }
      return { paymentIntent: { status: 'succeeded' } };
    },
  });
};

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  for (const mode of ['stripe', 'off']) {
    process.env.MOCK_ROLE = 'member';
    const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
    await ctx.addInitScript(FAKE_STRIPE);
    const calls = [];
    let finishStatus = 'paid';
    await mockSupabase(page, async ({ route, path, body }) => {
      if (path.endsWith('/rpc/member_class_schedule')) return reply(route, classes);
      if (path.endsWith('/rpc/get_my_waitlists')) return reply(route, []);
      if (path.endsWith('/class_pack_types')) return reply(route, TYPES);
      if (path.endsWith('/class_packs')) return reply(route, []);
      if (path.endsWith('/gyms')) return reply(route, [{ slug: 'puffin' }]);
      if (path.endsWith('/rpc/get_gym_payment_mode')) return reply(route, mode);
      if (path.endsWith('/functions/v1/stripe-pack-buy')) {
        calls.push(`${body.action} ${body.pack_type_id ?? body.payment_intent_id}`);
        if (body.action === 'prepare') {
          return reply(route, { ok: true, publishable_key: 'pk_test_abc', stripe_account: 'acct_123', client_secret: 'pi_1_secret_x', payment_intent_id: 'pi_1', amount_pence: 6000, pack: { id: 'k1', name: '10 class pack', credits: 10, valid_days: 90 }, wording: WORDING });
        }
        return reply(route, { ok: true, status: finishStatus, pack_id: 'p1' });
      }
      if (path.endsWith('/memberships')) return reply(route, []);
      if (path.endsWith('/pt_appointments')) return reply(route, []);
      return false;
    });
    const c = runChecks();
    await page.goto(`${base}/m/classes`);
    await c.has('classes page', page.getByRole('heading', { name: 'Classes', exact: true }));
    if (mode === 'off') {
      c.ok('a gym that does not take cards shows no packs', (await page.getByRole('region', { name: 'Class packs' }).count()) === 0);
      c.ok('no page errors', errors.length === 0);
      if (!c.report(`buy pack, cards off ${name}`)) allOk = false;
      await ctx.close();
      continue;
    }
    await c.has('the packs on sale are listed', page.getByRole('region', { name: 'Class packs' }).getByText('10 class pack'));
    c.ok('with the classes, price per class and how long it lasts', (await page.getByRole('region', { name: 'Class packs' }).textContent()).includes('10 classes · £6.00 a class · Lasts 90 days'));
    c.ok('a pack that is off sale is not offered', (await page.getByText('Off sale pack').count()) === 0);
    await page.getByRole('button', { name: 'Buy 10 class pack' }).click();
    await c.has('the card form opens with the agreement', page.getByRole('dialog').getByText(WORDING));
    c.ok('nothing is charged yet', calls.join() === 'prepare k1' && (await page.evaluate(() => window.__stripe.confirms)) === 0);
    c.ok('layout (pay dialog)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.getByRole('button', { name: 'Pay £60.00' }).click();
    await c.has('paying without agreeing is refused', page.getByRole('alert').getByText('Tick the box'));
    c.ok('and nothing was sent to Stripe', (await page.evaluate(() => window.__stripe.confirms)) === 0);
    await page.getByRole('checkbox').check();
    await page.evaluate(() => { window.__stripe.declineNext = true; });
    await page.getByRole('button', { name: 'Pay £60.00' }).click();
    await c.has('a declined card says so', page.getByRole('alert').getByText('Your card was declined.'));
    c.ok('and no pack is claimed', !calls.some((x) => x.startsWith('finish')));
    await page.getByRole('button', { name: 'Pay £60.00' }).click();
    await c.has('a payment that worked says the pack is theirs', page.getByText('Thank you. 10 class pack is yours: 10 classes added.'));
    c.ok('the server was asked to confirm with Stripe', calls.includes('finish pi_1'));
    c.ok('the dialog closes', (await page.getByRole('dialog').count()) === 0);
    c.ok('no page errors', errors.length === 0);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
    if (!c.report(`buy pack, cards on ${name}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
