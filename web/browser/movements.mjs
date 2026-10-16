// Browser gate: the Movements page (the gym's movement list with video, cue and Rx/Scaled/Foundations wording), signed in as an
// owner, at phone and desktop width. Supabase is mocked. Checks the list, search, add, edit, bad input refused with nothing written,
// switching off, filling from the standard list, and that the workout builder offers the gym's movements.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const push = { id: 'mv-push', name: 'Sled Push', video_url: 'https://example.test/sled', cue: 'Drive through the legs', default_tracking: 'distance', is_active: true };
const bar = { id: 'mv-bar', name: 'Gym Special Carry', video_url: null, cue: null, default_tracking: 'time', is_active: true };
const old = { id: 'mv-old', name: 'Old Move', video_url: null, cue: null, default_tracking: 'strength', is_active: false };
const levels = [{ movement_id: 'mv-push', level: 'scaled', prescription: { display: '2 x 20 m' } }];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    const table = ['movements', 'movement_levels'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (table === 'movements' && method === 'POST' && !Array.isArray(body)) return reply(route, [{ id: 'mv-new' }]);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/movements')) return reply(route, [bar, push, old]);
    if (path.endsWith('/movement_levels')) return reply(route, levels);
    return false;
  });
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await page.goto(`${base}/movements`);
  await c.has('heading', page.getByRole('heading', { name: 'Movements', level: 1 }));
  await c.has('facts for a movement', page.getByText('Distance · Scaled · Video'));
  await c.has('the cue', page.getByText('Drive through the legs'));
  c.ok('switched-off ones are hidden', (await page.getByText('Old Move').count()) === 0);
  await c.has('it offers the standard list', page.getByRole('button', { name: /^Add the \d+ standard movements$/ }));

  await page.getByLabel('Search').fill('sled');
  c.ok('search narrows the list', (await page.getByText('Gym Special Carry').count()) === 0 && (await page.getByText('Sled Push').count()) === 1);
  await page.getByLabel('Search').fill('');

  await page.getByRole('button', { name: 'Edit Sled Push' }).click();
  c.ok('the form is filled in', (await dialog.getByLabel('Scaled').inputValue()) === '2 x 20 m' && (await dialog.getByLabel('Video link').inputValue()) === 'https://example.test/sled');
  await dialog.getByLabel('Video link').fill('http://nope.test');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('a link that is not https is refused', dialog.getByRole('alert').getByText('A video link must start with https://.'));
  c.ok('and nothing was written', writes.length === 0);
  await dialog.getByLabel('Video link').fill('https://example.test/sled2');
  await dialog.getByLabel('Scaled').fill('');
  await dialog.getByLabel('Rx').fill('4 x 20 m');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'detached' });
  c.ok('saved and closed', true);
  c.ok('the movement was updated with only its fields', writes.some((w) => w.table === 'movements' && w.method === 'PATCH' && w.query.id === 'eq.mv-push' && w.body.video_url === 'https://example.test/sled2' && w.body.cue === 'Drive through the legs'));
  c.ok('the emptied level was removed', writes.some((w) => w.table === 'movement_levels' && w.method === 'DELETE' && w.query.level === 'eq.scaled'));
  c.ok('the new level was added', writes.some((w) => w.table === 'movement_levels' && w.method === 'POST' && w.body.level === 'rx' && w.body.prescription.display === '4 x 20 m'));

  await page.getByRole('button', { name: 'Add movement' }).click();
  await dialog.getByLabel('Name').fill('sled push');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('a duplicate name is refused', dialog.getByRole('alert').getByText('That movement is already in your list.'));
  await dialog.getByLabel('Name').fill('Tyre Flip');
  await dialog.getByLabel('Coaching cue').fill('Hips low');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await dialog.waitFor({ state: 'detached' });
  c.ok('added and closed', true);
  c.ok('the new movement was inserted for this gym', writes.some((w) => w.table === 'movements' && w.method === 'POST' && w.body.name === 'Tyre Flip' && w.body.cue === 'Hips low' && typeof w.body.gym_id === 'string'));

  const before = writes.length;
  await page.getByRole('button', { name: 'Switch off Gym Special Carry' }).click();
  await page.waitForTimeout(300);
  c.ok('switching off changes only is_active', writes.slice(before).some((w) => w.table === 'movements' && w.method === 'PATCH' && w.query.id === 'eq.mv-bar' && JSON.stringify(w.body) === '{"is_active":false}'));

  await page.getByRole('button', { name: /^Add the \d+ standard movements$/ }).click();
  await page.waitForTimeout(500);
  c.ok('the standard list is added without overwriting', writes.some((w) => w.table === 'movements' && w.method === 'POST' && Array.isArray(w.body) && w.body.length === 100 && w.query.on_conflict === 'gym_id,key'));
  c.ok('and does not include a name the gym has', !writes.some((w) => Array.isArray(w.body) && w.body.some((r) => r.name === 'Sled Push')));

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  c.ok('no sideways scroll', sideways);
  c.ok('no page errors', errors.length === 0);
  if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
  if (!c.report(`movements ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
