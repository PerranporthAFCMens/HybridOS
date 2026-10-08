// Browser gate: Rooms and equipment (rooms, equipment, qualifications), signed in as an owner, at phone and
// desktop width. Supabase is mocked at the network layer. Checks what is on screen and the exact requests:
// add, edit (only the form's fields), switch off and on, duplicates and bad input refused with nothing written.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const studio = { id: 'res-studio', name: 'Studio A', resource_type: 'room', capacity: 20, allow_overlap: false, notes: 'Mirrors', is_active: true };
const bike = { id: 'res-bike', name: 'Spin bike', resource_type: 'equipment', capacity: null, allow_overlap: true, notes: null, is_active: true };
const old = { id: 'res-old', name: 'Old gym floor', resource_type: 'area', capacity: 5, allow_overlap: false, notes: null, is_active: false };
const spinQual = { id: 'cap-spin', name: 'Spin instructor', description: 'Level 2', is_active: true };

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
    const table = ['resources', 'capabilities'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/resources')) return reply(route, [studio, bike, old]);
    if (path.endsWith('/capabilities')) return reply(route, [spinQual, { id: 'cap-pt', name: 'Personal trainer', description: null, is_active: false }]);
    if (path.endsWith('/service_requirements')) return reply(route, [{ class_type_id: 'type-spin', capability_id: 'cap-spin', resource_id: null }, { class_type_id: 'type-spin', capability_id: null, resource_id: 'res-studio' }]);
    if (path.endsWith('/class_types')) return reply(route, [{ id: 'type-spin', name: 'Spin', is_active: true }]);
    return false;
  });

  await page.goto(`${base}/next/#/rooms`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('heading', page.getByRole('heading', { name: 'Rooms and equipment', level: 1 }));
  await c.has('room facts', page.getByText('Room · max 20 people · one class at a time'));
  await c.has('equipment facts', page.getByText('Equipment · no occupancy limit · can be shared'));
  await c.has('used by', page.getByText('Needed by: Spin').first());
  await c.has('qualification shown', page.getByText('Spin instructor').first());
  c.ok('switched-off hidden until asked', (await page.getByText('Old gym floor').count()) === 0);
  await page.getByRole('button', { name: /Show switched-off items \(2\)/ }).click();
  await c.has('switched-off shown', page.getByText('Old gym floor'));
  c.ok('layout (list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/rooms-${name}.png`, fullPage: true });

  // Edit Studio A: refused cases first (nothing written)
  await page.getByRole('button', { name: 'Edit Studio A' }).click();
  c.ok('prefilled', (await dialog.getByLabel('Name').inputValue()) === 'Studio A' && (await dialog.getByLabel('Max occupancy').inputValue()) === '20' && (await dialog.getByLabel('Notes').inputValue()) === 'Mirrors');
  c.ok('edit form layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/rooms-form-${name}.png` });
  await dialog.getByLabel('Name').fill('spin BIKE');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('duplicate name refused', dialog.getByText(/already a room or piece of equipment called/));
  await dialog.getByLabel('Name').fill('Studio A');
  await dialog.getByLabel('Max occupancy').fill('0');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('bad occupancy refused', dialog.getByText(/Max occupancy must be a whole number/));
  c.ok('nothing written yet', writes.length === 0);
  await dialog.getByLabel('Max occupancy').fill('24');
  await dialog.getByLabel('Double booking').selectOption('shared');
  await dialog.getByRole('button', { name: 'Save' }).click();
  c.ok('form closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const edit = writes.find((w) => w.table === 'resources' && w.method === 'PATCH');
  c.ok('edit writes only the form fields, scoped to this room and gym', edit && edit.query.id === 'eq.res-studio' && edit.query.gym_id === `eq.${GYM}` && JSON.stringify(edit.body) === JSON.stringify({ name: 'Studio A', resource_type: 'room', capacity: 24, allow_overlap: true, notes: 'Mirrors' }));

  // Add a piece of equipment with no limit
  writes.length = 0;
  await page.getByRole('button', { name: 'Add room or equipment' }).click();
  await dialog.getByLabel('Name').fill('Sled');
  await dialog.getByLabel('Type').selectOption('equipment');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const added = writes.find((w) => w.table === 'resources' && w.method === 'POST');
  c.ok('add: exact row', added && JSON.stringify(added.body) === JSON.stringify({ gym_id: GYM, is_bookable: true, is_active: true, name: 'Sled', resource_type: 'equipment', capacity: null, allow_overlap: false, notes: null }));

  // Switch off and on
  writes.length = 0;
  await page.getByRole('button', { name: 'Switch off Spin bike' }).click();
  await page.waitForTimeout(300);
  const off = writes.find((w) => w.table === 'resources');
  c.ok('switch off writes only is_active, scoped', off && off.method === 'PATCH' && off.query.id === 'eq.res-bike' && off.query.gym_id === `eq.${GYM}` && JSON.stringify(off.body) === JSON.stringify({ is_active: false }));
  await page.getByRole('button', { name: 'Switch on Old gym floor' }).click();
  await page.waitForTimeout(300);
  const on = writes.filter((w) => w.table === 'resources').at(-1);
  c.ok('switch on', on && on.query.id === 'eq.res-old' && JSON.stringify(on.body) === JSON.stringify({ is_active: true }));

  // Qualifications
  writes.length = 0;
  await page.getByRole('button', { name: 'Add qualification' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('blank qualification refused', dialog.getByText('Enter a name.'));
  await dialog.getByLabel('Name').fill('spin instructor');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('duplicate qualification refused', dialog.getByText(/already a qualification called/));
  c.ok('nothing written for refused qualifications', writes.length === 0);
  await dialog.getByLabel('Name').fill('Boxing coach');
  await dialog.getByLabel('Description').fill('Level 1');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const q = writes.find((w) => w.table === 'capabilities' && w.method === 'POST');
  c.ok('qualification add: exact row', q && JSON.stringify(q.body) === JSON.stringify({ gym_id: GYM, is_active: true, name: 'Boxing coach', description: 'Level 1' }));
  writes.length = 0;
  await page.getByRole('button', { name: 'Edit Spin instructor' }).click();
  await dialog.getByLabel('Description').fill('');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const qe = writes.find((w) => w.table === 'capabilities' && w.method === 'PATCH');
  c.ok('qualification edit scoped', qe && qe.query.id === 'eq.cap-spin' && qe.query.gym_id === `eq.${GYM}` && JSON.stringify(qe.body) === JSON.stringify({ name: 'Spin instructor', description: null }));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
