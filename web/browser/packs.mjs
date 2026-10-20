// Browser gate: the Class packs page. An owner sees the packs the gym sells, makes one, edits one, and puts one on or off sale,
// gives one to a member, sees the packs members hold and cancels one.
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

const people = [
  { user_id: 'u-ann', joined_at: '2026-01-01T00:00:00Z', attrition_on: null, role: 'member' },
  { user_id: 'u-bob', joined_at: '2026-02-01T00:00:00Z', attrition_on: null, role: 'member' },
];
const profiles = [
  { id: 'u-ann', display_name: 'Ann Archer', first_name: 'Ann', last_name: 'Archer' },
  { id: 'u-bob', display_name: 'Bob Brown', first_name: 'Bob', last_name: 'Brown' },
];
const heldDb = [
  { id: 'h1', user_id: 'u-ann', name: '10 class pack', credits_total: 10, credits_left: 7, expires_at: '2099-12-01T00:00:00Z', source: 'owner', voided_at: null, created_at: '2026-10-10T00:00:00Z' },
  { id: 'h2', user_id: 'u-bob', name: 'Drop-in', credits_total: 1, credits_left: 0, expires_at: null, source: 'purchase', voided_at: null, created_at: '2026-10-12T00:00:00Z' },
  { id: 'h3', user_id: 'u-gone', name: '10 class pack', credits_total: 10, credits_left: 4, expires_at: null, source: 'owner', voided_at: '2026-10-14T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const rpcs = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.includes('/rpc/owner_')) {
      rpcs.push({ path: path.split('/rpc/')[1], body });
      await route.fulfill({ status: 200, contentType: 'application/json', body: path.endsWith('give_class_pack') ? '"new-pack-id"' : 'null' });
      return true;
    }
    if (path.endsWith('/class_packs')) return reply(route, heldDb);
    if (path.endsWith('/gym_members')) return reply(route, people);
    if (path.endsWith('/profiles')) return reply(route, profiles);
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

  // Packs members hold
  const row = (t) => page.locator('.held', { hasText: t });
  await c.has('held packs list the member and the classes left', row('Ann Archer').getByText('7 of 10 classes left'));
  c.ok('an expiry date, and where it came from', (await row('Ann Archer').getByText(/Expires 1 Dec 2099/).count()) === 1 && (await row('Ann Archer').getByText(/Given by the gym/).count()) === 1 && (await row('Bob Brown').getByText(/Bought/).count()) === 1);
  c.ok('states: in use, used up, cancelled (member no longer at the gym)', (await row('Ann Archer').getByText('In use', { exact: true }).count()) === 1 && (await row('Bob Brown').getByText('Used up', { exact: true }).count()) === 1 && (await row('Former member').getByText('Cancelled', { exact: true }).count()) === 1);
  c.ok('only a pack in use can be cancelled', (await row('Ann Archer').getByRole('button', { name: 'Cancel pack' }).count()) === 1 && (await row('Bob Brown').getByRole('button').count()) === 0 && (await row('Former member').getByRole('button').count()) === 0);
  c.ok('the summary counts packs in use', (await page.getByText('1 in use · 3 given or bought').count()) === 1);
  c.ok('layout (held list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/packs-held-${name}.png`, fullPage: true });

  // Cancel needs a second tap; keeping it writes nothing
  await row('Ann Archer').getByRole('button', { name: 'Cancel pack' }).click();
  await row('Ann Archer').getByRole('button', { name: 'Keep it' }).click();
  c.ok('"Keep it" cancels nothing', rpcs.length === 0 && (await row('Ann Archer').getByRole('button', { name: 'Cancel pack' }).count()) === 1);
  await row('Ann Archer').getByRole('button', { name: 'Cancel pack' }).click();
  await row('Ann Archer').getByRole('button', { name: 'Yes, cancel it' }).click();
  await page.waitForTimeout(300);
  c.ok('cancelling calls the cancel function for this pack only', rpcs.length === 1 && rpcs[0].path === 'owner_void_class_pack' && JSON.stringify(rpcs[0].body) === JSON.stringify({ p_pack_id: 'h1' }));

  // Give a pack: only packs on sale have the button; a member must be chosen
  rpcs.length = 0;
  c.ok('only a pack on sale can be given', (await card('10 class pack').getByRole('button', { name: 'Give to a member' }).count()) === 1 && (await card('Drop-in').getByRole('button', { name: 'Give to a member' }).count()) === 0);
  await card('10 class pack').getByRole('button', { name: 'Give to a member' }).click();
  await c.has('the give form opens', dialog.getByText('Give a class pack').first());
  await c.has('it says nothing is charged', dialog.getByText(/Nothing is charged/));
  c.ok('members are listed by name', (await dialog.getByRole('option', { name: 'Ann Archer' }).count()) === 1 && (await dialog.getByRole('option', { name: 'Bob Brown' }).count()) === 1);
  c.ok('layout (give form)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Give class pack' }).click();
  await c.has('choosing nobody is refused', dialog.getByText('Choose who to give it to.'));
  c.ok('nothing called for a refused form', rpcs.length === 0);
  await dialog.getByLabel('Member').selectOption({ label: 'Bob Brown' });
  await dialog.getByRole('button', { name: 'Give class pack' }).click();
  c.ok('the form closes once given', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('giving is exact: this gym, this member, this pack', rpcs.length === 1 && rpcs[0].path === 'owner_give_class_pack' && JSON.stringify(rpcs[0].body) === JSON.stringify({ p_gym_id: GYM, p_user_id: 'u-bob', p_pack_type_id: 'k1' }));
  await c.has('a confirmation names the member and the pack', page.getByText('Gave Bob Brown the 10 class pack.'));

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
