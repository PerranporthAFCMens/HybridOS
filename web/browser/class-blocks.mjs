// Browser gate: class blocks. The coach makes a block (a named run of weeks), chooses which classes are in it (one class, or
// several a week), and changes or deletes it. A class's workout shows which block and week it is in. Signed in as an owner, at phone
// and desktop width. Supabase is mocked at the network layer. Checks the exact request of every action.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// The gym's day is UK time; the machine running the check may be on UTC, a different day for the hour after 23:00 in summer.
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
const todayKey = keyOf(today);
const dayKey = (offset) => keyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
const londonFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const londonInstant = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(londonFormat.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    guess += wall - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return new Date(guess);
};
const gymTime = (key, hhmm) => londonInstant(key, hhmm).toISOString();
// The gym's own "today" (UK time), which is what a block starts on.
const gymToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const row = (id, name, startsAt, endsAt) => ({ session_id: id, name, starts_at: startsAt, ends_at: endsAt, booked_count: 3, capacity: 12, spaces_left: 9, is_cancelled: false, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_plan_names: [] });
const sessions = [
  row('s1', 'Morning HIIT', gymTime(todayKey, '09:00'), gymTime(todayKey, '10:00')),
  row('s2', 'Evening Hybrid', gymTime(todayKey, '18:00'), gymTime(todayKey, '19:00')),
  row('s3', 'Midweek Hybrid', gymTime(dayKey(3), '18:00'), gymTime(dayKey(3), '19:00')),
  row('s4', 'Hybrid Monday', gymTime(dayKey(8), '18:00'), gymTime(dayKey(8), '19:00')),
  row('s5', 'Hybrid Tuesday', gymTime(dayKey(9), '18:00'), gymTime(dayKey(9), '19:00')),
  row('s6', 'Far away class', gymTime(dayKey(60), '18:00'), gymTime(dayKey(60), '19:00')),
];
const snapshot = { blocks: [{ position: 0, title: 'Workout', activities: [{ position: 0, activity_name: 'Back squat', tracking_type: 'strength', prescription: { display: '3 sets: 8 × 60 kg' } }] }] };

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
  let blocks = [{ id: 'blk1', name: 'Hybrid Uppers', starts_on: gymToday, weeks: 6 }];
  let inBlock = ['s1', 's2'];
  let workout = { session_id: 's1', title: 'Push day', template_id: null, workout_snapshot: snapshot, published_at: '2026-10-12T09:00:00Z' };
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body, select }) => {
    if (path.endsWith('/rpc/get_class_calendar')) {
      const from = new Date(body.p_from).getTime();
      const to = new Date(body.p_to).getTime();
      return reply(route, sessions.filter((s) => new Date(s.starts_at).getTime() >= from && new Date(s.starts_at).getTime() < to));
    }
    const table = ['class_blocks', 'class_block_sessions', 'class_session_workouts'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (table === 'class_blocks' && method === 'POST') { blocks = [{ id: 'blk2', name: body.name, starts_on: body.starts_on, weeks: body.weeks }, ...blocks]; return reply(route, [{ id: 'blk2' }]); }
      if (table === 'class_blocks' && method === 'PATCH') { blocks = blocks.map((b) => (`eq.${b.id}` === url.searchParams.get('id') ? { ...b, name: body.name, starts_on: body.starts_on, weeks: body.weeks } : b)); }
      if (table === 'class_blocks' && method === 'DELETE') blocks = blocks.filter((b) => `eq.${b.id}` !== url.searchParams.get('id'));
      if (table === 'class_block_sessions' && method === 'POST') inBlock = [...inBlock, ...body.map((b) => b.session_id)];
      if (table === 'class_block_sessions' && method === 'DELETE') { const out = (url.searchParams.get('session_id') ?? '').replace(/^in\.\(|\)$/g, '').split(','); inBlock = inBlock.filter((s) => !out.includes(s)); }
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/class_blocks')) return reply(route, blocks);
    if (path.endsWith('/class_block_sessions')) {
      if (select.includes('class_blocks')) return reply(route, inBlock.includes('s1') ? [{ session_id: 's1', class_blocks: blocks[blocks.length - 1] ?? null }] : []);
      return reply(route, inBlock.map((s) => ({ session_id: s })));
    }
    if (path.endsWith('/class_session_workouts')) {
      if (select.includes('workout_snapshot')) return reply(route, url.searchParams.get('session_id') === 'eq.s1' ? [workout] : []);
      return reply(route, [{ session_id: 's1', title: 'Push day', published_at: workout.published_at }, { session_id: 's4', title: 'Legs', published_at: null }]);
    }
    if (path.endsWith('/workout_templates')) return reply(route, []);
    if (path.endsWith('/class_bookings')) return reply(route, []);
    if (path.endsWith('/class_session_staff')) return reply(route, []);
    return false;
  });

  await page.goto(`${base}/classes`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('heading', page.getByRole('heading', { name: 'Classes', level: 1 }));

  // The list of blocks
  await page.getByRole('button', { name: 'Blocks', exact: true }).click();
  await c.has('Blocks opens', dialog.getByText('A block is a run of weeks'));
  await c.has('it lists the block with its week today', dialog.getByText('Week 1 of 6'));
  c.ok('and its dates', (await dialog.getByText(/6 weeks/).count()) === 1);
  c.ok('looking wrote nothing', writes.length === 0);
  c.ok('layout (blocks)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-blocks-list-${name}.png`, fullPage: true });

  // Make a new block: it must have a name and 1 to 52 whole weeks
  await dialog.getByRole('button', { name: 'New block' }).click();
  await dialog.getByRole('button', { name: 'Create block' }).click();
  await c.has('a name is needed', dialog.getByText('Give the block a name, like Hybrid Uppers.'));
  await dialog.getByLabel('Block name').fill('Lower Block');
  await dialog.getByLabel('Number of weeks').fill('0');
  await dialog.getByRole('button', { name: 'Create block' }).click();
  await c.has('weeks must be 1 to 52', dialog.getByText('Choose between 1 and 52 weeks.'));
  c.ok('nothing written for refused forms', writes.length === 0);
  await dialog.getByLabel('Number of weeks').fill('4');
  await dialog.getByRole('button', { name: 'Create block' }).click();
  await c.has('the new block opens', dialog.getByRole('heading', { name: 'Lower Block' }));
  const made = writes.find((w) => w.table === 'class_blocks' && w.method === 'POST');
  c.ok('create is exact: this gym, name, start day, weeks, who', made && made.body.gym_id === GYM && made.body.name === 'Lower Block' && made.body.weeks === 4 && made.body.starts_on === gymToday && made.body.created_by === USER);

  // Back to the first block and choose its classes
  await dialog.getByRole('button', { name: 'Back to blocks' }).click();
  await dialog.getByRole('button', { name: 'Open Hybrid Uppers' }).click();
  await c.has('the block shows its weeks', dialog.getByText('Week 1', { exact: true }));
  c.ok('and the classes inside them, grouped by week, with empty weeks kept', (await dialog.getByText('No classes this week.').count()) === 4 && (await dialog.getByRole('checkbox').count()) === 5);
  c.ok('a class outside the block\'s weeks is not offered', (await dialog.getByText(/Far away class/).count()) === 0);
  c.ok('the classes already in the block are ticked', (await dialog.getByRole('checkbox', { name: /^Morning HIIT/ }).isChecked()) && (await dialog.getByRole('checkbox', { name: /^Evening Hybrid/ }).isChecked()) && !(await dialog.getByRole('checkbox', { name: /^Midweek Hybrid/ }).isChecked()));
  c.ok('each class shows where its workout stands', (await dialog.getByText('Available: Push day').count()) === 1 && (await dialog.getByText('Draft: Legs').count()) === 1 && (await dialog.getByText('No workout yet').count()) === 3);
  c.ok('saving is not offered until something changes', await dialog.getByRole('button', { name: 'Classes saved' }).isDisabled());
  c.ok('layout (block)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-blocks-detail-${name}.png`, fullPage: true });
  await dialog.getByRole('checkbox', { name: /^Midweek Hybrid/ }).check();
  await dialog.getByRole('checkbox', { name: /^Evening Hybrid/ }).uncheck();
  await dialog.getByRole('button', { name: 'Save classes (1 to add, 1 to remove)' }).click();
  await c.has('saved, and says how many classes are in', dialog.getByText('Saved. 2 classes are in this block.'));
  const del = writes.find((w) => w.table === 'class_block_sessions' && w.method === 'DELETE');
  const ins = writes.find((w) => w.table === 'class_block_sessions' && w.method === 'POST');
  c.ok('the removal is exact: this block, that class only', del && del.query.block_id === 'eq.blk1' && del.query.session_id === 'in.(s2)');
  c.ok('the addition is exact: only the new class, with the gym', ins && ins.body.length === 1 && ins.body[0].session_id === 's3' && ins.body[0].block_id === 'blk1' && ins.body[0].gym_id === GYM);
  await dialog.getByRole('button', { name: 'Tick every class' }).click();
  await dialog.getByRole('button', { name: /^Save classes \(3 to add, 0 to remove\)$/ }).click();
  await c.has('every class can go in (one class, or several a week)', dialog.getByText('Saved. 5 classes are in this block.'));

  // Change the block's details
  writes.length = 0;
  await dialog.getByLabel('Block name', { exact: true }).fill('Hybrid Uppers 2');
  await dialog.getByRole('button', { name: 'Save block details' }).click();
  await c.has('details saved', dialog.getByText(/Block saved\./));
  const upd = writes.find((w) => w.table === 'class_blocks' && w.method === 'PATCH');
  c.ok('the update is exact: this block only', upd && upd.query.id === 'eq.blk1' && upd.body.name === 'Hybrid Uppers 2' && upd.body.weeks === 6 && upd.body.starts_on === gymToday);

  // Delete asks first
  writes.length = 0;
  await dialog.getByRole('button', { name: 'Delete this block' }).click();
  c.ok('deleting asks first and writes nothing yet', writes.length === 0 && (await dialog.getByRole('button', { name: 'Yes, delete it' }).count()) === 1);
  await dialog.getByRole('button', { name: 'Keep' }).click();
  c.ok('keeping leaves it', writes.length === 0 && (await dialog.getByRole('button', { name: 'Delete this block' }).count()) === 1);
  await dialog.getByRole('button', { name: 'Delete this block' }).click();
  await dialog.getByRole('button', { name: 'Yes, delete it' }).click();
  await c.has('back to the list', dialog.getByText('A block is a run of weeks'));
  const gone = writes.find((w) => w.table === 'class_blocks' && w.method === 'DELETE');
  c.ok('the delete is exact: this block only', gone && gone.query.id === 'eq.blk1' && writes.length === 1);
  await dialog.getByRole('button', { name: 'Close' }).click();

  // A class's workout: the block and week it is in
  writes.length = 0;
  inBlock = ['s1'];
  blocks = [{ id: 'blk1', name: 'Hybrid Uppers', starts_on: gymToday, weeks: 6 }];
  await page.reload();
  if (name === 'desktop') {
    await page.locator('.cal-col').nth(6).waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Day', exact: true }).click();
  }
  await page.getByRole('button', { name: /^Morning HIIT/ }).click();
  const panel = dialog.getByRole('region', { name: 'Class workout' });
  await c.has('the class says which block and week it is in', panel.getByText('Hybrid Uppers · week 1 of 6'));
  c.ok('layout (class workout with its block)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-blocks-class-${name}.png`, fullPage: true });
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
