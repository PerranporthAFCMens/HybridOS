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
const hrs = (h) => new Date(Date.now() + h * 3600000).toISOString();
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
  let unread = true;
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await mockSupabase(page, async ({ route, path, select, method, body }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
      ? [{ status: 'active', membership_plans: { name: 'Gym Monthly', includes_classes: false, includes_open_gym: true, includes_pt: false } }]
      : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/profiles')) return reply(route, [{ display_name: 'Priya Nair', first_name: 'Priya', last_name: 'Nair' }]);
    if (path.endsWith('/pt_appointments')) return reply(route, [{ id: 'pt1', starts_at: hrs(30), ends_at: hrs(31), status: 'booked' }, { id: 'pt0', starts_at: hrs(-48), ends_at: hrs(-47), status: 'completed' }, { id: 'pt9', starts_at: hrs(-200), ends_at: hrs(-199), status: 'no_show' }]);
    if (path.endsWith('/member_notifications')) {
      if (method === 'PATCH') { writes.push('PATCH notifications'); unread = false; return reply(route, []); }
      return reply(route, unread ? [{ id: 'n1', notification_type: 'workout_assigned', title: 'New workout from your coach', body: 'Upper body', related_assignment_id: 'a1', created_at: hrs(-2) }] : []);
    }
    if (path.endsWith('/workout_assignment_feedback')) return reply(route, [{ id: 'f1', assignment_id: 'a1', created_at: '2026-10-13T09:00:00Z', body: 'Good effort. Try 57.5 next time.', author_id: 'c1' }]);
    if (path.endsWith('/workout_assignments')) {
      if (method === 'PATCH') { writes.push(`PATCH assignment ${JSON.stringify(body)}`); if (body?.status === 'completed') open = false; return reply(route, []); }
      // The finished workout, as the done screen asks for it, and the "seen" lookup behind the recent list.
      if (select.includes('member_notes')) return reply(route, { id: 'a1', title: 'Upper body', completed_at: '2026-10-13T08:00:00Z', member_rpe: 7, member_notes: 'Felt good', feedback_seen_at: null, result: { version: 1, exercises: [{ name: 'Dumbbell row', plan: '3 x 10', status: 'as_set' }, { name: 'Overhead press', plan: '4 x 8', status: 'changed', swappedTo: 'Landmine press', reason: 'no_equipment' }, { name: 'Stretch', plan: '5 minutes', status: 'not_this_time', reason: 'out_of_time', note: 'ran out of time' }] } });
      if (select.includes('feedback_seen_at')) return reply(route, [{ id: 'a1', feedback_seen_at: null }]);
      return reply(route, open ? [assignment] : []);
    }
    if (path.endsWith('/workout_entries')) {
      if (method === 'POST') { writes.push(`entry ${JSON.stringify(body)}`); return reply(route, [{ id: `e${writes.length}` }]); }
      if (method === 'DELETE') { writes.push('DELETE entry'); return reply(route, []); }
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
      if (method === 'GET') return reply(route, [{ id: 's0', title: 'Lower body', performed_at: '2026-10-06T10:00:00Z', assignment_id: 'a1' }]);
    }
    return false;
  });
  const c = runChecks();
  await page.goto(`${base}/m/today`);
  await c.has('the coach\'s workout is on top, in the coach\'s words', page.getByRole('heading', { name: 'Your coach has a workout for you' }));
  await c.has('a new-workout notice on Today', page.getByRole('region', { name: 'New from your coach' }).getByText('A new workout'));
  c.ok('and a badge on the Workouts tab', (await page.getByRole('navigation', { name: 'Member' }).getByLabel('1 new from your coach').count()) === 1);
  c.ok('tabs: Today, Workouts, Community, Me (no classes in this plan)', (await page.getByRole('navigation', { name: 'Member' }).getByRole('link').allInnerTexts()).map((t) => t.replace(/\d+$/, '')).join('|') === 'Today|Workouts|Community|Me');
  c.ok('layout (today)', (await page.evaluate(layoutProblems)).length === 0);

  // The coach's workouts wait in their own list on Workouts, with no days. Looking at it clears the notice.
  await page.getByRole('navigation', { name: 'Member' }).getByRole('link', { name: /^Workouts/ }).click();
  await c.has('From your coach lists it with no deadline', page.getByRole('region', { name: 'From your coach' }).getByText('Waiting for you'));
  c.ok('it says to do them whenever', (await page.getByText('Do them whenever suits you.').count()) === 1);
  await page.waitForTimeout(400);
  c.ok('looking at the list cleared the notice', writes.includes('PATCH notifications') && (await page.getByRole('navigation', { name: 'Member' }).getByLabel('1 new from your coach').count()) === 0);
  c.ok('layout (from your coach)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-from-coach-${name}.png`, fullPage: true });
  writes.length = 0;
  await page.getByRole('link', { name: 'Open Upper body' }).click();
  await c.has('the workout opens', page.getByRole('heading', { name: 'Upper body' }));
  c.ok('says these are suggestions', (await page.getByText(/suggestions: change, swap or skip anything/).count()) === 1);
  c.ok('the exercises are listed with their plan', (await page.getByRole('region', { name: 'Dumbbell row' }).textContent()).includes('Suggested: 3 x 10') && (await page.getByRole('region', { name: 'Overhead press' }).textContent()).includes('Controlled'));
  c.ok('last time is shown', (await page.getByRole('region', { name: 'Dumbbell row' }).textContent()).includes('Last time: 10 × 24 kg, 10 × 24 kg'));
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

  await page.getByRole('button', { name: 'Save Dumbbell row' }).click();
  await c.has('an exercise can be saved on its own', page.getByRole('region', { name: 'Dumbbell row' }).getByText('Saved', { exact: true }));
  c.ok('that wrote the workout and the exercise straight away', writes.filter((w) => w.startsWith('session ')).length === 1 && writes.filter((w) => w.startsWith('entry ')).length === 1 && writes.some((w) => w.startsWith('sets ')));
  c.ok('the saved numbers are shown', (await page.getByRole('region', { name: 'Dumbbell row' }).textContent()).includes('10 × 24 kg'));
  await page.getByRole('button', { name: 'Swap Overhead press' }).click();
  await page.getByLabel('Swap Overhead press for').fill('Landmine press');
  await page.getByLabel('Landmine press set 1 Weight').fill('30');
  await page.getByLabel('Landmine press set 1 Reps').fill('8');
  await page.getByRole('button', { name: 'Left and right for Landmine press' }).click();
  c.ok('left and right shows a choice for each set', (await page.getByRole('radiogroup', { name: /^Landmine press set \d side$/ }).count()) === 3);
  await page.getByRole('radiogroup', { name: 'Landmine press set 1 side' }).getByRole('radio', { name: 'Left' }).click();
  c.ok('the choice is marked', (await page.getByRole('radiogroup', { name: 'Landmine press set 1 side' }).getByRole('radio', { name: 'Left' }).getAttribute('aria-checked')) === 'true');
  c.ok('layout (left and right)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Remove set 3 from Landmine press' }).click();
  c.ok('a set can be taken out, and the rest renumber', (await page.getByLabel('Landmine press set 3 Weight').count()) === 0 && (await page.getByLabel('Landmine press set 2 Weight').count()) === 1 && (await page.getByRole('radiogroup', { name: /^Landmine press set \d side$/ }).count()) === 2);
  await page.getByRole('button', { name: 'Remove set 2 from Landmine press' }).click();
  c.ok('the last set cannot be removed', (await page.getByRole('button', { name: /^Remove set \d from Landmine press$/ }).count()) === 0 && (await page.getByLabel('Landmine press set 1 Weight').inputValue()) === '30');
  await page.getByRole('region', { name: 'Dumbbell row' }).getByRole('radio', { name: 'As set' }).click();
  c.ok('"As set" is marked', (await page.getByRole('region', { name: 'Dumbbell row' }).getByRole('radio', { name: 'As set' }).getAttribute('aria-checked')) === 'true');
  await page.getByRole('group', { name: 'Why Landmine press was different' }).getByRole('radio', { name: 'No equipment' }).click();
  await page.getByRole('button', { name: 'Skip Stretch' }).click();
  c.ok('a skipped exercise says that is fine', (await page.getByText('Not this time. That is fine.').count()) === 1);
  await page.getByRole('group', { name: 'Why Stretch was different' }).getByRole('radio', { name: 'Out of time' }).click();
  await page.getByLabel('A few words about Stretch').fill('ran out of time');
  c.ok('layout (what happened)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-reasons-${name}.png`, fullPage: true });
  await page.getByLabel('How hard was it').selectOption('7');
  await page.getByLabel('Notes', { exact: true }).fill('Felt good');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('back on Workouts with a message', page.getByText('Workout saved and marked as done.'));
  const joined = writes.join('\n');
  c.ok('one session titled from the workout', writes.filter((w) => w.startsWith('session ')).length === 1 && joined.includes('"title":"Upper body"'));
  c.ok('two exercises saved, the swap noted', writes.filter((w) => w.startsWith('entry ')).length === 2 && joined.includes('"exercise_name":"Landmine press"') && joined.includes('Swapped from Overhead press'));
  c.ok('sets saved with kilograms and reps', joined.includes('"weight_kg":26') && joined.includes('"reps":8'));
  c.ok('the side is saved on that set', joined.includes('"side":"left"'));
  c.ok('both new bests were saved: a heavier row and a first press', writes.filter((w) => w.startsWith('pb ')).length === 2 && joined.includes('"exercise_name":"Dumbbell row"') && joined.includes('"value_numeric":26') && joined.includes('"exercise_name":"Landmine press"') && joined.includes('"value_numeric":30'));
  c.ok('the screen says so', (await page.getByText('New personal bests: Dumbbell row 26 kg, Landmine press 30 kg').count()) === 1);
  c.ok('the skipped one is not saved', !joined.includes('"exercise_name":"Stretch"'));
  c.ok('the coach workout is marked done with rpe and a note', joined.includes('"status":"completed"') && joined.includes('"member_rpe":7') && joined.includes('Skipped: Stretch'));
  c.ok('the finished workout is tied to the one the coach set', writes.filter((w) => w.startsWith('session ')).every((w) => w.includes('"assignment_id":"a1"')));
  c.ok('the report says what changed and why', joined.includes('"status":"as_set"') && joined.includes('"status":"changed"') && joined.includes('"swappedTo":"Landmine press"') && joined.includes('"reason":"no_equipment"') && joined.includes('"status":"not_this_time"') && joined.includes('"reason":"out_of_time"') && joined.includes('"note":"ran out of time"') && joined.includes('"plan":"3 x 10"'));
  await c.has('the finished workout is gone from the coach list', page.getByLabel('Today').getByText('Start your own workout whenever you like.'));
  c.ok('From your coach is gone with nothing waiting', (await page.getByRole('region', { name: 'From your coach' }).count()) === 0);
  await c.has('recent workouts are listed, the coach\'s outlined with a new-feedback marker', page.getByRole('link', { name: 'Lower body, set by your coach' }).getByText('New feedback'));
  c.ok('layout (train)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-home-${name}.png` });
  writes.length = 0;
  await page.getByRole('link', { name: 'Lower body, set by your coach' }).click();
  await c.has('a finished coach workout opens', page.getByRole('region', { name: 'What you recorded' }));
  c.ok('it lists each exercise with its status', (await page.getByRole('region', { name: 'What you recorded' }).textContent()).includes('Dumbbell row') && (await page.getByRole('region', { name: 'What you recorded' }).textContent()).includes('As set') && (await page.getByRole('region', { name: 'What you recorded' }).textContent()).includes('Overhead press → Landmine press') && (await page.getByRole('region', { name: 'What you recorded' }).textContent()).includes('Not this time'));
  c.ok('with the reason and their words', (await page.getByRole('region', { name: 'What you recorded' }).textContent()).includes('No equipment') && (await page.getByRole('region', { name: 'What you recorded' }).textContent()).includes('Out of time: ran out of time'));
  await c.has('the coach\'s reply is there', page.getByRole('region', { name: 'From your coach' }).getByText('Good effort. Try 57.5 next time.'));
  await page.waitForTimeout(400);
  c.ok('reading it marks the feedback as seen', writes.some((w) => w.startsWith('PATCH assignment') && w.includes('feedback_seen_at')));
  c.ok('layout (a finished coach workout)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/train-done-${name}.png`, fullPage: true });
  await page.getByRole('link', { name: '‹ Workouts' }).click();

  c.ok('personal bests are listed on Workouts', (await page.getByLabel('Personal bests', { exact: true }).textContent()).includes('Deadlift') && (await page.getByLabel('Personal bests', { exact: true }).textContent()).includes('145 kg'));
  c.ok('a PT card with the next session', (await page.getByLabel('Personal training').textContent()).includes('Next session'));
  await page.getByLabel('Personal training').getByRole('link', { name: 'See all' }).click();
  await c.has('the PT page', page.getByRole('heading', { name: 'Personal training' }));
  c.ok('coming up has one session of 60 minutes', (await page.getByLabel('Coming up').textContent()).includes('60 min'));
  c.ok('past sessions say done and missed', (await page.getByLabel('Past sessions').textContent()).includes('Done') && (await page.getByLabel('Past sessions').textContent()).includes('Missed'));
  c.ok('and who to ask to move one', (await page.getByText('To move or cancel a session, ask your coach.').count()) === 1);
  c.ok('layout (PT)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('link', { name: '‹ Workouts' }).click();
  await page.getByLabel('Personal bests', { exact: true }).getByRole('link', { name: 'See all' }).click();
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
  await page.getByRole('link', { name: '‹ Workouts' }).click();
  writes.length = 0;
  await page.getByRole('link', { name: 'Start my own workout' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('nothing to save says so', page.getByText('Add some numbers first, or go back.'));
  await page.getByLabel('Exercise name', { exact: true }).fill('bench');
  c.ok('suggestions appear as you type', (await page.getByRole('listbox', { name: 'Exercise name suggestions' }).getByRole('option').allInnerTexts()).includes('Barbell Bench Press'));
  if (shots) await page.screenshot({ path: `${shots}/train-suggest-${name}.png` });
  await page.getByLabel('Exercise name', { exact: true }).fill('dumbbell r');
  c.ok('your own exercises come first', (await page.getByRole('listbox', { name: 'Exercise name suggestions' }).getByRole('option').first().innerText()) === 'Dumbbell row');
  await page.getByLabel('Exercise name', { exact: true }).fill('pla');
  await page.getByRole('option', { name: 'Plank', exact: true }).click();
  c.ok('picking one fills the name', (await page.getByLabel('Exercise name', { exact: true }).inputValue()) === 'Plank');
  c.ok('and a plank is timed', (await page.getByLabel('What to record').inputValue()) === 'time');
  await page.getByLabel('Exercise name', { exact: true }).fill('Bench press');
  await page.keyboard.press('Escape');
  c.ok('typing a weights exercise goes back to weight and reps', (await page.getByLabel('What to record').inputValue()) === 'strength');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Bench press set 1 Weight').fill('60');
  await page.getByLabel('Bench press set 1 Reps').fill('five');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('a box that is not a number is explained', page.getByRole('alert').getByText('Bench press: "five" is not a number.'));
  await page.getByLabel('Bench press set 1 Reps').fill('5');
  await page.getByRole('button', { name: 'Save Bench press' }).click();
  await c.has('saved on its own', page.getByRole('region', { name: 'Bench press' }).getByText('Saved', { exact: true }));
  await page.getByRole('button', { name: 'Change Bench press' }).click();
  await c.has('change reopens it', page.getByLabel('Bench press set 1 Reps'));
  c.ok('and took it back out', writes.includes('DELETE entry'));
  await page.getByLabel('Exercise name', { exact: true }).fill('Squat');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await c.has('a second exercise is added', page.getByRole('region', { name: 'Squat' }));
  c.ok('an exercise you added says Remove, not Skip', (await page.getByRole('button', { name: 'Skip Squat' }).count()) === 0);
  await page.getByRole('button', { name: 'Remove Squat' }).click();
  c.ok('and Remove takes it out of the workout', (await page.getByRole('region', { name: 'Squat' }).count()) === 0);
  c.ok('the other one stays', (await page.getByRole('region', { name: 'Bench press' }).count()) === 1);
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('own workout saved', page.getByText('Workout saved.', { exact: true }));
  c.ok('no coach workout was touched', !writes.some((w) => w.startsWith('PATCH')));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
