// Browser gate: the Class packs page. An owner sees the packs the gym sells, makes one, edits one, and puts one on or off sale.
// Signed in as an owner, at phone and desktop width. Supabase is mocked at the network layer. Checks the exact request of every action.
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

const typesDb = [
  { id: 'k1', name: '10 class pack', credits: 10, price_pence: 6000, valid_days: 90, is_active: true },
  { id: 'k2', name: 'Drop-in', credits: 1, price_pence: 1200, valid_days: null, is_active: false },
];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/class_pack_types') && ['POST', 'PATCH'].includes(method)) {
      writes.push({ method, query: Object.fromEntries(url.searchParams), body });
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/class_pack_types')) return reply(route, typesDb);
    return false;
  });

  await page.goto(`${base}/packs`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Class packs', level: 1 }));
  await c.has('summary counts what is on sale', page.getByText('1 on sale · 2 total'));
  const card = (t) => page.locator('.plan', { hasText: t });
  await c.has('a pack shows its price and number of classes', card('10 class pack').getByText('£60.00'));
  c.ok('and the price of one class and how long it lasts', (await card('10 class pack').getByText('£6.00 a class').count()) === 1 && (await card('10 class pack').getByText('Lasts 90 days').count()) === 1);
  c.ok('a pack with no expiry says so, and a pack off sale is marked', (await card('Drop-in').getByText('Never expires').count()) === 1 && (await card('Drop-in').getByText('Off sale', { exact: true }).count()) === 1);
  c.ok('the menu has a Class packs tab', (await page.getByRole('link', { name: 'Class packs', exact: true }).count()) > 0);
  c.ok('looking wrote nothing', writes.length === 0);
  c.ok('layout (list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/packs-${name}.png`, fullPage: true });

  // Put one on sale, take one off
  await card('Drop-in').getByRole('button', { name: 'Put on sale' }).click();
  await page.waitForTimeout(250);
  const on = writes.find((w) => w.body?.is_active === true);
  c.ok('putting on sale is exact: this pack and this gym only', on && on.method === 'PATCH' && on.query.id === 'eq.k2' && on.query.gym_id === `eq.${GYM}` && Object.keys(on.body).sort().join() === 'is_active,updated_at');
  await card('10 class pack').getByRole('button', { name: 'Take off sale' }).click();
  await page.waitForTimeout(250);
  const off = writes.find((w) => w.body?.is_active === false);
  c.ok('taking off sale is exact', off && off.query.id === 'eq.k1' && off.query.gym_id === `eq.${GYM}`);

  // New pack: validation first, then a real save
  writes.length = 0;
  await page.getByRole('button', { name: 'New pack' }).click();
  const dialog = page.getByRole('dialog');
  await c.has('the form opens', dialog.getByText('New class pack').first());
  c.ok('layout (form)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/packs-form-${name}.png` });
  await dialog.getByRole('button', { name: 'Save class pack' }).click();
  await c.has('a blank form is refused', dialog.getByText('Give the pack a name, like 10 class pack.'));
  await dialog.getByLabel('Name').fill('5 class pack');
  await dialog.getByLabel('Number of classes').fill('0');
  await dialog.getByLabel('Price (£)').fill('35');
  await dialog.getByRole('button', { name: 'Save class pack' }).click();
  await c.has('zero classes is refused', dialog.getByText(/whole number from 1 to 200/));
  c.ok('nothing written for refused forms', writes.length === 0);
  await dialog.getByLabel('Number of classes').fill('5');
  await dialog.getByLabel('Days it lasts').fill('60');
  await dialog.getByRole('button', { name: 'Save class pack' }).click();
  c.ok('the form closes once saved', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const made = writes.find((w) => w.method === 'POST');
  c.ok('create is exact: this gym, the name, classes, price in pence and days', made && JSON.stringify(made.body) === JSON.stringify({ gym_id: GYM, name: '5 class pack', credits: 5, price_pence: 3500, valid_days: 60 }));

  // Edit: the form is filled in; clearing the days means never
  writes.length = 0;
  await card('10 class pack').getByRole('button', { name: 'Edit' }).click();
  c.ok('the edit form is filled in', (await dialog.getByLabel('Name').inputValue()) === '10 class pack' && (await dialog.getByLabel('Number of classes').inputValue()) === '10' && (await dialog.getByLabel('Price (£)').inputValue()) === '60.00' && (await dialog.getByLabel('Days it lasts').inputValue()) === '90');
  await c.has('it says held packs are not changed', dialog.getByText('Changing a pack does not change packs members already have.'));
  await dialog.getByLabel('Price (£)').fill('55');
  await dialog.getByLabel('Days it lasts').fill('');
  await dialog.getByRole('button', { name: 'Save class pack' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const edited = writes.find((w) => w.method === 'PATCH');
  c.ok('edit is exact: this pack only, new price, no expiry', edited && edited.query.id === 'eq.k1' && edited.query.gym_id === `eq.${GYM}` && edited.body.price_pence === 5500 && edited.body.valid_days === null && edited.body.credits === 10 && edited.body.gym_id === undefined);

  // Escape closes without saving
  writes.length = 0;
  await page.getByRole('button', { name: 'New pack' }).click();
  await page.keyboard.press('Escape');
  c.ok('Escape closes the form and writes nothing', (await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false)) && writes.length === 0);

  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
