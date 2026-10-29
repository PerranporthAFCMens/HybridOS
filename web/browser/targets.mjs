// Browser gate: Targets (monthly goals for the gym and each coach), signed in as an owner.
// Supabase is mocked at the network layer. Checks progress for the month, saving, clearing, bad input, the goals box on
// the Reports summary, and that nothing else is written.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';
import { openReport } from './reportNav.mjs';

const C1 = '83333333-3333-4333-8333-333333333333';
const O1 = '84444444-4444-4444-8444-444444444444';
const startOfMonthPlus = () => { const x = new Date(); x.setDate(1); x.setHours(12, 0, 0, 0); return x.toISOString(); };

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *')) {
    if (e.closest('.side')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className.baseVal ?? e.className).split(' ')[0]}`;
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
  let targets = [{ id: 't1', user_id: null, metric: 'income_pence', target_value: 20000 }];
  let denied = false;
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await mockSupabase(page, async ({ route, path, method, body }) => {
    if (path.endsWith('/gym_targets')) {
      if (denied) { await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'relation does not exist' }) }); return true; }
      if (method === 'GET') return reply(route, targets);
      writes.push(`${method} gym_targets ${JSON.stringify(body)}`);
      if (method === 'POST') targets = [...targets, { id: `n${targets.length}`, user_id: body.user_id, metric: body.metric, target_value: body.target_value }];
      await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      return true;
    }
    if (path.endsWith('/rpc/get_gym_team_accounts')) return reply(route, [{ user_id: C1, role: 'coach', display_name: 'Casey Coach', email: 'casey@example.test' }, { user_id: O1, role: 'owner', display_name: 'Olive Owner', email: 'olive@example.test' }]);
    if (path.endsWith('/payment_records')) return reply(route, [{ id: 'p1', user_id: C1, charge_date: startOfMonthPlus().slice(0, 10), created_at: startOfMonthPlus(), amount_pence: 5000, state: 'paid_out', provider: 'stripe' }]);
    if (path.endsWith('/class_sessions')) return reply(route, [{ id: 's1', name: 'HIIT', starts_at: startOfMonthPlus(), ends_at: startOfMonthPlus(), capacity: 10 }]);
    if (path.endsWith('/class_session_staff')) return reply(route, [{ id: 'cs1', session_id: 's1', user_id: C1, is_lead: true }]);
    return false;
  });
  await page.goto(`${base}/reports`);
  const c = runChecks();
  await c.has('the summary shows a goals box for the one goal set', page.getByRole('heading', { name: 'Goals this month' }));
  c.ok('with the income goal in pounds', (await page.locator('.target-progress-text').first().textContent()).includes('of £200'));

  await openReport(page, 'Targets');
  await c.has('the Targets page opens', page.getByRole('heading', { name: 'Targets', level: 1 }));
  await c.has('the coach is listed', page.getByRole('heading', { name: 'Casey Coach' }));
  c.ok('an owner who also teaches is listed too, and so is every team member', (await page.getByRole('heading', { name: 'Olive Owner' }).count()) === 1);
  c.ok('income goal box shows £200 as typed', (await page.getByLabel(/^Income collected \(pounds a month\)/).inputValue()) === '200');
  c.ok('no goal yet for new members', (await page.getByLabel(/^New members \(a month\)/).inputValue()) === '');
  c.ok('Save is off until something changes', await page.getByRole('button', { name: /^Save Income collected/ }).isDisabled());
  c.ok('layout (targets)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/targets-${name}.png`, fullPage: true });

  // Save a new gym goal
  await page.getByLabel(/^New members \(a month\)/).fill('10');
  await page.getByRole('button', { name: /^Save New members/ }).click();
  await c.has('saving says so', page.getByText('Saved.').first());
  c.ok('it was written for the whole gym', writes.some((w) => w.startsWith('POST') && w.includes('"metric":"members_joined"') && w.includes('"target_value":10') && w.includes('"user_id":null')));

  // A coach goal
  await page.getByLabel(/^Classes taught for Casey Coach/).fill('4');
  await page.getByRole('button', { name: /^Save Classes taught for Casey Coach/ }).click();
  await c.has('the coach goal shows progress', page.getByRole('progressbar', { name: /^Classes taught: 25% of the goal/ }));
  c.ok('written for that coach', writes.some((w) => w.includes('"metric":"classes_taught"') && w.includes(C1) && w.includes('"target_value":4')));

  // Bad input is refused and nothing is written
  const before = writes.length;
  await page.getByLabel(/^PT sessions done for Casey Coach/).fill('lots');
  await page.getByRole('button', { name: /^Save PT sessions done for Casey Coach/ }).click();
  await c.has('bad input is explained', page.getByText('Enter a whole number, or leave it empty for no goal.'));
  c.ok('and nothing was written', writes.length === before);

  // Changing and clearing
  await page.getByLabel(/^Income collected \(pounds a month\)/).fill('250.50');
  await page.getByRole('button', { name: /^Save Income collected/ }).click();
  await c.has('income saved in pence', page.locator('.target-progress-text', { hasText: 'Income collected' }));
  c.ok('the change was an update of pence', writes.some((w) => w.startsWith('PATCH') && w.includes('"target_value":25050')));
  await page.getByLabel(/^Income collected \(pounds a month\)/).fill('');
  await page.getByRole('button', { name: /^Save Income collected/ }).click();
  await page.waitForTimeout(400);
  c.ok('emptying a box asks to delete the goal', writes.some((w) => w.startsWith('DELETE')));
  c.ok('layout (targets, after saving)', (await page.evaluate(layoutProblems)).length === 0);

  // The summary still works if goals cannot be read (switch not yet turned on)
  denied = true;
  await page.goto(`${base}/reports?r=&p=30`);
  await c.has('the summary loads without goals', page.getByRole('heading', { name: 'How the business is doing' }));
  c.ok('and has no goals box', (await page.getByRole('heading', { name: 'Goals this month' }).count()) === 0);

  c.ok('only the targets table was written', writes.every((w) => w.includes('gym_targets')));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
