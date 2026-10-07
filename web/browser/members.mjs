// Browser gate: the Members screen, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Besides what is on screen, this captures every write
// (lifecycle dates, membership status changes, assign membership) and checks its exact request.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const today = new Date().toISOString().slice(0, 10);
const ADA = '33333333-3333-4333-8333-333333333333';
const BOB = '44444444-4444-4444-8444-444444444444';
const CAT = '55555555-5555-4555-8555-555555555555';

const people = [
  { user_id: ADA, joined_at: '2026-03-01T00:00:00', attrition_on: null },
  { user_id: BOB, joined_at: '2026-05-01T00:00:00', attrition_on: null },
  { user_id: CAT, joined_at: '2026-04-01T00:00:00', attrition_on: '2026-09-30' },
];
const profiles = [
  { id: ADA, display_name: null, first_name: 'Ada', last_name: 'Zane' },
  { id: BOB, display_name: 'Bob Adams', first_name: null, last_name: null },
  { id: CAT, display_name: null, first_name: 'Cat', last_name: 'Young' },
];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, select, method, body }) => {
    if (['PATCH', 'POST'].includes(method)) {
      writes.push({ method, path, query: Object.fromEntries(url.searchParams), body });
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/gym_members')) return reply(route, people);
    if (path.endsWith('/profiles')) return reply(route, profiles);
    if (path.endsWith('/memberships') && select.includes('starts_on')) {
      return reply(route, [{ id: 'm1', status: 'active', starts_on: '2026-03-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', membership_plans: { name: 'Hybrid Monthly', price_pence: 4500, billing_interval: 'monthly' } }]);
    }
    if (path.endsWith('/memberships')) return reply(route, [{ user_id: ADA, status: 'active', membership_plans: { name: 'Hybrid Monthly' } }]);
    if (path.endsWith('/membership_plans')) {
      return reply(route, [{ id: 'p1', name: 'Hybrid Monthly', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true }]);
    }
    return false;
  });

  await page.goto(`${base}/next/#/members`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Members' }));
  await c.has('summary 3 users', page.getByText('3 gym users'));
  await c.has('plan and status on row', page.getByText('Hybrid Monthly · active'));
  await c.has('no membership yet', page.getByText('No membership yet').first());

  // Order by first name: Ada, Bob, Cat
  const order = await page.locator('.member-text b').allTextContents();
  c.ok('sorted by first name', order.join('|') === 'Ada Zane|Bob Adams|Cat Young');

  // Search narrows the list and the summary
  await page.getByLabel('Search members by name').fill('zan');
  await c.has('search summary', page.getByText('1 of 3 gym users'));
  await page.getByLabel('Search members by name').fill('');

  // Jump letter: B only
  await page.locator('.member-jump button', { hasText: /^B$/ }).click();
  c.ok('letter filter', (await page.locator('.member-text b').allTextContents()).join('|') === 'Bob Adams');
  await page.locator('.member-jump button', { hasText: /^B$/ }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  c.ok('no horizontal overflow (list)', !overflow);
  if (shots) await page.screenshot({ path: `${shots}/members-${name}.png`, fullPage: true });

  // Open Ada's record
  await page.locator('.member-row', { hasText: 'Ada Zane' }).click();
  const dialog = page.getByRole('dialog');
  await c.has('record opens', dialog.getByText('Customer lifecycle'));
  await c.has('existing membership', dialog.getByRole('heading', { name: 'Hybrid Monthly' }));
  c.ok('plan option', (await dialog.locator('option', { hasText: 'Hybrid Monthly — £45.00 / monthly' }).count()) === 1);
  if (shots) await page.screenshot({ path: `${shots}/member-record-${name}.png` });

  // iPhone date boxes have a wide built-in minimum width. Fake that here and check the boxes
  // stay inside the lifecycle card instead of spilling past its edge.
  await page.addStyleTag({ content: 'input[type=date]::-webkit-datetime-edit{display:inline-block;min-width:330px}' });
  const spill = await page.evaluate(() => {
    const card = document.querySelector('.record-section').getBoundingClientRect();
    const modal = document.querySelector('.modal-card');
    return { worst: Math.max(...[...document.querySelectorAll('.record-section input[type=date]')].map((i) => i.getBoundingClientRect().right - card.right)), scrolls: modal.scrollWidth > modal.clientWidth + 1 };
  });
  c.ok('date boxes stay inside the card with wide built-in width', spill.worst <= 0 && !spill.scrolls);

  // Lifecycle validation, then a real save
  await dialog.getByLabel('Attrition date').fill('2026-02-01');
  await dialog.getByRole('button', { name: 'Save lifecycle dates' }).click();
  await c.has('attrition before joined is refused', dialog.getByText('Attrition cannot be before joined date.'));
  c.ok('no write on invalid dates', writes.length === 0);
  await dialog.getByLabel('Attrition date').fill('2026-09-01');
  await dialog.getByRole('button', { name: 'Save lifecycle dates' }).click();
  await c.has('lifecycle saved', dialog.getByText('Saved.'));
  const life = writes.find((w) => w.method === 'PATCH' && w.path.endsWith('/gym_members'));
  c.ok('lifecycle write scoped to gym, user, member role', life && life.query.gym_id === `eq.${GYM}` && life.query.user_id === `eq.${ADA}` && life.query.role === 'eq.member');
  c.ok('lifecycle write body', life && life.body.joined_at === '2026-03-01T00:00:00' && life.body.attrition_on === '2026-09-01' && life.body.is_active === false && typeof life.body.updated_at === 'string');

  // Pause, then cancel
  await dialog.getByRole('button', { name: 'Pause' }).click();
  await c.has('membership updated', dialog.getByText('Membership updated.'));
  const pause = writes.find((w) => w.path.endsWith('/memberships') && w.body?.status === 'paused');
  c.ok('pause write', pause && pause.method === 'PATCH' && pause.query.id === 'eq.m1' && pause.query.gym_id === `eq.${GYM}` && Object.keys(pause.body).join() === 'status');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(200);
  const cancel = writes.find((w) => w.path.endsWith('/memberships') && w.body?.status === 'cancelled');
  c.ok('cancel write ends today and cancels payment', cancel && cancel.body.ends_on === today && cancel.body.payment_status === 'cancelled' && cancel.query.gym_id === `eq.${GYM}`);

  // Assign a membership
  await dialog.getByRole('button', { name: 'Assign membership' }).click();
  await c.has('assigned', dialog.getByText('Membership assigned.'));
  const assign = writes.find((w) => w.method === 'POST' && w.path.endsWith('/memberships'));
  c.ok('assign write body', assign && assign.body.gym_id === GYM && assign.body.user_id === ADA && assign.body.plan_id === 'p1' && assign.body.status === 'active' && assign.body.starts_on === today && assign.body.payment_provider === 'manual' && assign.body.payment_status === 'confirmed');
  c.ok('signed-in user is not used as the member', assign && assign.body.user_id !== USER);

  // GoCardless wording and pending payment
  await dialog.getByLabel('Payment method').selectOption('gocardless');
  await c.has('gocardless hint', dialog.getByText(/leaves payment pending until a GoCardless/));

  const overflowModal = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  c.ok('no horizontal overflow (record)', !overflowModal);
  await page.keyboard.press('Escape');
  c.ok('Escape closes the record', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
