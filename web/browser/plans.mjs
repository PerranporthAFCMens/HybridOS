// Browser gate: Membership plans, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Besides what is on screen, this captures every write
// (create, edit, activate/deactivate) and checks its exact request. It also runs the same layout
// rules as audit.mjs (no sideways scroll, nothing sticking out, 40px tap targets) on the page and the form.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const plansDb = [
  { id: 'p1', name: 'Hybrid Monthly', description: 'All access', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', joining_fee_pence: 1000, classes_per_week: null, includes_open_gym: true, includes_classes: true, includes_pt: false, is_public: true, members_can_switch_to: false, min_term_months: 6, notice_days: 14, is_active: true },
  { id: 'p2', name: 'Old Weekly Deal with a rather long plan name', description: null, price_pence: 1200, billing_interval: 'weekly', access_type: 'gym', joining_fee_pence: 0, classes_per_week: 3, includes_open_gym: true, includes_classes: false, includes_pt: true, is_public: false, is_active: false },
];

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
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/rpc/apply_plan_terms_to_members')) { writes.push({ method, path, query: {}, body }); return reply(route, 2); }
    if (path.endsWith('/membership_plans') && ['PATCH', 'POST'].includes(method)) {
      writes.push({ method, query: Object.fromEntries(url.searchParams), body });
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/membership_plans')) return reply(route, plansDb);
    return false;
  });
  await page.addInitScript(() => {
    const s = document.createElement('style');
    s.textContent = 'input[type=date]::-webkit-datetime-edit{display:inline-block;min-width:330px}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
  });

  await page.goto(`${base}/plans`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Membership plans', level: 1 }));
  await c.has('summary', page.getByText('1 active · 2 total'));
  await c.has('active plan', page.getByRole('heading', { name: 'Hybrid Monthly' }));
  await c.has('price', page.getByText('£45.00').first());
  await c.has('joining fee', page.getByText('+ £10.00 joining fee'));
  await c.has('inactive plan tag', page.getByText('Inactive', { exact: true }));
  await c.has('unlimited classes wording', page.getByText('Open gym · Classes · Unlimited classes'));
  await c.has('hidden plan wording', page.getByText('Classes/week', { exact: false }).or(page.getByText('3 classes/week')).first());
  c.ok('plan layout (list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/plans-${name}.png`, fullPage: true });

  // Deactivate p1, activate p2
  await page.locator('.plan', { hasText: 'Hybrid Monthly' }).getByRole('button', { name: 'Deactivate' }).click();
  await page.waitForFunction(() => true);
  await page.waitForTimeout(250);
  const off = writes.find((w) => w.body?.is_active === false);
  c.ok('deactivate write', off && off.method === 'PATCH' && off.query.id === 'eq.p1' && off.query.gym_id === `eq.${GYM}` && Object.keys(off.body).join() === 'is_active');
  await page.locator('.plan', { hasText: 'Old Weekly Deal' }).getByRole('button', { name: 'Activate' }).click();
  await page.waitForTimeout(250);
  const on = writes.find((w) => w.body?.is_active === true);
  c.ok('activate write', on && on.query.id === 'eq.p2' && on.query.gym_id === `eq.${GYM}`);

  // New plan: validation first, then a real save
  writes.length = 0;
  await page.getByRole('button', { name: 'New plan' }).click();
  const dialog = page.getByRole('dialog');
  await c.has('form opens', dialog.getByText('New membership').first());
  c.ok('plan layout (form)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/plans-form-${name}.png` });
  await dialog.getByRole('button', { name: 'Save membership plan' }).click();
  await c.has('blank form refused', dialog.getByText('Add a name and valid price.'));
  c.ok('no write on invalid form', writes.length === 0);
  await dialog.getByLabel('Name').fill('Student');
  await dialog.getByLabel('Price (£)').fill('29.99');
  await dialog.getByLabel('Billing').selectOption('quarterly');
  await dialog.getByLabel('Joining fee (£)').fill('5');
  await dialog.getByLabel('Classes per week').fill('2');
  await dialog.getByLabel('Description').fill('For students');
  await dialog.getByLabel('Includes PT').click();
  await dialog.getByLabel('Visible for new members to join').click();
  await dialog.getByRole('button', { name: 'Save membership plan' }).click();
  c.ok('form closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const created = writes.find((w) => w.method === 'POST');
  c.ok('create write', created && JSON.stringify(created.body) === JSON.stringify({
    gym_id: GYM, name: 'Student', description: 'For students', price_pence: 2999, billing_interval: 'quarterly', joining_fee_pence: 500,
    access_type: 'hybrid', includes_open_gym: true, includes_classes: true, includes_pt: true, classes_per_week: 2, is_public: false, members_can_switch_to: false,
    min_term_months: null, notice_days: null,
  }));

  // Edit p2: form is pre-filled; change the price only
  writes.length = 0;
  await page.locator('.plan', { hasText: 'Old Weekly Deal' }).getByRole('button', { name: 'Edit' }).click();
  await c.has('edit form title', dialog.getByText('Edit membership').first());
  c.ok('edit prefilled', (await dialog.getByLabel('Price (£)').inputValue()) === '12.00' && (await dialog.getByLabel('Classes per week').inputValue()) === '3' && (await dialog.getByLabel('Billing').inputValue()) === 'weekly');
  c.ok('edit ticks prefilled', (await dialog.getByLabel('Includes PT').isChecked()) && !(await dialog.getByLabel('Includes classes').isChecked()) && !(await dialog.getByLabel('Visible for new members to join').isChecked()));
  await dialog.getByLabel('Price (£)').fill('13.50');
  await dialog.getByRole('button', { name: 'Save membership plan' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const edited = writes.find((w) => w.method === 'PATCH');
  c.ok('edit write scoped to this plan and gym', edited && edited.query.id === 'eq.p2' && edited.query.gym_id === `eq.${GYM}` && edited.body.price_pence === 1350 && edited.body.name.startsWith('Old Weekly') && edited.body.gym_id === undefined);

  // Terms: each plan shows its own, the editor takes any numbers and only warns about long ones
  writes.length = 0;
  await c.has('a plan with its own terms shows them', page.locator('.plan', { hasText: 'Hybrid Monthly' }).getByText('6 months minimum · 2 weeks notice to leave'));
  await c.has('a plan with none shows the gym\'s usual terms (no minimum term, 30 days, when none are saved)', page.locator('.plan', { hasText: 'Old Weekly Deal' }).getByText('Your usual terms: No minimum term · 1 month notice to leave'));
  await page.locator('.plan', { hasText: 'Hybrid Monthly' }).getByRole('button', { name: 'Edit' }).click();
  c.ok('terms prefilled', (await dialog.getByLabel('Minimum term (months)').inputValue()) === '6' && (await dialog.getByLabel('Notice to leave (days)').inputValue()) === '14');
  c.ok('no warning for ordinary terms', (await dialog.getByRole('note').count()) === 0);
  await dialog.getByLabel('Minimum term (months)').fill('24');
  await dialog.getByLabel('Notice to leave (days)').fill('90');
  await c.has('a long term is warned about', dialog.getByText(/more than 12 months can be treated as unfair/));
  await c.has('long notice is warned about', dialog.getByText(/More than a month of notice/));
  c.ok('layout (terms warnings)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByLabel('Minimum term (months)').fill('1.5');
  await dialog.getByRole('button', { name: 'Save membership plan' }).click();
  await c.has('a part month is refused', dialog.getByText(/whole number of months from 0 to 60/));
  c.ok('and nothing was saved', writes.length === 0);
  await dialog.getByLabel('Minimum term (months)').fill('24');
  c.ok('passing terms on is held back while there are unsaved changes', await dialog.getByRole('button', { name: 'Pass these terms to current members' }).isDisabled());
  await dialog.getByRole('button', { name: 'Save membership plan' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const termsSaved = writes.find((w) => w.method === 'PATCH');
  c.ok('longer terms are saved as typed (a warning is not a block)', termsSaved && termsSaved.query.id === 'eq.p1' && termsSaved.body.min_term_months === 24 && termsSaved.body.notice_days === 90);
  writes.length = 0;
  await page.locator('.plan', { hasText: 'Old Weekly Deal' }).getByRole('button', { name: 'Edit' }).click();
  await dialog.getByLabel('Minimum term (months)').fill('');
  await dialog.getByLabel('Notice to leave (days)').fill('0');
  await dialog.getByRole('button', { name: 'Save membership plan' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const blankTerm = writes.find((w) => w.method === 'PATCH');
  c.ok('blank means the gym-wide setting and 0 means none', blankTerm && blankTerm.body.min_term_months === null && blankTerm.body.notice_days === 0);

  // Passing a plan's terms on to its current members: a reason is needed, and only same-or-better terms go through
  writes.length = 0;
  await page.locator('.plan', { hasText: 'Hybrid Monthly' }).getByRole('button', { name: 'Edit' }).click();
  await dialog.getByRole('button', { name: 'Pass these terms to current members' }).click();
  await dialog.getByRole('button', { name: 'Pass them on' }).click();
  await c.has('a reason is needed', dialog.getByText('Give a reason (a few words is fine).'));
  c.ok('nothing sent without a reason', !writes.some((w) => w.path.endsWith('/rpc/apply_plan_terms_to_members')));
  await dialog.getByLabel('Reason (kept on the record)').fill('We shortened the notice for everyone');
  await dialog.getByRole('button', { name: 'Pass them on' }).click();
  await c.has('the result is said in words', dialog.getByText('2 members now have these terms.'));
  const passed = writes.find((w) => w.path.endsWith('/rpc/apply_plan_terms_to_members'));
  c.ok('the request names the plan and the reason', passed && passed.body.p_plan_id === 'p1' && passed.body.p_reason === 'We shortened the notice for everyone');
  await page.keyboard.press('Escape');

  // Escape closes the form without saving
  writes.length = 0;
  await page.getByRole('button', { name: 'New plan' }).click();
  await page.keyboard.press('Escape');
  c.ok('Escape closes the form', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('no write when closed', writes.length === 0);

  // The menu reaches it
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
