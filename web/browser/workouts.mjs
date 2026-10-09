// Browser gate: Workout builder (library, edit, save, assign to a member, publish as WOD, archive), signed in as an
// owner, at phone and desktop width. Supabase is mocked at the network layer. Checks the safe save order (new blocks
// first, old ones removed last), that nothing is written when a form is refused, and the exact request of every action.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const templates = [
  { id: 't-leg', title: 'Leg Day', description: 'Heavy legs', workout_type: 'strength', focus_tags: ['Legs'], estimated_minutes: 50, visibility: 'private' },
  { id: 't-wod', title: 'Friday Hybrid', description: null, workout_type: 'hybrid', focus_tags: [], estimated_minutes: null, visibility: 'gym' },
];
const blocks = [{ id: 'blk-old', title: 'Main lift', block_type: 'strength', position: 0, rounds: 4, instructions: 'Controlled tempo' }];
const activities = [
  { id: 'act-1', block_id: 'blk-old', activity_name: 'Back squat', activity_type: 'exercise', tracking_type: 'strength', position: 0, prescription: { display: '4 x 6 @ 80kg', target: 'RPE 8' }, notes: 'Brace' },
  { id: 'act-2', block_id: 'blk-old', activity_name: 'Walking lunge', activity_type: 'exercise', tracking_type: 'reps', position: 1, prescription: { display: '3 x 12' }, notes: null },
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
    const table = ['workout_templates', 'workout_template_blocks', 'workout_template_activities', 'workout_assignments', 'workout_wods'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (method === 'POST' && table === 'workout_templates') return reply(route, [{ id: 't-new' }]);
      if (method === 'POST' && table === 'workout_template_blocks') return reply(route, [{ id: `blk-new-${writes.filter((w) => w.table === 'workout_template_blocks' && w.method === 'POST').length}` }]);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/workout_templates')) return reply(route, templates);
    if (path.endsWith('/workout_template_blocks')) return reply(route, url.searchParams.get('select') === 'id' ? [{ id: 'blk-old' }] : blocks);
    if (path.endsWith('/workout_template_activities')) return reply(route, activities);
    if (path.endsWith('/members')) return reply(route, [{ user_id: 'u-amy', display_name: 'Amy Active', first_name: null, last_name: null, email: null }, { user_id: 'u-ben', display_name: 'Ben Lifter', first_name: null, last_name: null, email: null }]);
    return false;
  });
  await page.goto(`${base}/next/#/workouts`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('heading', page.getByRole('heading', { name: 'Workout builder', level: 1 }));
  await c.has('library lists workouts', page.getByText('Friday Hybrid'));
  await c.has('visibility shown', page.getByText('Gym members').first());
  c.ok('layout (library)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/workouts-${name}.png`, fullPage: true });

  // Open, edit, save
  await page.getByRole('button', { name: 'Open Leg Day' }).click();
  await c.has('editor loaded', page.getByLabel('Workout name'));
  c.ok('prefilled', (await page.getByLabel('Workout name').inputValue()) === 'Leg Day' && (await page.getByLabel('Focus tags').inputValue()) === 'Legs' && (await page.getByLabel('Estimated minutes').inputValue()) === '50');
  c.ok('blocks and activities shown', (await page.getByLabel('Exercise or activity').count()) === 2 && (await page.getByLabel('Prescription').first().inputValue()) === '4 x 6 @ 80kg' && (await page.getByLabel('Rounds (optional)').inputValue()) === '4');
  c.ok('assign and WOD disabled until saved changes are clear? (clean now: enabled)', !(await page.getByRole('button', { name: 'Assign to member' }).isDisabled()));
  c.ok('editor layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/workouts-editor-${name}.png`, fullPage: true });
  await page.getByLabel('Prescription').first().fill('5 x 5 @ 85kg');
  c.ok('unsaved changes disable assign and publish', (await page.getByRole('button', { name: 'Assign to member' }).isDisabled()) && (await page.getByRole('button', { name: 'Publish as WOD' }).isDisabled()));
  await page.getByLabel('Workout name').fill(' ');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('blank name refused', page.getByText('Enter a workout name.'));
  c.ok('nothing written when refused', writes.length === 0);
  await page.getByLabel('Workout name').fill('Leg Day');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('saved message', page.getByText('Workout saved.'));
  const tpl = writes.find((w) => w.table === 'workout_templates' && w.method === 'PATCH');
  c.ok('template update scoped to this workout and gym', tpl && tpl.query.id === 'eq.t-leg' && tpl.query.gym_id === `eq.${GYM}` && tpl.body.title === 'Leg Day' && tpl.body.created_by === USER && tpl.body.is_active === true && tpl.body.visibility === 'private' && JSON.stringify(tpl.body.focus_tags) === '["Legs"]');
  const nb = writes.filter((w) => w.table === 'workout_template_blocks' && w.method === 'POST');
  c.ok('the block is written again with its rounds', nb.length === 1 && nb[0].body.rounds === 4 && nb[0].body.position === 0 && nb[0].body.title === 'Main lift' && nb[0].body.template_id === 't-leg');
  const na = writes.find((w) => w.table === 'workout_template_activities' && w.method === 'POST');
  c.ok('activities written with the new prescription and the kept extra key', na && na.body.length === 2 && na.body[0].prescription.display === '5 x 5 @ 85kg' && na.body[0].prescription.target === 'RPE 8' && na.body[0].block_id === 'blk-new-1' && na.body[1].position === 1);
  const del = writes.filter((w) => w.method === 'DELETE');
  c.ok('old block removed, scoped, and it is the LAST write', del.length === 1 && del[0].table === 'workout_template_blocks' && del[0].query.template_id === 'eq.t-leg' && del[0].query.id === 'in.(blk-old)' && writes[writes.length - 1] === del[0]);
  c.ok('assign enabled again after saving', !(await page.getByRole('button', { name: 'Assign to member' }).isDisabled()));

  // Assign
  writes.length = 0;
  await page.getByRole('button', { name: 'Assign to member' }).click();
  await dialog.getByLabel('Member').waitFor();
  c.ok('assign dialog lists the members', (await dialog.getByLabel('Member').locator('option').allInnerTexts()).join() === 'Amy Active,Ben Lifter');
  c.ok('assign dialog layout', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByLabel('Member').selectOption('u-ben');
  await dialog.getByLabel('Due date (optional)').fill('2026-07-10');
  await dialog.getByRole('button', { name: 'Assign workout' }).click();
  await c.has('assigned message', page.getByText('Leg Day assigned to Ben Lifter.'));
  const as = writes.find((w) => w.table === 'workout_assignments');
  c.ok('assignment exact', as && as.method === 'POST' && as.body.gym_id === GYM && as.body.member_user_id === 'u-ben' && as.body.assigned_by === USER && as.body.source === 'pt' && as.body.status === 'todo' && as.body.template_id === 't-leg' && as.body.title === 'Leg Day' && as.body.due_at === '2026-07-10T22:59:00.000Z');
  c.ok('assignment carries a copy of the blocks', as && as.body.workout_snapshot.template_id === 't-leg' && as.body.workout_snapshot.blocks.length === 1 && as.body.workout_snapshot.blocks[0].activities.length === 2);

  // A weekly programme: one request, one assignment per day
  writes.length = 0;
  await page.getByRole('button', { name: 'Assign to member' }).click();
  await dialog.getByLabel('Member').selectOption('u-amy');
  await dialog.getByLabel('How often').selectOption('weekly');
  await dialog.getByLabel('Start date').fill('2026-10-12');
  await dialog.getByRole('button', { name: 'Assign workout' }).click();
  await c.has('a programme needs a day', dialog.getByText('Choose at least one day of the week.'));
  await dialog.getByRole('group', { name: 'Days of the week' }).getByLabel('Monday').check();
  await dialog.getByRole('group', { name: 'Days of the week' }).getByLabel('Thursday').check();
  await dialog.getByLabel('For how many weeks').selectOption('2');
  await c.has('it says how many workouts', dialog.getByText('4 workouts, from 12 Oct 2026 to 22 Oct 2026.'));
  c.ok('layout (programme)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Assign 4 workouts' }).click();
  await c.has('programme assigned message', page.getByText('Leg Day assigned to Amy Active on 4 days.'));
  const prog = writes.filter((w) => w.table === 'workout_assignments');
  c.ok('sent as one request with four assignments on the right days', prog.length === 1 && Array.isArray(prog[0].body) && prog[0].body.length === 4
    && prog[0].body.map((b) => b.due_at.slice(0, 10)).join() === '2026-10-12,2026-10-15,2026-10-19,2026-10-22' && prog[0].body.every((b) => b.member_user_id === 'u-amy' && b.status === 'todo' && b.workout_snapshot.template_id === 't-leg'));

  // WOD
  writes.length = 0;
  await page.getByRole('button', { name: 'Publish as WOD' }).click();
  await dialog.getByLabel('Date').fill('');
  await dialog.getByRole('button', { name: 'Publish WOD' }).click();
  await c.has('WOD date needed', dialog.getByText('Choose the date for the workout of the day.'));
  c.ok('nothing published yet', writes.length === 0);
  await dialog.getByLabel('Date').fill('2026-10-09');
  await dialog.getByLabel('Message (optional)').fill('  Bring a towel  ');
  await dialog.getByRole('button', { name: 'Publish WOD' }).click();
  await c.has('WOD message', page.getByText('Leg Day published as the workout of the day for 9 October 2026.'));
  const wod = writes.find((w) => w.table === 'workout_wods');
  c.ok('WOD upsert exact', wod && wod.query.on_conflict === 'gym_id,wod_date' && wod.body.gym_id === GYM && wod.body.template_id === 't-leg' && wod.body.wod_date === '2026-10-09' && wod.body.message === 'Bring a towel' && wod.body.is_active === true && wod.body.published_by === USER);

  // Block moves
  c.ok('first block cannot move up', await page.getByRole('button', { name: 'Move block 1 up' }).isDisabled());
  await page.getByRole('button', { name: 'Add block' }).click();
  c.ok('a second block appears and can move up', (await page.getByRole('button', { name: 'Move block 2 up' }).isEnabled()));
  await page.getByRole('button', { name: 'Move block 2 up' }).click();
  c.ok('blocks swap', (await page.getByLabel('Block name').first().inputValue()) === 'Strength' && (await page.getByLabel('Block name').nth(1).inputValue()) === 'Main lift');

  // Archive asks first
  writes.length = 0;
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await c.has('archive asks first', page.getByRole('alertdialog').getByText(/Archive this workout\?/));
  c.ok('nothing written while asking', writes.length === 0);
  await page.getByRole('button', { name: 'Keep' }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, archive' }).click();
  await page.waitForTimeout(300);
  const ar = writes.find((w) => w.table === 'workout_templates' && w.method === 'PATCH');
  c.ok('archive only switches it off, scoped', ar && ar.query.id === 'eq.t-leg' && ar.query.gym_id === `eq.${GYM}` && ar.body.is_active === false && !('title' in ar.body));
  await c.has('back to the library with a message', page.getByText(/was archived/));

  // New workout
  writes.length = 0;
  await page.getByRole('button', { name: 'New workout' }).click();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('name needed', page.getByText('Enter a workout name.'));
  await page.getByLabel('Workout name').fill('Sled Day');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('a block is needed', page.getByText('Add at least one workout block.'));
  await page.getByRole('button', { name: 'Add block' }).click();
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('an activity is needed', page.getByText('Every block needs at least one named activity.'));
  c.ok('nothing written for refused forms', writes.length === 0);
  await page.getByRole('button', { name: 'Add activity to block 1' }).click();
  await page.getByLabel('Exercise or activity').fill('Sled push');
  await page.getByLabel('Track by').selectOption('distance');
  await page.getByLabel('Visibility').selectOption('gym');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('new workout saved', page.getByText('Workout saved.'));
  const nt = writes.find((w) => w.table === 'workout_templates' && w.method === 'POST');
  c.ok('create exact', nt && nt.body.gym_id === GYM && nt.body.created_by === USER && nt.body.title === 'Sled Day' && nt.body.visibility === 'gym' && nt.body.estimated_minutes === 45 && nt.body.is_active === true);
  const nn = writes.find((w) => w.table === 'workout_template_activities' && w.method === 'POST');
  c.ok('new activity exact', nn && nn.body.length === 1 && nn.body[0].activity_name === 'Sled push' && nn.body[0].tracking_type === 'distance' && nn.body[0].prescription.display === '');
  c.ok('nothing is deleted for a brand new workout', !writes.some((w) => w.method === 'DELETE'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
