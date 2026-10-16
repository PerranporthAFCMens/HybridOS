// Browser gate: the Programmes page. The coach makes a programme (a block), then picks classes by name and days, sees where the
// workouts and tests stand, and deletes it. Signed in as an owner, at phone and desktop width. Supabase is mocked at the network
// layer. Checks the exact request of every action.
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
// Morning HIIT runs on two weekdays (s1 and s2 on the same day, a week apart; s3 on another day). s4 is Evening Hybrid and is already in another programme.
const sessions = [
  row('s1', 'Morning HIIT', gymTime(todayKey, '09:00'), gymTime(todayKey, '10:00')),
  row('s2', 'Morning HIIT', gymTime(dayKey(7), '09:00'), gymTime(dayKey(7), '10:00')),
  row('s3', 'Morning HIIT', gymTime(dayKey(8), '09:00'), gymTime(dayKey(8), '10:00')),
  row('s4', 'Evening Hybrid', gymTime(todayKey, '18:00'), gymTime(todayKey, '19:00')),
  row('s6', 'Far away class', gymTime(dayKey(60), '18:00'), gymTime(dayKey(60), '19:00')),
];

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
  const other = { id: 'blk9', name: 'Summer Cut', starts_on: gymToday, weeks: 6 };
  let blocks = [{ id: 'blk1', name: 'Hybrid Uppers', starts_on: gymToday, weeks: 6 }, other];
  let inBlock = []; // classes in Hybrid Uppers
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body, select }) => {
    if (path.endsWith('/rpc/get_class_calendar')) {
      const from = new Date(body.p_from).getTime();
      const to = new Date(body.p_to).getTime();
      return reply(route, sessions.filter((s) => new Date(s.starts_at).getTime() >= from && new Date(s.starts_at).getTime() < to));
    }
    const table = ['class_blocks', 'class_block_sessions', 'class_session_workouts', 'workout_template_blocks', 'workout_template_activities'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (table === 'class_blocks' && method === 'POST') { blocks = [{ id: 'blk2', name: body.name, starts_on: body.starts_on, weeks: body.weeks }, ...blocks]; return reply(route, [{ id: 'blk2' }]); }
      if (table === 'class_blocks' && method === 'PATCH') { blocks = blocks.map((b) => (`eq.${b.id}` === url.searchParams.get('id') ? { ...b, name: body.name, starts_on: body.starts_on, weeks: body.weeks } : b)); }
      if (table === 'class_blocks' && method === 'DELETE') blocks = blocks.filter((b) => `eq.${b.id}` !== url.searchParams.get('id'));
      if (table === 'class_block_sessions' && method === 'POST') inBlock = [...inBlock, ...body.map((b) => b.session_id)];
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/class_blocks')) return reply(route, blocks);
    if (path.endsWith('/class_block_sessions')) {
      if (select.includes('class_blocks')) return reply(route, [...inBlock.map((s) => ({ session_id: s, class_blocks: blocks[0] })), { session_id: 's4', class_blocks: other }]);
      return reply(route, inBlock.map((s) => ({ session_id: s })));
    }
    if (path.endsWith('/class_session_workouts')) return reply(route, [{ session_id: 's1', title: 'Push day', published_at: '2026-10-12T09:00:00Z' }]);
    if (path.endsWith('/block_benchmarks')) return reply(route, []);
    if (path.endsWith('/movements')) return reply(route, []);
    if (path.endsWith('/workout_templates')) return reply(route, [{ id: 't-leg', title: 'Leg Day', description: 'Heavy legs', workout_type: 'strength', focus_tags: ['Legs'], estimated_minutes: 50, visibility: 'private' }]);
    if (path.endsWith('/workout_template_blocks') || path.endsWith('/workout_template_activities')) return reply(route, []);
    if (path.endsWith('/class_bookings')) return reply(route, []);
    if (path.endsWith('/class_session_staff')) return reply(route, []);
    return false;
  });

  await page.goto(`${base}/programmes`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Programmes', level: 1 }));
  await c.has('the programmes are listed with the week they are in', page.getByText('Week 1 of 6').first());
  c.ok('menu has a Programmes tab and calls the timetable Timetable', (await page.getByRole('link', { name: 'Programmes', exact: true }).count()) > 0 && (await page.getByRole('link', { name: 'Timetable', exact: true }).count()) > 0);
  c.ok('looking wrote nothing', writes.length === 0);
  c.ok('layout (list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/programmes-list-${name}.png`, fullPage: true });

  // Step 1: a new programme needs a name and 1 to 52 weeks
  await page.getByRole('button', { name: 'New programme' }).click();
  await page.getByRole('button', { name: 'Create programme' }).click();
  await c.has('a name is needed', page.getByText('Give the block a name, like Hybrid Uppers.'));
  await page.getByLabel('Programme name').fill('Lower Block');
  await page.getByLabel('Number of weeks').fill('0');
  await page.getByRole('button', { name: 'Create programme' }).click();
  await c.has('weeks must be 1 to 52', page.getByText('Choose between 1 and 52 weeks.'));
  c.ok('nothing written for refused forms', writes.length === 0);
  await page.getByLabel('Number of weeks').fill('4');
  await page.getByRole('button', { name: 'Create programme' }).click();
  await c.has('the new programme opens', page.getByRole('heading', { name: 'Lower Block', level: 1 }));
  const made = writes.find((w) => w.table === 'class_blocks' && w.method === 'POST');
  c.ok('create is exact: this gym, name, start day, weeks, who', made && made.body.gym_id === GYM && made.body.name === 'Lower Block' && made.body.weeks === 4 && made.body.starts_on === gymToday && made.body.created_by === USER);
  await page.getByRole('button', { name: 'Back to programmes' }).click();

  // The page for a programme: four steps, you are at step 2
  await page.getByRole('button', { name: 'Open Hybrid Uppers' }).click();
  const steps = page.getByRole('list', { name: 'Steps' });
  await c.has('four steps are shown', steps.getByText('2 Classes', { exact: true }));
  c.ok('and it says where you are: step 2', (await steps.getByText('● You are here').count()) === 1 && (await steps.locator('li').count()) === 4);
  c.ok('a class outside these weeks is not offered', (await page.getByRole('button', { name: 'Far away class' }).count()) === 0);

  // Step 2: schedule a new class from here (opens the timetable's own form, repeating for the programme's weeks)
  writes.length = 0;
  await page.getByRole('button', { name: 'Schedule a new class' }).click();
  const sched = page.getByRole('dialog');
  await c.has('the add-class form opens here', sched.getByLabel('Class name'));
  c.ok('it starts on the programme start day, repeating weekly for its 6 weeks', (await sched.getByLabel('Date').inputValue()) === gymToday && (await sched.getByLabel('Repeat weekly').isChecked()) && (await sched.getByLabel('Number of weeks').inputValue()) === '6');
  c.ok('layout (schedule form)', (await page.evaluate(layoutProblems)).length === 0);
  await sched.getByRole('button', { name: 'Close' }).first().click();
  c.ok('closing writes nothing', (await sched.count()) === 0 && writes.length === 0);

  // Step 2: pick by name and days
  writes.length = 0;
  await page.getByRole('button', { name: 'Morning HIIT', exact: true }).click();
  await c.has('its usual days are ticked and it counts the matches', page.getByText('3 classes match'));
  c.ok('the days it runs on are pressed', (await page.getByRole('group', { name: 'On which days' }).getByRole('button', { pressed: true }).count()) === 2);
  await page.getByRole('group', { name: 'On which days' }).getByRole('button', { pressed: true }).last().click();
  await c.has('un-ticking a day changes the count', page.getByText(/[12] classes? match/));
  await page.getByRole('group', { name: 'On which days' }).getByRole('button', { pressed: true }).last().click();
  c.ok('nothing is written until Add is pressed', writes.length === 0);
  await page.getByRole('button', { name: 'Evening Hybrid', exact: true }).click();
  await c.has('a class already in another programme is reported and skipped', page.getByText(/already in another programme \(Summer Cut\)/));
  c.ok('and there is nothing to add', await page.getByRole('button', { name: 'Nothing new to add' }).isDisabled());
  await page.getByRole('button', { name: 'Morning HIIT', exact: true }).click();
  c.ok('layout (programme)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/programmes-open-${name}.png`, fullPage: true });
  await page.getByRole('button', { name: /^Add 3 classes to this programme$/ }).click();
  await c.has('added, and says how many', page.getByText('Added 3 classes to Hybrid Uppers.'));
  const ins = writes.find((w) => w.table === 'class_block_sessions' && w.method === 'POST');
  c.ok('the addition is exact: those classes only, this block, this gym', ins && ins.body.length === 3 && ins.body.every((b) => b.block_id === 'blk1' && b.gym_id === GYM) && ['s1', 's2', 's3'].every((id) => ins.body.some((b) => b.session_id === id)));
  c.ok('nothing else was written', writes.length === 1);
  await c.has('step 3 is now where you are: 1 of 3 have a workout', page.getByText('1 of 3 classes have a workout'));

  // Step 3: the grid. Morning HIIT s1 and s2 run in the same slot (weeks 1 and 2); s3 is another slot.
  const hiit = page.getByRole('group', { name: /09:00 Morning HIIT$/ });
  c.ok('the grid has a row for each class slot', (await page.locator('.prog-row').count()) === 2);
  c.ok('a week with a workout says so, one without says Add', (await hiit.first().getByRole('button', { name: /week 1: Available: Push day/ }).count()) === 1 && (await hiit.first().getByRole('button', { name: /week 2: No workout/ }).count()) === 1);
  c.ok('layout (grid)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/programmes-grid-${name}.png`, fullPage: true });
  writes.length = 0;
  await hiit.first().getByRole('button', { name: /week 2: No workout/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Use for this week' }).click();
  await c.has('a workout must be chosen first', dlg.getByText('Choose a workout first.'));
  c.ok('nothing written yet', writes.length === 0);
  c.ok('layout (picker)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/programmes-picker-${name}.png`, fullPage: true });
  await dlg.getByLabel('Workout from your library').selectOption('t-leg');
  await dlg.getByRole('button', { name: /^Use for all 2 weeks of / }).click();
  c.ok('the picker closes once saved', await dlg.waitFor({ state: 'detached' }).then(() => true, () => false));
  const wk = writes.find((w) => w.table === 'class_session_workouts' && w.method === 'POST');
  c.ok('the write is exact: both weeks of that slot only, with the gym and the workout', wk && Array.isArray(wk.body) && wk.body.length === 2 && ['s1', 's2'].every((id) => wk.body.some((b) => b.session_id === id && b.gym_id === GYM && b.template_id === 't-leg' && b.title === 'Leg Day')));

  // Step 1 edit, then delete asks first
  writes.length = 0;
  await page.getByLabel('Programme name', { exact: true }).fill('Hybrid Uppers 2');
  await page.getByRole('button', { name: 'Save details' }).click();
  await c.has('details saved', page.getByText('Saved.'));
  const upd = writes.find((w) => w.table === 'class_blocks' && w.method === 'PATCH');
  c.ok('the update is exact: this block only', upd && upd.query.id === 'eq.blk1' && upd.body.name === 'Hybrid Uppers 2' && upd.body.weeks === 6);
  writes.length = 0;
  await page.getByRole('button', { name: 'Delete this programme' }).click();
  c.ok('deleting asks first and writes nothing yet', writes.length === 0 && (await page.getByRole('button', { name: 'Yes, delete it' }).count()) === 1);
  await page.getByRole('button', { name: 'Keep' }).click();
  await page.getByRole('button', { name: 'Delete this programme' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await c.has('back to the list', page.getByRole('heading', { name: 'Programmes', level: 1 }));
  const gone = writes.find((w) => w.table === 'class_blocks' && w.method === 'DELETE');
  c.ok('the delete is exact: this block only', gone && gone.query.id === 'eq.blk1' && writes.length === 1);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
