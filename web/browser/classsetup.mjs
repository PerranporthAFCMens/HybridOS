// Browser gate: Class setup (class types and what each needs), signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Checks what is on screen and the exact requests for every kind of
// change: edit (add, change a quantity, remove a requirement, without ever deleting everything first),
// create, switch off and on, and that nothing is written when the form is refused.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const CAP = 'cap-spin';
const STUDIO = 'res-studio';
const BIKE = 'res-bike';
const SLED = 'res-sled';
const spin = { id: 'type-spin', name: 'Spin', description: 'Indoor cycling', difficulty_level: 'beginner', duration_minutes: 45, default_capacity: 12, drop_in_price_pence: 800, is_active: true };
const yoga = { id: 'type-yoga', name: 'Old Yoga', description: null, difficulty_level: 'all_levels', duration_minutes: 60, default_capacity: 20, drop_in_price_pence: null, is_active: false };
const requirements = [
  { id: 'rq-cap', class_type_id: 'type-spin', capability_id: CAP, resource_id: null, quantity: 1 },
  { id: 'rq-studio', class_type_id: 'type-spin', capability_id: null, resource_id: STUDIO, quantity: 1 },
  { id: 'rq-bike', class_type_id: 'type-spin', capability_id: null, resource_id: BIKE, quantity: 8 },
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const p = e.parentElement;
    if (p && cs.position !== 'fixed' && cs.position !== 'absolute' && !e.closest('.menu-btn')) {
      const pr = p.getBoundingClientRect();
      if (getComputedStyle(p).display !== 'contents' && (r.right > pr.right + 1 || r.left < pr.left - 1)) problems.push(`${name} sticks out of its parent`);
    }
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
    const table = ['class_types', 'service_requirements'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (table === 'class_types' && method === 'POST') return reply(route, [{ id: 'type-new' }]);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/class_types')) return reply(route, [spin, yoga]);
    if (path.endsWith('/service_requirements')) return reply(route, url.searchParams.get('class_type_id') === 'eq.type-new' ? [] : requirements);
    if (path.endsWith('/capabilities')) return reply(route, [{ id: CAP, name: 'Spin instructor', description: null }]);
    if (path.endsWith('/resources')) return reply(route, [{ id: STUDIO, name: 'Studio A', resource_type: 'room', capacity: 20 }, { id: BIKE, name: 'Spin bike', resource_type: 'equipment', capacity: 12 }, { id: SLED, name: 'Sled', resource_type: 'equipment', capacity: null }]);
    return false;
  });

  await page.goto(`${base}/next/#/class-setup`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('heading', page.getByRole('heading', { name: 'Class setup', level: 1 }));
  await c.has('class type card', page.getByRole('heading', { name: 'Spin', level: 3 }));
  await c.has('facts', page.getByText('45 min · 12 places · £8.00 drop-in'));
  await c.has('what it needs, with quantity', page.getByText('Qualification: Spin instructor · Needs: Studio A, 8 × Spin bike'));
  c.ok('switched-off type hidden until asked', (await page.getByRole('heading', { name: 'Old Yoga' }).count()) === 0);
  await page.getByRole('button', { name: /Show switched-off class types \(1\)/ }).click();
  await c.has('switched-off type shown', page.getByRole('heading', { name: 'Old Yoga', level: 3 }));
  await c.has('upgrade only wording', page.getByText('60 min · 20 places · upgrade only'));
  c.ok('layout (list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-setup-${name}.png`, fullPage: true });

  // Edit Spin: prefilled; refused when invalid (nothing written)
  await page.locator('.type-card', { hasText: 'Spin' }).first().getByRole('button', { name: 'Edit' }).click();
  await c.has('edit form', dialog.getByText('Edit class type').first());
  c.ok('prefilled', (await dialog.getByLabel('Name').inputValue()) === 'Spin' && (await dialog.getByLabel('Default duration (minutes)').inputValue()) === '45' && (await dialog.getByLabel('Drop-in price (£)').inputValue()) === '8.00' && (await dialog.getByLabel('Level').inputValue()) === 'beginner');
  c.ok('requirements ticked with their quantity', (await dialog.getByLabel(/^Spin instructor/).isChecked()) && (await dialog.getByLabel(/^Studio A ·/).isChecked()) && (await dialog.getByLabel('How many Spin bike').inputValue()) === '8' && !(await dialog.getByLabel(/^Sled ·/).isChecked()));
  c.ok('edit form layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-setup-form-${name}.png` });
  await dialog.getByLabel('Name').fill('  ');
  await dialog.getByRole('button', { name: 'Save class type' }).click();
  await c.has('blank name refused', dialog.getByText('Enter a class name.'));
  await dialog.getByLabel('Name').fill('Spin');
  await dialog.getByLabel('How many Spin bike').fill('0');
  await dialog.getByRole('button', { name: 'Save class type' }).click();
  await c.has('bad quantity refused', dialog.getByText(/How many of each room or piece of equipment must be a whole number/));
  c.ok('nothing written yet', writes.length === 0);

  // A real edit: bikes 8 -> 12, add the sled (2), drop the qualification
  await dialog.getByLabel('How many Spin bike').fill('12');
  await dialog.getByLabel(/^Sled ·/).click();
  await dialog.getByLabel('How many Sled').fill('2');
  await dialog.getByLabel(/^Spin instructor/).click();
  await c.has('summary updates', dialog.getByText('Needs: Studio A, 12 × Spin bike, 2 × Sled'));
  await dialog.getByLabel('Default capacity').fill('14');
  await dialog.getByRole('button', { name: 'Save class type' }).click();
  c.ok('form closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const typeWrite = writes.find((w) => w.table === 'class_types' && w.method === 'PATCH');
  c.ok('class type update scoped to this type and gym', typeWrite && typeWrite.query.id === 'eq.type-spin' && typeWrite.query.gym_id === `eq.${GYM}` && JSON.stringify(typeWrite.body) === JSON.stringify({ name: 'Spin', description: 'Indoor cycling', difficulty_level: 'beginner', duration_minutes: 45, default_capacity: 14, drop_in_price_pence: 800 }));
  const inserted = writes.find((w) => w.table === 'service_requirements' && w.method === 'POST');
  c.ok('only the new requirement is added', inserted && JSON.stringify(inserted.body) === JSON.stringify([{ gym_id: GYM, class_type_id: 'type-spin', capability_id: null, resource_id: SLED, quantity: 2 }]));
  const updated = writes.find((w) => w.table === 'service_requirements' && w.method === 'PATCH');
  c.ok('only the changed quantity is updated', updated && updated.query.id === 'eq.rq-bike' && updated.query.gym_id === `eq.${GYM}` && JSON.stringify(updated.body) === JSON.stringify({ quantity: 12 }));
  const removed = writes.find((w) => w.table === 'service_requirements' && w.method === 'DELETE');
  c.ok('only the unticked qualification is removed, never everything', removed && removed.query.gym_id === `eq.${GYM}` && removed.query.id === 'in.(rq-cap)' && !('class_type_id' in removed.query));
  c.ok('and it is the last thing done', writes.findIndex((w) => w.method === 'DELETE') === writes.length - 1);

  // Create a new class type
  writes.length = 0;
  await page.getByRole('button', { name: 'New class type' }).click();
  await dialog.getByLabel('Name').fill('Sled push');
  await dialog.getByLabel('Level').selectOption('advanced');
  await dialog.getByLabel('Default duration (minutes)').fill('30');
  await dialog.getByLabel('Default capacity').fill('8');
  await dialog.getByLabel('Drop-in price (£)').fill('');
  await dialog.getByLabel(/^Sled ·/).click();
  await dialog.getByLabel('How many Sled').fill('4');
  await dialog.getByRole('button', { name: 'Save class type' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const created = writes.find((w) => w.table === 'class_types' && w.method === 'POST');
  c.ok('create: exact class type', created && JSON.stringify(created.body) === JSON.stringify({ gym_id: GYM, is_active: true, name: 'Sled push', description: null, difficulty_level: 'advanced', duration_minutes: 30, default_capacity: 8, drop_in_price_pence: null }));
  const createdReq = writes.find((w) => w.table === 'service_requirements' && w.method === 'POST');
  c.ok('create: its requirement points at the new type', createdReq && JSON.stringify(createdReq.body) === JSON.stringify([{ gym_id: GYM, class_type_id: 'type-new', capability_id: null, resource_id: SLED, quantity: 4 }]));
  c.ok('create: nothing deleted', !writes.some((w) => w.method === 'DELETE'));

  // Switch a class type off, and an old one back on
  writes.length = 0;
  await page.locator('.type-card', { hasText: 'Spin' }).first().getByRole('button', { name: 'Switch off' }).click();
  await page.waitForTimeout(300);
  const off = writes.find((w) => w.table === 'class_types');
  c.ok('switch off writes only is_active, for this type and gym', off && off.method === 'PATCH' && off.query.id === 'eq.type-spin' && off.query.gym_id === `eq.${GYM}` && JSON.stringify(off.body) === JSON.stringify({ is_active: false }));
  await page.locator('.type-card', { hasText: 'Old Yoga' }).getByRole('button', { name: 'Switch on' }).click();
  await page.waitForTimeout(300);
  const on = writes.filter((w) => w.table === 'class_types').at(-1);
  c.ok('switch on', on && on.query.id === 'eq.type-yoga' && JSON.stringify(on.body) === JSON.stringify({ is_active: true }));
  c.ok('link to rooms and equipment', (await page.getByRole('link', { name: 'Open rooms and equipment' }).getAttribute('href')) === '#/rooms');
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
