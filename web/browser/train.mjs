// Browser gate: the member app's Train tab on a phone and a desktop. A member whose plan includes the gym has a
// workout from their coach; they open it, fill in numbers, swap and skip, finish, and the writes are checked.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const snapshot = {
  title: 'Upper body',
  blocks: [
    { position: 0, title: 'Warm-up', activities: [{ position: 0, activity_name: 'Stretch', tracking_type: 'instruction', prescription: { display: '5 minutes' } }] },
    { position: 1, title: 'Strength', activities: [
      { position: 0, activity_name: 'Dumbbell row', tracking_type: 'strength', prescription: { display: '3 x 10' } },
      { position: 1, activity_name: 'Overhead press', tracking_type: 'strength', prescription: { display: '4 x 8' }, notes: 'Controlled' },
    ] },
  ],
};
const assignment = { id: 'a1', title: 'Upper body', source: 'pt', status: 'todo', scheduled_for: null, due_at: null, workout_snapshot: snapshot, focus_tags: ['Strength'] };

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
process.env.MOCK_ROLE = 'member';
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  let open = true;
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await mockSupabase(page, async ({ route, path, select, method, body }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
      ? [{ status: 'active', membership_plans: { name: 'Gym Monthly', includes_classes: false, includes_open_gym: true, includes_pt: false } }]
      : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/profiles')) return reply(route, [{ display_name: 'Priya Nair', first_name: 'Priya', last_name: 'Nair' }]);
    if (path.endsWith('/pt_appointments')) return reply(route, []);
    if (path.endsWith('/workout_assignments')) {
      if (method === 'PATCH') { writes.push(`PATCH assignment ${JSON.stringify(body)}`); if (body?.status === 'completed') open = false; return reply(route, []); }
      return reply(route, open ? [assignment] : []);
    }
    if (path.endsWith('/workout_entries')) {
      if (method === 'POST') { writes.push(`entry ${JSON.stringify(body)}`); return reply(route, [{ id: `e${writes.length}` }]); }
      if (method === 'DELETE') return reply(route, []);
      return reply(route, [{ exercise_name: 'Dumbbell row', created_at: '2026-10-01T10:00:00Z', workout_sets: [{ set_number: 1, weight_kg: 24, reps: 10, duration_seconds: null, distance_m: null, calories: null }, { set_number: 2, weight_kg: 24, reps: 10, duration_seconds: null, distance_m: null, calories: null }] }]);
    }
    if (path.endsWith('/personal_bests')) {
      if (method === 'POST') { writes.push(`pb ${JSON.stringify(body)}`); return reply(route, []); }
      if (method === 'DELETE') { writes.push('DELETE pb'); return reply(route, []); }
      if (select.includes('exercise_key')) return reply(route, [{ exercise_key: 'dumbbell row', metric_type: 'weight', value_numeric: 24, unit: 'kg' }]);
      return reply(route, [
        { id: 'p1', exercise_name: 'Deadlift', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 145, unit: 'kg', achieved_at: '2026-09-12T12:00:00Z', notes: null },
        { id: 'p2', exercise_name: '5k', metric_type: 'time', comparison_direction: 'lower', value_numeric: 1458, unit: 'sec', achieved_at: '2026-09-05T12:00:00Z', notes: null },
      ]);
    }
    if (path.endsWith('/workout_sets') && method === 'POST') { writes.push(`sets ${JSON.stringify(body)}`); return reply(route, []); }
    if (path.endsWith('/workout_sessions')) {
      if (method === 'POST') { writes.push(`session ${JSON.stringify(body)}`); return reply(route, [{ id: 's9' }]); }
      if (method === 'GET') return reply(route, [{ id: 's0', title: 'Lower body', performed_at: '2026-10-06T10:00:00Z' }]);
    }
    return false;
  });
  const c = runChecks();
  await page.goto(`${base}/next/#/m/today`);
  await c.has("today's workout is on top", page.getByRole('heading', { name: "Today's workout is ready" }));
  c.ok('tabs: Today, Train, Me (no classes in this plan)', (await page.getByRole('navigation', { name: 'Member' }).getByRole('link').allInnerTexts()).join('|') === 'Today|Train|Me');
  c.ok('layout (today)', (await page.evaluate(layoutProblems)).length === 0);

  await page.getByRole('link', { name: 'Start workout' }).click();
  await c.has('the workout opens', page.getByRole('heading', { name: 'Upper body' }));
  c.ok('says these are suggestions', (await page.getByText(/suggestions: change, swap or skip anything/).count()) === 1);
  c.ok('the exercises are listed with their plan', (await page.getByRole('region', { name: 'Dumbbell row' }).textContent()).includes('Suggested: 3 x 10') && (await page.getByRole('region', { name: 'Overhead press' }).textContent()).includes('Controlled'));
  c.ok('last time is shown', (await page.getByRole('region', { name: 'Dumbbell row' }).textContent()).includes('Last time: 24 kg × 10, 24 kg × 10'));
  await page.getByRole('button', { name: 'Copy last time for Dumbbell row' }).click();
  c.ok('copy last time fills the boxes', (await page.getByLabel('Dumbbell row set 1 Weight').inputValue()) === '24' && (await page.getByLabel('Dumbbell row set 2 Reps').inputValue()) === '10');
  await page.getByRole('button', { name: 'Add a set to Dumbbell row' }).click();
  await page.getByLabel('Dumbbell row set 3 Weight').fill('26');
  await page.getByLabel('Dumbbell row set 3 Reps').fill('8');
  c.ok('layout (workout)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-player-${name}.png`, fullPage: true });

  await page.reload();
  await c.has('a refresh keeps what was typed', page.getByLabel('Dumbbell row set 3 Weight'));
  c.ok('the numbers are still there', (await page.getByLabel('Dumbbell row set 3 Weight').inputValue()) === '26');

  await page.getByRole('button', { name: 'Swap Overhead press' }).click();
  await page.getByLabel('Swap Overhead press for').fill('Landmine press');
  await page.getByLabel('Landmine press set 1 Weight').fill('30');
  await page.getByLabel('Landmine press set 1 Reps').fill('8');
  await page.getByRole('button', { name: 'Left and right for Landmine press' }).click();
  c.ok('left and right shows a choice for each set', (await page.getByRole('radiogroup', { name: /^Landmine press set \d side$/ }).count()) === 3);
  await page.getByRole('radiogroup', { name: 'Landmine press set 1 side' }).getByRole('radio', { name: 'Left' }).click();
  c.ok('the choice is marked', (await page.getByRole('radiogroup', { name: 'Landmine press set 1 side' }).getByRole('radio', { name: 'Left' }).getAttribute('aria-checked')) === 'true');
  c.ok('layout (left and right)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Skip Stretch' }).click();
  c.ok('a skipped exercise says that is fine', (await page.getByText('Skipped. That is fine.').count()) === 1);
  await page.getByLabel('How hard was it').selectOption('7');
  await page.getByLabel('Notes', { exact: true }).fill('Felt good');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('back on Train with a message', page.getByText('Workout saved and marked as done.'));
  const joined = writes.join('\n');
  c.ok('one session titled from the workout', writes.filter((w) => w.startsWith('session ')).length === 1 && joined.includes('"title":"Upper body"'));
  c.ok('two exercises saved, the swap noted', writes.filter((w) => w.startsWith('entry ')).length === 2 && joined.includes('"exercise_name":"Landmine press"') && joined.includes('Swapped from Overhead press'));
  c.ok('sets saved with kilograms and reps', joined.includes('"weight_kg":26') && joined.includes('"reps":8'));
  c.ok('the side is saved on that set', joined.includes('"side":"left"'));
  c.ok('both new bests were saved: a heavier row and a first press', writes.filter((w) => w.startsWith('pb ')).length === 2 && joined.includes('"exercise_name":"Dumbbell row"') && joined.includes('"value_numeric":26') && joined.includes('"exercise_name":"Landmine press"') && joined.includes('"value_numeric":30'));
  c.ok('the screen says so', (await page.getByText('New personal bests: Dumbbell row 26 kg, Landmine press 30 kg').count()) === 1);
  c.ok('the skipped one is not saved', !joined.includes('"exercise_name":"Stretch"'));
  c.ok('the coach workout is marked done with rpe and a note', joined.includes('"status":"completed"') && joined.includes('"member_rpe":7') && joined.includes('Skipped: Stretch'));
  await c.has('the finished workout is gone from today', page.getByLabel('Today').getByText('Nothing planned.'));
  await c.has('recent workouts are listed', page.getByLabel('Recent').getByText('Lower body'));
  c.ok('layout (train)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-home-${name}.png` });

  c.ok('personal bests are listed on Train', (await page.getByLabel('Personal bests', { exact: true }).textContent()).includes('Deadlift') && (await page.getByLabel('Personal bests', { exact: true }).textContent()).includes('145 kg'));
  await page.getByRole('link', { name: 'See all' }).click();
  await c.has('the personal bests page', page.getByRole('heading', { name: 'Personal bests' }));
  c.ok('a time is shown as minutes and seconds', (await page.getByRole('article', { name: '5k' }).textContent()).includes('24:18') && (await page.getByRole('article', { name: '5k' }).textContent()).includes('lower is better'));
  c.ok('layout (personal bests)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-pbs-${name}.png` });
  writes.length = 0;
  await page.getByRole('button', { name: 'Add a personal best' }).click();
  await page.getByLabel('Value').fill('abc');
  await page.getByLabel('Exercise or event').fill('Back squat');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await c.has('a bad value is explained', page.getByRole('alert').getByText('Enter a number above zero.'));
  await page.getByLabel('Value').fill('120');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await c.has('saved by hand', page.getByText('Saved: Back squat 120 kg.'));
  c.ok('it was written', writes.some((w) => w.startsWith('pb ') && w.includes('"exercise_name":"Back squat"')));
  await page.getByRole('button', { name: 'Remove Deadlift weight' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep it' }).click();
  c.ok('keeping it deletes nothing', !writes.includes('DELETE pb'));
  await page.getByRole('button', { name: 'Remove Deadlift weight' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await c.has('removed', page.getByRole('heading', { name: 'Personal bests' }));
  c.ok('the delete was sent', writes.includes('DELETE pb'));
  await page.getByRole('link', { name: '‹ Train' }).click();
  writes.length = 0;
  await page.getByRole('link', { name: 'Start my own workout' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('nothing to save says so', page.getByText('Add some numbers first, or go back.'));
  await page.getByLabel('Exercise name').fill('Bench press');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Bench press set 1 Weight').fill('60');
  await page.getByLabel('Bench press set 1 Reps').fill('five');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('a box that is not a number is explained', page.getByRole('alert').getByText('Bench press: "five" is not a number.'));
  await page.getByLabel('Bench press set 1 Reps').fill('5');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('own workout saved', page.getByText('Workout saved.', { exact: true }));
  c.ok('no coach workout was touched', !writes.some((w) => w.startsWith('PATCH')));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
