// Browser gate: an exercise scored two ways, on the member's workout screen. The coach named two scores (a rounds score and a time
// score here); the member sees one labelled box per score, fills both in, and what is saved is exact: each score in its own column
// (the rounds in the set's spare "custom value"), marked as a two-score exercise. Signed in as a member, phone and desktop width.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

process.env.MOCK_ROLE = 'member';
const snapshot = {
  title: 'Friday hybrid',
  blocks: [{ position: 0, title: 'Workout', activities: [
    { position: 0, activity_name: 'AMRAP 12', tracking_type: 'scores', prescription: { display: 'Record Rounds completed and Finish time', scores: [{ name: 'Rounds completed', kind: 'rounds' }, { name: 'Finish time', kind: 'time' }] }, notes: '5 pull-ups, 10 push-ups, 15 squats' },
    { position: 1, activity_name: 'Row', tracking_type: 'scores', prescription: { display: 'Record Distance and Reps', scores: [{ name: 'Metres done', kind: 'distance' }, { name: 'Reps', kind: 'reps' }] }, notes: null },
  ] }],
};
const assignment = { id: 'a1', title: 'Friday hybrid', source: 'pt', status: 'todo', scheduled_for: null, due_at: null, workout_snapshot: snapshot, focus_tags: [] };

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *')) {
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
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, path, select, method, body }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
      ? [{ status: 'active', membership_plans: { name: 'Gym Monthly', includes_classes: false, includes_open_gym: true, includes_pt: false } }]
      : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/workout_assignments')) return reply(route, method === 'GET' ? [assignment] : []);
    if (path.endsWith('/personal_bests')) { if (method === 'POST') { writes.push({ table: 'pb', body }); return reply(route, []); } return reply(route, []); }
    if (path.endsWith('/workout_entries')) { if (method === 'POST') { writes.push({ table: 'entry', body }); return reply(route, [{ id: 'e1' }]); } return reply(route, []); }
    if (path.endsWith('/workout_sets') && method === 'POST') { writes.push({ table: 'sets', body }); return reply(route, []); }
    if (path.endsWith('/workout_sessions') && method === 'POST') { writes.push({ table: 'session', body }); return reply(route, [{ id: 's9' }]); }
    return false;
  });

  await page.goto(`${base}/m/train/a1`);
  const c = runChecks();
  const region = (n) => page.getByRole('region', { name: n });
  await c.has('the workout opens', page.getByRole('heading', { name: 'Friday hybrid' }));
  await c.has('the plan says which two scores to record', region('AMRAP 12').getByText('Suggested: Record Rounds completed and Finish time'));
  c.ok('each score has its own box, labelled with its name', (await region('AMRAP 12').getByText('Rounds completed', { exact: true }).count()) === 1 && (await region('AMRAP 12').getByText('Finish time', { exact: true }).count()) === 1 && (await page.getByLabel('AMRAP 12 set 1 Rounds completed').count()) === 1 && (await page.getByRole('group', { name: 'AMRAP 12 set 1 Finish time' }).count()) === 1);
  c.ok('a time score is chosen as hours, minutes and seconds', (await page.getByRole('group', { name: 'AMRAP 12 set 1 Finish time' }).getByRole('combobox').count()) === 3);
  c.ok('the coach\'s note is shown', (await region('AMRAP 12').textContent()).includes('5 pull-ups, 10 push-ups, 15 squats'));
  c.ok('there is one row to fill in, not three', (await page.getByLabel('AMRAP 12 set 2 Rounds completed').count()) === 0);
  c.ok('layout (two scores)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/two-scores-${name}.png`, fullPage: true });

  await page.getByLabel('AMRAP 12 set 1 Rounds completed').fill('5');
  await page.getByLabel('AMRAP 12 set 1 Finish time minutes').selectOption('11');
  await page.getByLabel('AMRAP 12 set 1 Finish time seconds').selectOption('30');
  await page.getByRole('button', { name: 'Save AMRAP 12' }).click();
  await c.has('saving works and shows both scores', region('AMRAP 12').getByText('5 rounds · 11:30'));
  const entry = writes.find((w) => w.table === 'entry');
  c.ok('saved as a custom exercise for this gym', entry && entry.body.tracking_type === 'custom' && entry.body.exercise_name === 'AMRAP 12' && entry.body.gym_id === GYM);
  const sets = writes.find((w) => w.table === 'sets');
  c.ok('each score is in its own column: rounds in the custom value, time in seconds, nothing else', sets && sets.body.length === 1 && sets.body[0].custom_value === 5 && sets.body[0].custom_unit === 'rounds' && sets.body[0].duration_seconds === 690 && sets.body[0].reps === null && sets.body[0].weight_kg === null && sets.body[0].distance_m === null && sets.body[0].set_number === 1);
  c.ok('no personal best is invented from a two-score exercise', !writes.some((w) => w.table === 'pb'));

  // The second exercise: distance and reps (no rounds), marked so it is still known as a two-score exercise
  writes.length = 0;
  await page.getByLabel('Row set 1 Metres done').fill('2.5');
  await page.getByLabel('Row set 1 Reps').fill('40');
  await page.getByRole('button', { name: 'Save Row' }).click();
  await c.has('saved', region('Row').getByText('2.5 km · 40 reps').or(region('Row').getByText('40 reps · 2.5 km')));
  const sets2 = writes.find((w) => w.table === 'sets');
  c.ok('distance and reps are saved in their columns, marked as scores', sets2 && sets2.body.length === 1 && sets2.body[0].reps === 40 && sets2.body[0].distance_m === 2500 && sets2.body[0].custom_value === null && sets2.body[0].custom_unit === 'score');
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
