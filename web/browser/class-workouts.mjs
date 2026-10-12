// Browser gate: the workout on a class. The coach opens a class, picks a workout from the library (or builds a new one right
// there), then makes it available; people in the class can only see it after that. Signed in as an owner, at phone and
// desktop width. Supabase is mocked at the network layer. Checks the exact request of every action and that nothing is
// written by looking.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
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
const session = { session_id: 'h', name: 'Morning HIIT', starts_at: gymTime(todayKey, '09:00'), ends_at: gymTime(todayKey, '10:00'), booked_count: 5, capacity: 16, spaces_left: 11, is_cancelled: false, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_plan_names: [] };

const templates = [
  { id: 't-leg', title: 'Leg Day', description: 'Heavy legs', workout_type: 'strength', focus_tags: ['Legs'], estimated_minutes: 50, visibility: 'private' },
  { id: 't-wod', title: 'Friday Hybrid', description: null, workout_type: 'hybrid', focus_tags: [], estimated_minutes: null, visibility: 'gym' },
];
const blocks = [{ id: 'blk-old', title: 'Workout', block_type: 'standard', position: 0, rounds: null, instructions: null }];
const activities = [
  { id: 'act-1', block_id: 'blk-old', activity_name: 'Back squat', activity_type: 'exercise', tracking_type: 'strength', position: 0, prescription: { display: '3 sets: 8 × 60 kg', sets: [{ reps: '8', weight: '60' }, { reps: '8', weight: '60' }, { reps: '8', weight: '60' }] }, notes: 'Brace' },
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
  let stored = null;
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/rpc/get_class_calendar')) return reply(route, [session]);
    const table = ['class_session_workouts', 'workout_templates', 'workout_template_blocks', 'workout_template_activities'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (table === 'class_session_workouts') {
        if (method === 'POST') stored = { session_id: body.session_id, title: body.title, template_id: body.template_id, workout_snapshot: body.workout_snapshot, published_at: stored?.published_at ?? null };
        if (method === 'PATCH') stored = { ...stored, published_at: body.published_at };
        if (method === 'DELETE') stored = null;
        await route.fulfill({ status: 204, body: '' });
        return true;
      }
      if (method === 'POST' && table === 'workout_templates') return reply(route, [{ id: 't-new' }]);
      if (method === 'POST' && table === 'workout_template_blocks') return reply(route, [{ id: 'blk-new' }]);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/class_session_workouts')) return reply(route, stored ? [stored] : []);
    if (path.endsWith('/workout_templates')) return reply(route, templates);
    if (path.endsWith('/workout_template_blocks')) return reply(route, url.searchParams.get('select') === 'id' ? [{ id: 'blk-new' }] : blocks);
    if (path.endsWith('/workout_template_activities')) return reply(route, activities);
    if (path.endsWith('/class_bookings')) return reply(route, []);
    if (path.endsWith('/class_session_staff')) return reply(route, []);
    return false;
  });

  await page.goto(`${base}/classes`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('heading', page.getByRole('heading', { name: 'Classes', level: 1 }));
  if (name === 'desktop') {
    await page.locator('.cal-col').nth(6).waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Day', exact: true }).click();
  }
  await page.getByRole('button', { name: /^Morning HIIT/ }).click();

  // Nothing yet
  const panel = dialog.getByRole('region', { name: 'Class workout' });
  await c.has('the class has a workout section', panel.getByText('Workout for this class'));
  await c.has('with no workout yet', panel.getByText(/No workout yet/));
  c.ok('looking wrote nothing', writes.length === 0);
  c.ok('the library is offered', (await panel.getByLabel('Workout from your library').locator('option').allInnerTexts()).join('|') === 'Choose a workout…|Leg Day|Friday Hybrid');
  await panel.getByRole('button', { name: 'Add to this class' }).click();
  await c.has('a workout must be chosen first', panel.getByText('Choose a workout first.'));
  c.ok('and nothing is written without one', writes.length === 0);
  c.ok('layout (empty)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-workouts-empty-${name}.png`, fullPage: true });

  // Put a workout on the class: a draft
  await panel.getByLabel('Workout from your library').selectOption('t-leg');
  await panel.getByRole('button', { name: 'Add to this class' }).click();
  await c.has('it is added as a draft', panel.getByText('Draft', { exact: true }));
  await c.has('named', panel.getByText('Leg Day', { exact: true }));
  await c.has('and says nobody else can see it yet', panel.getByText(/nobody else can see it yet/));
  const put = writes.find((w) => w.table === 'class_session_workouts' && w.method === 'POST');
  c.ok('the upsert is exact: this class, this gym, a copy of the workout', put && put.query.on_conflict === 'session_id' && put.body.session_id === 'h' && put.body.gym_id === GYM && put.body.template_id === 't-leg' && put.body.title === 'Leg Day' && put.body.created_by === USER && put.body.workout_snapshot.blocks?.length === 1 && put.body.workout_snapshot.blocks[0].activities[0].activity_name === 'Back squat' && !('published_at' in put.body));
  c.ok('layout (draft)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-workouts-draft-${name}.png`, fullPage: true });

  // Make it available
  writes.length = 0;
  await panel.getByRole('button', { name: 'Make available to the class' }).click();
  await c.has('it becomes available', panel.getByText('Available', { exact: true }));
  await c.has('and says who can open it', panel.getByText(/People booked into this class, or marked attended/));
  const pub = writes.find((w) => w.method === 'PATCH');
  c.ok('the update is exact: this class only, who and when', pub && pub.table === 'class_session_workouts' && pub.query.session_id === 'eq.h' && pub.body.published_by === USER && typeof pub.body.published_at === 'string' && !Number.isNaN(Date.parse(pub.body.published_at)));
  c.ok('only that one write happened', writes.length === 1);

  // Take it back
  writes.length = 0;
  await panel.getByRole('button', { name: 'Take it back' }).click();
  await c.has('it is a draft again', panel.getByText('Draft', { exact: true }));
  const back = writes.find((w) => w.method === 'PATCH');
  c.ok('taking it back clears the time', back && back.query.session_id === 'eq.h' && back.body.published_at === null);

  // Change the workout; it stays a draft
  writes.length = 0;
  await panel.getByRole('button', { name: 'Change workout' }).click();
  await panel.getByLabel('Workout from your library').selectOption('t-wod');
  await panel.getByRole('button', { name: 'Use this one instead' }).click();
  await c.has('the new workout is on the class', panel.getByText('Friday Hybrid', { exact: true }));
  const swap = writes.find((w) => w.method === 'POST' && w.table === 'class_session_workouts');
  c.ok('swapping replaces the copy for this class', swap && swap.body.session_id === 'h' && swap.body.template_id === 't-wod' && swap.body.title === 'Friday Hybrid');

  // Remove asks first
  writes.length = 0;
  await panel.getByRole('button', { name: 'Remove', exact: true }).click();
  c.ok('removing asks first and writes nothing yet', writes.length === 0 && (await panel.getByRole('button', { name: 'Yes, remove it' }).count()) === 1);
  await panel.getByRole('button', { name: 'Keep' }).click();
  c.ok('keeping leaves it', (await panel.getByText('Friday Hybrid', { exact: true }).count()) === 1 && writes.length === 0);
  await panel.getByRole('button', { name: 'Remove', exact: true }).click();
  await panel.getByRole('button', { name: 'Yes, remove it' }).click();
  await c.has('removed, back to no workout', panel.getByText(/No workout yet/));
  const del = writes.find((w) => w.method === 'DELETE');
  c.ok('the delete is exact: this class only', del && del.table === 'class_session_workouts' && del.query.session_id === 'eq.h' && writes.length === 1);

  // Build a new one right here
  writes.length = 0;
  await panel.getByRole('button', { name: 'Build a new workout' }).click();
  await c.has('the workout builder opens inside the class', dialog.getByLabel('Workout name'));
  c.ok('the class details step aside while building', !(await dialog.getByText('Who has booked').isVisible()));
  c.ok('and the builder is the simple one: a name and exercises', (await dialog.getByLabel('Workout type').count()) === 0 && (await dialog.getByLabel('Add an exercise', { exact: true }).count()) === 1);
  await dialog.getByLabel('Workout name').fill('Class WOD');
  await dialog.getByLabel('Add an exercise', { exact: true }).fill('Back squat');
  await dialog.getByRole('button', { name: 'Add exercise' }).click();
  await dialog.getByLabel('Back squat set 1 Reps').fill('5');
  await dialog.getByLabel('Back squat set 1 Weight').fill('100');
  c.ok('layout (building)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-workouts-build-${name}.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Save workout' }).click();
  await c.has('saving the new workout puts it on the class and returns to the class', dialog.getByText('Who has booked'));
  await c.has('the new workout is the class workout, a draft', panel.getByText('Class WOD', { exact: true }));
  const tpl = writes.find((w) => w.table === 'workout_templates' && w.method === 'POST');
  c.ok('the new workout was saved to the library first', tpl && tpl.body.title === 'Class WOD' && tpl.body.gym_id === GYM);
  const onClass = writes.find((w) => w.table === 'class_session_workouts' && w.method === 'POST');
  c.ok('then put on this class', onClass && onClass.body.session_id === 'h' && onClass.body.template_id === 't-new' && onClass.body.title === 'Class WOD');
  c.ok('and left as a draft (not made available by saving)', !writes.some((w) => w.table === 'class_session_workouts' && w.method === 'PATCH'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
