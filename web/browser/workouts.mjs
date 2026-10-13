// Browser gate: Workout builder (a name and its exercises with their set boxes; save, assign to a member, publish as WOD,
// archive), signed in as an
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
  const mails = [];
  let mailOk = true;
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    const table = ['workout_templates', 'workout_template_blocks', 'workout_template_activities', 'workout_assignments', 'workout_wods'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (method === 'POST' && table === 'workout_templates') return reply(route, [{ id: 't-new' }]);
      if (method === 'POST' && table === 'workout_assignments') return reply(route, body.map((_, i) => ({ id: `as${writes.length}-${i}` })));
      if (method === 'POST' && table === 'workout_template_blocks') return reply(route, [{ id: `blk-new-${writes.filter((w) => w.table === 'workout_template_blocks' && w.method === 'POST').length}` }]);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/functions/v1/notify-training')) {
      mails.push(body);
      return reply(route, mailOk ? { ok: true, emailed: true } : { ok: true, emailed: false, email_error: 'Email is not configured.' });
    }
    if (path.endsWith('/workout_templates')) return reply(route, templates);
    if (path.endsWith('/workout_template_blocks')) return reply(route, url.searchParams.get('select') === 'id' ? [{ id: 'blk-old' }] : blocks);
    if (path.endsWith('/workout_template_activities')) return reply(route, activities);
    if (path.endsWith('/members')) return reply(route, [{ user_id: 'u-amy', display_name: 'Amy Active', first_name: null, last_name: null, email: null }, { user_id: 'u-ben', display_name: 'Ben Lifter', first_name: null, last_name: null, email: null }]);
    return false;
  });
  await page.goto(`${base}/workouts`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('heading', page.getByRole('heading', { name: 'Workout builder', level: 1 }));
  await c.has('library lists workouts', page.getByText('Friday Hybrid'));
  c.ok('the library shows no type or visibility labels', (await page.getByText('Staff only').count()) === 0 && (await page.getByText('hybrid', { exact: true }).count()) === 0);
  c.ok('layout (library)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/workouts-${name}.png`, fullPage: true });

  // Open, edit, save
  await page.getByRole('button', { name: 'Open Leg Day' }).click();
  await c.has('editor loaded', page.getByLabel('Workout name'));
  c.ok('prefilled', (await page.getByLabel('Workout name').inputValue()) === 'Leg Day' && (await page.getByLabel('Note for the member (optional)').inputValue()) === 'Heavy legs');
  c.ok('no type, tags, minutes, blocks or formats to fill in', (await page.getByLabel('Workout type').count()) === 0 && (await page.getByLabel('Focus tags').count()) === 0 && (await page.getByLabel('Estimated minutes').count()) === 0 && (await page.getByLabel('Visibility').count()) === 0 && (await page.getByLabel('Block name').count()) === 0 && (await page.getByLabel('Format').count()) === 0 && (await page.getByRole('button', { name: 'Add block' }).count()) === 0);
  c.ok('the exercises are listed with set boxes, the earlier wording kept', (await page.getByRole('button', { name: 'Remove Back squat' }).count()) === 1 && (await page.getByRole('button', { name: 'Remove Walking lunge' }).count()) === 1 && (await page.getByText('Earlier wording: 4 x 6 @ 80kg').count()) === 1 && (await page.getByLabel('Back squat set 1 Reps').count()) === 1);
  c.ok('assign and WOD disabled until saved changes are clear? (clean now: enabled)', !(await page.getByRole('button', { name: 'Assign to member' }).isDisabled()));
  c.ok('editor layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/workouts-editor-${name}.png`, fullPage: true });
  await page.getByLabel('Back squat set 1 Reps').fill('5');
  await page.getByLabel('Back squat set 1 Weight').fill('85');
  await page.getByRole('button', { name: 'Add a set to Back squat' }).click();
  c.ok('another set copies the last one', (await page.getByLabel('Back squat set 2 Reps').inputValue()) === '5' && (await page.getByLabel('Back squat set 2 Weight').inputValue()) === '85');
  c.ok('the weight box says it takes kg or a percentage, and the page explains it', (await page.getByLabel('Back squat set 1 Weight').getAttribute('placeholder')) === 'kg or %' && (await page.getByText(/or a percentage of the member's best like 80%/).count()) >= 1);
  await page.getByLabel('Back squat set 2 Weight').fill('abc%');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('a badly typed percentage is refused, naming the exercise', page.getByText('Back squat: "abc%" is not a percentage from 1% to 150%. Type something like 80%, or a weight in kg.'));
  c.ok('and nothing is written for it', writes.length === 0);
  await page.getByLabel('Back squat set 2 Weight').fill('80%');
  c.ok('the reps box says it takes a number, a range or max', (await page.getByLabel('Back squat set 2 Reps').getAttribute('placeholder')) === 'reps or 8-12' && (await page.getByText(/Reps: a number, a range like 8-12, or max\./).count()) >= 1);
  await page.getByLabel('Back squat set 2 Reps').fill('12-8');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('a range the wrong way round is refused, naming the exercise', page.getByText('Back squat: "12-8" is not a range of reps. Type it like 8-12, with the smaller number first.'));
  c.ok('and nothing is written for it', writes.length === 0);
  await page.getByLabel('Back squat set 2 Reps').fill('8-12');
  c.ok('unsaved changes disable assign and publish', (await page.getByRole('button', { name: 'Assign to member' }).isDisabled()) && (await page.getByRole('button', { name: 'Publish as WOD' }).isDisabled()));
  await page.getByLabel('Workout name').fill(' ');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('blank name refused', page.getByText('Enter a workout name.'));
  c.ok('nothing written when refused', writes.length === 0);
  await page.getByLabel('Workout name').fill('Leg Day');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('saved message', page.getByText('Workout saved.'));
  const tpl = writes.find((w) => w.table === 'workout_templates' && w.method === 'PATCH');
  c.ok('template update scoped to this workout and gym', tpl && tpl.query.id === 'eq.t-leg' && tpl.query.gym_id === `eq.${GYM}` && tpl.body.title === 'Leg Day' && tpl.body.created_by === USER && tpl.body.is_active === true && tpl.body.visibility === 'private' && JSON.stringify(tpl.body.focus_tags) === '["Legs"]' && tpl.body.estimated_minutes === 50 && tpl.body.workout_type === 'strength');
  const nb = writes.filter((w) => w.table === 'workout_template_blocks' && w.method === 'POST');
  c.ok('the block is written again with its rounds', nb.length === 1 && nb[0].body.rounds === 4 && nb[0].body.position === 0 && nb[0].body.title === 'Main lift' && nb[0].body.template_id === 't-leg');
  const na = writes.find((w) => w.table === 'workout_template_activities' && w.method === 'POST');
  c.ok('activities written with the set boxes, the kept extra key and the earlier wording where no sets were set', na && na.body.length === 2 && na.body[0].prescription.display === '5 × 85 kg / 8–12 × 80%' && JSON.stringify(na.body[0].prescription.sets) === '[{"reps":"5","weight":"85"},{"reps":"8-12","weight":"80%"}]' && na.body[0].prescription.target === 'RPE 8' && na.body[0].block_id === 'blk-new-1' && na.body[1].position === 1 && na.body[1].prescription.display === '3 x 12' && !('sets' in na.body[1].prescription));
  const del = writes.filter((w) => w.method === 'DELETE');
  c.ok('old block removed, scoped, and it is the LAST write', del.length === 1 && del[0].table === 'workout_template_blocks' && del[0].query.template_id === 'eq.t-leg' && del[0].query.id === 'in.(blk-old)' && writes[writes.length - 1] === del[0]);
  c.ok('assign enabled again after saving', !(await page.getByRole('button', { name: 'Assign to member' }).isDisabled()));

  // Assign: one or several workouts, no days
  writes.length = 0;
  await page.getByRole('button', { name: 'Assign to member' }).click();
  await dialog.getByLabel('Client').waitFor();
  c.ok('assign dialog lists the clients', (await dialog.getByLabel('Client').locator('option').allInnerTexts()).join() === 'Amy Active,Ben Lifter');
  c.ok('the workout being viewed is already ticked', await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Leg Day/).isChecked());
  c.ok('there are no days or dates to choose', (await dialog.getByLabel('Due date (optional)').count()) === 0 && (await dialog.getByLabel('How often').count()) === 0 && (await dialog.getByLabel('Start date').count()) === 0);
  c.ok('assign dialog layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/workouts-assign-${name}.png` });
  await dialog.getByLabel('Client').selectOption('u-ben');
  await dialog.getByLabel('Note (optional)').fill('Slow on the way down');
  await dialog.getByRole('button', { name: 'Send workout' }).click();
  await c.has('sent message, and the client was emailed too', page.getByText('Workout sent to Ben Lifter. Ben Lifter has been emailed too.'));
  const as = writes.find((w) => w.table === 'workout_assignments');
  const one = as && Array.isArray(as.body) ? as.body[0] : null;
  c.ok('assignment exact, with no date', as && as.method === 'POST' && as.body.length === 1 && one.gym_id === GYM && one.member_user_id === 'u-ben' && one.assigned_by === USER && one.source === 'pt' && one.status === 'todo' && one.template_id === 't-leg' && one.title === 'Leg Day' && !('due_at' in one) && !('scheduled_for' in one));
  c.ok('the email was asked for, for exactly those workouts', mails.length === 1 && mails[0].kind === 'assigned' && mails[0].assignment_ids.length === 1);
  c.ok('assignment carries a copy of the blocks and the coach\'s note', one && one.workout_snapshot.template_id === 't-leg' && one.workout_snapshot.blocks.length === 1 && one.workout_snapshot.blocks[0].activities.length === 2 && one.workout_snapshot.coach_note === 'Slow on the way down');

  // Several at once: one request
  writes.length = 0;
  mails.length = 0;
  mailOk = false;
  await page.getByRole('button', { name: 'Assign to member' }).click();
  await dialog.getByLabel('Client').selectOption('u-amy');
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Friday Hybrid/).check();
  c.ok('the button counts them', (await dialog.getByRole('button', { name: 'Send 2 workouts' }).count()) === 1);
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Leg Day/).uncheck();
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Friday Hybrid/).uncheck();
  await dialog.getByRole('button', { name: 'Send workout' }).click();
  await c.has('at least one workout is needed', dialog.getByText('Tick at least one workout.'));
  c.ok('nothing was sent for none', writes.filter((w) => w.table === 'workout_assignments').length === 0);
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Leg Day/).check();
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Friday Hybrid/).check();
  c.ok('layout (several)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Send 2 workouts' }).click();
  await c.has('a failed email never undoes it, and says so', page.getByText('2 workouts sent to Amy Active. The email did not go (Email is not configured.), but Amy Active will see it in the app.'));
  c.ok('one email request for the whole set', mails.length === 1 && mails[0].assignment_ids.length === 2);
  const several = writes.filter((w) => w.table === 'workout_assignments');
  c.ok('sent as one request with two assignments, neither dated', several.length === 1 && several[0].body.length === 2 && several[0].body.map((b) => b.template_id).sort().join() === 't-leg,t-wod' && several[0].body.every((b) => b.member_user_id === 'u-amy' && b.status === 'todo' && !('due_at' in b) && !('coach_note' in b.workout_snapshot)));

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

  // Exercise moves and adding one
  c.ok('the first exercise cannot move up', await page.getByRole('button', { name: 'Move Back squat up' }).isDisabled());
  await page.getByRole('button', { name: 'Move Walking lunge up' }).click();
  c.ok('exercises swap', (await page.getByRole('button', { name: 'Move Walking lunge up' }).isDisabled()) && (await page.getByRole('button', { name: 'Move Back squat up' }).isEnabled()));
  await page.getByLabel('Add an exercise', { exact: true }).fill('Plank');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  c.ok('a typed exercise is added and set to record time', (await page.getByRole('button', { name: 'Remove Plank' }).count()) === 1 && (await page.getByRole('group', { name: 'Plank set 1 Time' }).count()) === 1);
  c.ok('layout (more exercises)', (await page.evaluate(layoutProblems)).length === 0);
  // A time is chosen as hours, minutes and seconds (nothing to misread as minutes or seconds)
  const plankTime = page.getByRole('group', { name: 'Plank set 1 Time' });
  c.ok('the time has hour, minute and second selectors, all at zero to start', (await plankTime.getByRole('combobox').count()) === 3 && (await page.getByLabel('Plank set 1 Time hours').inputValue()) === '0' && (await page.getByLabel('Plank set 1 Time minutes').inputValue()) === '0' && (await page.getByLabel('Plank set 1 Time seconds').inputValue()) === '0');
  await page.getByLabel('Plank set 1 Time minutes').selectOption('1');
  await page.getByLabel('Plank set 1 Time seconds').selectOption('30');
  c.ok('choosing 1 minute 30 seconds keeps that', (await page.getByLabel('Plank set 1 Time minutes').inputValue()) === '1' && (await page.getByLabel('Plank set 1 Time seconds').inputValue()) === '30');
  await page.getByLabel('Plank set 1 Time hours').selectOption('1');
  c.ok('hours can be added', (await page.getByLabel('Plank set 1 Time hours').inputValue()) === '1' && (await page.getByLabel('Plank set 1 Time minutes').inputValue()) === '1');
  await page.getByLabel('Plank set 1 Time hours').selectOption('0');
  c.ok('layout (time selectors)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await plankTime.locator('xpath=ancestor::div[contains(@class,"wk-activity")]').screenshot({ path: `${shots}/workouts-time-${name}.png` });

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
  await c.has('an exercise is needed', page.getByText('Add at least one exercise.'));
  c.ok('nothing written for refused forms', writes.length === 0);
  await page.getByLabel('Add an exercise', { exact: true }).fill('Sled push');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Record').selectOption('distance');
  await page.getByLabel('Sled push set 1 Distance in km').fill('lots');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('a box that is not a number is named', page.getByText('Sled push: "lots" is not a number.'));
  c.ok('nothing written for that either', writes.length === 0);
  await page.getByLabel('Sled push set 1 Distance in km').fill('0.05');
  // An exercise scored two ways (rounds and reps, time and reps...): the coach names both scores and says what kind each is
  await page.getByLabel('Add an exercise', { exact: true }).fill('AMRAP 12');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Record').last().selectOption('scores');
  const scoreGroup = page.getByRole('group', { name: 'AMRAP 12 scores' });
  await c.has('the two scores appear, starting as rounds and reps', scoreGroup);
  c.ok('with those names and kinds filled in, and no set boxes', (await scoreGroup.getByLabel('Score 1 name').inputValue()) === 'Rounds' && (await scoreGroup.getByLabel('Score 1 kind').inputValue()) === 'rounds' && (await scoreGroup.getByLabel('Score 2 name').inputValue()) === 'Reps' && (await scoreGroup.getByLabel('Score 2 kind').inputValue()) === 'reps' && (await page.getByLabel('AMRAP 12 set 1 Reps').count()) === 0);
  c.ok('layout (two scores)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await scoreGroup.screenshot({ path: `${shots}/workouts-scores-${name}.png` });
  await scoreGroup.getByLabel('Score 2 kind').selectOption('rounds');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('two scores of the same kind are refused, naming the exercise', page.getByText('AMRAP 12: The two scores must be different kinds (for example rounds and reps).'));
  c.ok('nothing written for it', writes.length === 0);
  await scoreGroup.getByLabel('Score 2 kind').selectOption('time');
  await scoreGroup.getByLabel('Score 2 name').fill('');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('a score without a name is refused', page.getByText('AMRAP 12: Give both scores a name (up to 40 characters).'));
  await scoreGroup.getByLabel('Score 2 name').fill('Finish time');
  await scoreGroup.getByLabel('Score 1 name').fill('Rounds completed');
  await page.getByRole('button', { name: 'Save workout' }).click();
  await c.has('new workout saved', page.getByText('Workout saved.'));
  const nt = writes.find((w) => w.table === 'workout_templates' && w.method === 'POST');
  c.ok('create exact, with the hidden things at their quiet defaults', nt && nt.body.gym_id === GYM && nt.body.created_by === USER && nt.body.title === 'Sled Day' && nt.body.visibility === 'private' && nt.body.workout_type === 'custom' && nt.body.estimated_minutes === null && JSON.stringify(nt.body.focus_tags) === '[]' && nt.body.is_active === true);
  const nbk = writes.find((w) => w.table === 'workout_template_blocks' && w.method === 'POST');
  c.ok('one plain block holds the exercises', nbk && writes.filter((w) => w.table === 'workout_template_blocks' && w.method === 'POST').length === 1 && nbk.body.title === 'Workout' && nbk.body.block_type === 'standard');
  const nn = writes.find((w) => w.table === 'workout_template_activities' && w.method === 'POST');
  c.ok('new activity exact', nn && nn.body.length === 2 && nn.body[0].activity_name === 'Sled push' && nn.body[0].tracking_type === 'distance' && nn.body[0].prescription.display === '0.05 km' && JSON.stringify(nn.body[0].prescription.sets) === '[{"distance":"0.05"}]' && !('scores' in nn.body[0].prescription));
  c.ok('the two-score exercise keeps both scores (name and kind) and has no sets', nn && nn.body[1].activity_name === 'AMRAP 12' && nn.body[1].tracking_type === 'scores' && JSON.stringify(nn.body[1].prescription.scores) === '[{"name":"Rounds completed","kind":"rounds"},{"name":"Finish time","kind":"time"}]' && nn.body[1].prescription.display === 'Record Rounds completed and Finish time' && !('sets' in nn.body[1].prescription));
  c.ok('nothing is deleted for a brand new workout', !writes.some((w) => w.method === 'DELETE'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
