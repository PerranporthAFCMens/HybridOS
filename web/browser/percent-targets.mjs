// Browser gate: percentage targets on the member's workout screen. A coach's plan can say "80%" instead of kilos. The member's
// app turns it into kilos from their heaviest recorded lift for that exercise (to the nearest 1 kg), says so in words, fills the
// boxes on "As set", and says plainly when there is no best yet. The member can change any number; what is saved is kilos.
// Signed in as a member, phone and desktop width. Supabase is mocked at the network layer.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

process.env.MOCK_ROLE = 'member';
const snapshot = {
  title: 'Squat day',
  blocks: [{ position: 0, title: 'Strength', activities: [
    { position: 0, activity_name: 'Back Squat', tracking_type: 'strength', prescription: { display: '3 sets: 5 × 80%', sets: [{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }] } },
    { position: 1, activity_name: 'Overhead Press', tracking_type: 'strength', prescription: { display: '5 × 70% / 3 × 80', sets: [{ reps: '5', weight: '70%' }, { reps: '3', weight: '80' }] } },
    { position: 2, activity_name: 'Bench Press', tracking_type: 'strength', prescription: { display: '5 × 75%', sets: [{ reps: '5', weight: '75%' }] } },
    { position: 3, activity_name: 'Push-up', tracking_type: 'reps', prescription: { display: 'max reps / 8–12 reps', sets: [{ reps: 'max' }, { reps: '8-12' }] } },
  ] }],
};
const assignment = { id: 'a1', title: 'Squat day', source: 'pt', status: 'todo', scheduled_for: null, due_at: null, workout_snapshot: snapshot, focus_tags: [] };
const pbs = [
  { id: 'p1', exercise_name: 'Back Squat', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 100, unit: 'kg', achieved_at: '2026-09-12T12:00:00Z', notes: null },
  { id: 'p2', exercise_name: 'Back Squat', metric_type: 'reps', comparison_direction: 'higher', value_numeric: 30, unit: 'reps', achieved_at: '2026-09-13T12:00:00Z', notes: null },
  { id: 'p3', exercise_name: 'Overhead Press', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 62.5, unit: 'kg', achieved_at: '2026-09-14T12:00:00Z', notes: null },
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *')) {
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
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, path, select, method, body }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
      ? [{ status: 'active', membership_plans: { name: 'Gym Monthly', includes_classes: false, includes_open_gym: true, includes_pt: false } }]
      : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/workout_assignments')) return reply(route, method === 'GET' ? [assignment] : []);
    if (path.endsWith('/personal_bests')) {
      if (method === 'POST') { writes.push({ table: 'pb', body }); return reply(route, []); }
      if (select.includes('exercise_key')) return reply(route, []);
      return reply(route, pbs);
    }
    if (path.endsWith('/workout_entries')) { if (method === 'POST') { writes.push({ table: 'entry', body }); return reply(route, [{ id: 'e1' }]); } return reply(route, []); }
    if (path.endsWith('/workout_sets') && method === 'POST') { writes.push({ table: 'sets', body }); return reply(route, []); }
    if (path.endsWith('/workout_sessions') && method === 'POST') { writes.push({ table: 'session', body }); return reply(route, [{ id: 's9' }]); }
    return false;
  });

  await page.goto(`${base}/m/train/a1`);
  const c = runChecks();
  await c.has('the workout opens', page.getByRole('heading', { name: 'Squat day' }));
  const region = (n) => page.getByRole('region', { name: n });
  await page.waitForFunction(() => document.body.textContent.includes('(80 kg)'));
  c.ok('a percentage is shown with the kilos it means (100 kg best, heaviest weight, not the reps best)', (await region('Back Squat').textContent()).includes('Suggested: 3 sets: 5 × 80% (80 kg)'));
  c.ok('rounded to the nearest 1 kg (70% of 62.5 is 43.75), with a plain kilo set left alone', (await region('Overhead Press').textContent()).includes('Suggested: 5 × 70% (44 kg) / 3 × 80 kg'));
  c.ok('no best yet says so, twice', (await region('Bench Press').textContent()).includes('5 × 75% (no best recorded yet)') && (await region('Bench Press').textContent()).includes('You have no best recorded for Bench Press yet, so fill in the weight you use.'));
  c.ok('and a lift that has a best does not say it', !(await region('Back Squat').textContent()).includes('no best recorded'));
  c.ok('looking wrote nothing', writes.length === 0);
  c.ok('layout (percent plan)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/percent-targets-${name}.png`, fullPage: true });

  await region('Back Squat').getByRole('radio', { name: 'As set' }).click();
  c.ok('"As set" fills in the kilos, three sets', (await page.getByLabel('Back Squat set 1 Weight').inputValue()) === '80' && (await page.getByLabel('Back Squat set 3 Weight').inputValue()) === '80' && (await page.getByLabel('Back Squat set 2 Reps').inputValue()) === '5');
  await page.getByLabel('Back Squat set 1 Weight').fill('82.5');
  c.ok('and the member can go up or down', (await page.getByLabel('Back Squat set 1 Weight').inputValue()) === '82.5' && (await page.getByLabel('Back Squat set 2 Weight').inputValue()) === '80');
  await region('Overhead Press').getByRole('radio', { name: 'As set' }).click();
  c.ok('a mix gives kilos for the percentage and the plain weight as it was', (await page.getByLabel('Overhead Press set 1 Weight').inputValue()) === '44' && (await page.getByLabel('Overhead Press set 2 Weight').inputValue()) === '80');
  await region('Bench Press').getByRole('radio', { name: 'As set' }).click();
  c.ok('with no best the weight box is empty and the reps are in', (await page.getByLabel('Bench Press set 1 Weight').inputValue()) === '' && (await page.getByLabel('Bench Press set 1 Reps').inputValue()) === '5');
  await page.getByLabel('Bench Press set 1 Weight').fill('60');

  // Reps that are a range or "max": shown as set, never filled in for the member
  c.ok('a "max" and a range are worded for the member', (await region('Push-up').textContent()).includes('Suggested: max reps / 8–12 reps'));
  await region('Push-up').getByRole('radio', { name: 'As set' }).click();
  c.ok('"As set" leaves the reps for the member to fill in', (await page.getByLabel('Push-up set 1 Reps').inputValue()) === '' && (await page.getByLabel('Push-up set 2 Reps').inputValue()) === '');
  await page.getByLabel('Push-up set 1 Reps').fill('23');

  await page.getByRole('button', { name: 'Save Back Squat' }).click();
  await c.has('saving works', region('Back Squat').getByText('Saved', { exact: true }));
  const sets = writes.find((w) => w.table === 'sets');
  c.ok('what is saved is kilos, never a percentage', sets && sets.body.length === 3 && sets.body[0].weight_kg === 82.5 && sets.body[1].weight_kg === 80 && sets.body[0].reps === 5 && !JSON.stringify(sets.body).includes('%'));
  c.ok('and a new best is recorded from it', writes.some((w) => w.table === 'pb' && JSON.stringify(w.body).includes('82.5')));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
