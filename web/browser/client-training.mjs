// Browser gate: a coach's side of the training loop, signed in as an owner, at phone and desktop width. Supabase is mocked at
// the network layer. On a client's file: what is waiting, every workout they have done with the coach-set ones outlined,
// what was set beside what they did and why it differed, the reply (free text or Looks good), taking back an unstarted
// workout, and assigning more. Plus the Client training list of finished workouts nobody has replied to.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const JAMIE = '33333333-3333-4333-8333-333333333333';
const SAM = '77777777-7777-4777-8777-777777777777';
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();

const profiles = [
  { id: JAMIE, display_name: 'Jamie Smith', first_name: null, last_name: null },
  { id: SAM, display_name: 'Coach Sam', first_name: null, last_name: null },
];
const assignments = [
  { id: 'a-wait', title: 'Upper body and core', status: 'todo', source: 'pt', assigned_by: SAM, created_at: ago(5), completed_at: null, member_rpe: null, member_notes: null, result: null },
  { id: 'a-done', title: 'Lower body strength', status: 'completed', source: 'pt', assigned_by: SAM, created_at: ago(3), completed_at: ago(1), member_rpe: 8, member_notes: 'Legs felt heavy after Monday', member_user_id: JAMIE,
    result: { version: 1, exercises: [
      { name: 'Back squat', plan: '4 x 6 @ 60kg', status: 'changed', reason: 'too_tired', note: 'legs felt heavy' },
      { name: 'Romanian deadlift', plan: '3 x 8 @ 40kg', status: 'as_set' },
      { name: 'Walking lunges', plan: '3 x 10 each leg', status: 'not_this_time', reason: 'pain', note: 'left knee' },
    ] } },
  { id: 'a-done2', title: 'Push day', status: 'completed', source: 'pt', assigned_by: SAM, created_at: ago(9), completed_at: ago(7), member_rpe: 6, member_notes: null, member_user_id: JAMIE,
    result: { version: 1, exercises: [{ name: 'Bench press', plan: '4 x 8', status: 'as_set' }] } },
];
const sessions = [
  { id: 's1', title: 'Lower body strength', performed_at: ago(1), notes: null, assignment_id: 'a-done' },
  { id: 's3', title: 'Park run', performed_at: ago(4), notes: null, assignment_id: null },
  { id: 's2', title: 'Push day', performed_at: ago(7), notes: null, assignment_id: 'a-done2' },
];
const feedback = [{ id: 'f1', assignment_id: 'a-done2', author_id: SAM, body: 'Strong work. Add 2.5 kg next week.', created_at: ago(6) }];
const templates = [
  { id: 't-leg', title: 'Leg Day', description: null, workout_type: 'strength', focus_tags: [], estimated_minutes: 50, visibility: 'private' },
  { id: 't-wod', title: 'Friday Hybrid', description: null, workout_type: 'hybrid', focus_tags: [], estimated_minutes: null, visibility: 'gym' },
];
const people = [{ user_id: JAMIE, role: 'member', joined_at: '2026-03-01T00:00:00', attrition_on: null }, { user_id: SAM, role: 'coach', joined_at: '2026-01-01T00:00:00', attrition_on: null }];

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
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  let replied = false;
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, select, method, body }) => {
    const table = ['workout_assignment_feedback', 'workout_assignments'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'DELETE', 'PATCH'].includes(method)) {
      writes.push({ table, method, query: Object.fromEntries(url.searchParams), body });
      if (table === 'workout_assignment_feedback' && method === 'POST') replied = true;
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/gym_members')) return reply(route, people);
    if (path.endsWith('/profiles')) return reply(route, profiles);
    if (path.endsWith('/workout_assignment_feedback')) return reply(route, replied ? [...feedback, { id: 'f2', assignment_id: 'a-done', author_id: USER, body: 'Thanks', created_at: new Date().toISOString() }] : feedback);
    if (path.endsWith('/workout_assignments')) return reply(route, (select.includes('member_user_id') && !select.includes('assigned_by')) ? assignments.filter((a) => a.status === 'completed' && a.id !== 'a-done2').map((a) => ({ id: a.id, member_user_id: JAMIE, title: a.title, completed_at: a.completed_at, result: a.result })) : assignments);
    if (path.endsWith('/workout_sessions')) return reply(route, sessions);
    if (path.endsWith('/workout_entries')) return reply(route, [{ id: 'e1', exercise_name: 'Back squat', tracking_type: 'strength', position: 0 }, { id: 'e2', exercise_name: 'Romanian deadlift', tracking_type: 'strength', position: 1 }, { id: 'e3', exercise_name: 'Sled push', tracking_type: 'strength', position: 2 }]);
    if (path.endsWith('/workout_sets')) return reply(route, [
      { entry_id: 'e1', set_number: 1, reps: 6, weight_kg: 60, duration_seconds: null, distance_m: null, calories: null }, { entry_id: 'e1', set_number: 2, reps: 5, weight_kg: 60, duration_seconds: null, distance_m: null, calories: null },
      { entry_id: 'e2', set_number: 1, reps: 8, weight_kg: 40, duration_seconds: null, distance_m: null, calories: null },
      { entry_id: 'e3', set_number: 1, reps: 1, weight_kg: 80, duration_seconds: null, distance_m: null, calories: null },
    ]);
    if (path.endsWith('/workout_templates')) return reply(route, templates);
    if (path.endsWith('/workout_template_blocks')) return reply(route, []);
    if (path.endsWith('/workout_template_activities')) return reply(route, []);
    return false;
  });
  await page.goto(`${base}/members/${JAMIE}`);
  const c = runChecks();
  const training = page.getByRole('region', { name: 'Training' });
  await c.has('the client file has a Training section', training.getByRole('heading', { name: 'Training' }));
  await c.has('what is waiting, with how long ago in plain words', training.getByLabel('Waiting').getByText('Set 5 days ago'));
  c.ok('the waiting list says whose it is', (await training.getByLabel('Waiting').textContent()).includes('Waiting for Jamie Smith') && (await training.getByLabel('Waiting').textContent()).includes('Upper body and core'));
  c.ok('three workouts are listed', (await training.locator('.tr-item').count()) === 3);
  c.ok('the two the coach set are outlined, the client\'s own is not', (await training.locator('.tr-item.by-coach').count()) === 2 && (await training.getByRole('button', { name: /^Park run/ }).evaluate((e) => !e.classList.contains('by-coach'))));
  c.ok('the coach-set ones say who set them', (await training.locator('.tr-item.by-coach').first().textContent()).includes('Set by Coach Sam'));
  c.ok('one waits for feedback and one was replied to', (await training.getByRole('button', { name: /^Lower body strength/ }).textContent()).includes('Needs your feedback') && (await training.getByRole('button', { name: /^Push day/ }).textContent()).includes('You replied'));
  c.ok('a short line says how it went, with no score', (await training.getByRole('button', { name: /^Lower body strength/ }).textContent()).includes('1 as set, 1 changed, 1 not this time'));
  c.ok('pain is noted quietly', (await training.getByRole('button', { name: /^Lower body strength/ }).textContent()).includes('Pain noted'));
  c.ok('nothing says late or overdue', !/overdue|late|behind|missed/i.test(await training.textContent()));
  c.ok('layout (client file)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/client-training-${name}.png`, fullPage: true });

  await training.getByLabel('Only workouts I set').check();
  c.ok('the filter shows only the coach-set ones', (await training.locator('.tr-item').count()) === 2);
  await training.getByLabel('Only workouts I set').uncheck();

  // Open one: what was set beside what they did, and why
  const dialog = page.getByRole('dialog');
  await training.getByRole('button', { name: /^Lower body strength/ }).click();
  await c.has('the workout opens', dialog.getByRole('heading', { name: 'Lower body strength' }));
  await c.has('what was set', dialog.getByText('Set: 4 x 6 @ 60kg'));
  await c.has('beside what they did', dialog.getByText('They did: 6 × 60 kg, 5 × 60 kg'));
  await c.has('what they logged has loaded', dialog.getByText(/Sled push: /));
  c.ok('with the status, the reason and their words', (await dialog.textContent()).includes('Changed') && (await dialog.textContent()).includes('Too tired: legs felt heavy') && (await dialog.textContent()).includes('Pain or discomfort: left knee'));
  c.ok('not this time is shown plainly', (await dialog.textContent()).includes('They did: not this time'));
  c.ok('something they added is listed too', (await dialog.textContent()).includes('Sled push'));
  c.ok('their effort and their note', (await dialog.textContent()).includes('effort 8 of 10') && (await dialog.textContent()).includes('Their note: Legs felt heavy after Monday'));
  c.ok('pain gets a calm heads-up', (await dialog.getByText(/noted pain or discomfort/).count()) === 1);
  c.ok('layout (workout)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/client-training-detail-${name}.png` });

  // Reply: free text, or one tap
  writes.length = 0;
  await dialog.getByRole('button', { name: 'Send feedback' }).click();
  await c.has('an empty reply is refused', dialog.getByText('Write a line first, or tap Looks good.'));
  c.ok('nothing was sent', writes.length === 0);
  await dialog.getByLabel('Feedback for Jamie Smith').fill('  Thanks  ');
  await dialog.getByRole('button', { name: 'Send feedback' }).click();
  await page.waitForTimeout(300);
  const fb = writes.find((w) => w.table === 'workout_assignment_feedback' && w.method === 'POST');
  c.ok('the reply is exact', fb && JSON.stringify(fb.body) === JSON.stringify({ gym_id: GYM, assignment_id: 'a-done', author_id: USER, body: 'Thanks' }));
  await c.has('it shows under feedback', dialog.getByText('Thanks').first());
  writes.length = 0;
  await dialog.getByRole('button', { name: 'Looks good' }).click();
  await page.waitForTimeout(300);
  const ok = writes.find((w) => w.table === 'workout_assignment_feedback' && w.method === 'POST');
  c.ok('Looks good sends exactly that', ok && ok.body.body === 'Looks good' && ok.body.assignment_id === 'a-done');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // A workout of their own: just what they logged, no reply box
  await training.getByRole('button', { name: /^Park run/ }).click();
  await c.has('their own workout opens', dialog.getByRole('heading', { name: 'Park run' }));
  c.ok('it says it is their own', (await dialog.textContent()).includes('their own workout'));
  c.ok('and has no feedback box', (await dialog.getByLabel('Feedback for Jamie Smith').count()) === 0);
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Take back a workout they have not started
  writes.length = 0;
  await training.getByRole('button', { name: 'Take back Upper body and core' }).click();
  await c.has('it asks first', training.getByRole('alertdialog', { name: 'Take back Upper body and core' }));
  await training.getByRole('button', { name: 'Keep' }).click();
  c.ok('keeping sends nothing', writes.length === 0);
  await training.getByRole('button', { name: 'Take back Upper body and core' }).click();
  await training.getByRole('button', { name: 'Yes, take back' }).click();
  await page.waitForTimeout(300);
  const del = writes.find((w) => w.table === 'workout_assignments' && w.method === 'DELETE');
  c.ok('the delete is scoped to that workout, this gym, the coach\'s own and not started', del && del.query.id === 'eq.a-wait' && del.query.gym_id === `eq.${GYM}` && del.query.source === 'eq.pt' && del.query.status === 'eq.todo');

  // Assign more from the file
  writes.length = 0;
  await training.getByRole('button', { name: 'Assign workouts' }).click();
  await c.has('the assign dialog opens for this client', dialog.getByRole('heading', { name: 'Assign workouts' }));
  c.ok('there is no client picker, it is Jamie', (await dialog.getByLabel('Client').count()) === 0 && (await dialog.textContent()).includes("Jamie Smith's"));
  c.ok('nothing is ticked to start', (await dialog.getByRole('group', { name: 'Workouts to assign' }).locator('input:checked').count()) === 0);
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Leg Day/).check();
  c.ok('layout (assign from the file)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Send workout' }).click();
  await c.has('sent', training.getByText('Workout sent to Jamie Smith.'));
  const asg = writes.find((w) => w.table === 'workout_assignments' && w.method === 'POST');
  c.ok('it went to Jamie, undated', asg && asg.body.length === 1 && asg.body[0].member_user_id === JAMIE && asg.body[0].source === 'pt' && !('due_at' in asg.body[0]));

  // The Client training list. Once a workout has a reply it leaves the list, so check that first, then look at one still waiting.
  await page.goto(`${base}/training`);
  await c.has('a replied workout is no longer waiting', page.getByText('Nothing waiting.'));
  replied = false;
  await page.goto(`${base}/training`);
  await c.has('Client training lists finished workouts nobody has replied to', page.getByRole('heading', { name: 'Client training', level: 1 }));
  await c.has('with the client and the workout', page.getByRole('link', { name: 'Jamie Smith, Lower body strength' }));
  c.ok('it links to their file', (await page.getByRole('link', { name: 'Jamie Smith, Lower body strength' }).getAttribute('href')) === `/members/${JAMIE}`);
  c.ok('and says how it went and notes pain', (await page.getByRole('link', { name: 'Jamie Smith, Lower body strength' }).textContent()).includes('1 changed') && (await page.getByRole('link', { name: 'Jamie Smith, Lower body strength' }).textContent()).includes('Pain noted'));
  c.ok('layout (client training)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/client-training-list-${name}.png`, fullPage: true });
  c.ok('no page errors', errors.length === 0);
  if (!c.report(`client training ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
