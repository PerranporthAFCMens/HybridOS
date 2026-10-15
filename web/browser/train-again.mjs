// Browser gate: a member opens a past workout from Recent, sees what they recorded, and does it again with the old numbers
// as the starting point. Checks the writes: a new workout with today's numbers, and nothing else touched.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const browser = await launch();
let allOk = true;
process.env.MOCK_ROLE = 'member';
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await mockSupabase(page, async ({ route, path, select, method, body }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
      ? [{ status: 'active', membership_plans: { name: 'Gym Monthly', includes_classes: false, includes_open_gym: true, includes_pt: false } }]
      : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/profiles')) return reply(route, [{ display_name: 'Priya Nair', first_name: 'Priya', last_name: 'Nair' }]);
    if (path.endsWith('/workout_sessions')) {
      if (method === 'POST') { writes.push(`session ${JSON.stringify(body)}`); return reply(route, [{ id: 's9' }]); }
      // One workout, as the detail screen asks for it (a single row), and as the Recent list asks for it (a list).
      if (select.includes('notes')) return reply(route, { id: 's1', title: 'Leg day with a rather long workout name', performed_at: '2026-10-14T10:00:00Z', notes: 'Felt strong' });
      return reply(route, [{ id: 's1', title: 'Leg day with a rather long workout name', performed_at: '2026-10-14T10:00:00Z', assignment_id: null }]);
    }
    if (path.endsWith('/workout_entries')) {
      if (method === 'POST') { writes.push(`entry ${JSON.stringify(body)}`); return reply(route, [{ id: `e${writes.length}` }]); }
      if (select.includes('workout_sets')) return reply(route, []);
      return reply(route, [{ id: 'e1', exercise_name: 'Back squat', tracking_type: 'strength', notes: null, position: 0 }, { id: 'e2', exercise_name: 'Plank', tracking_type: 'time', notes: 'Shaky', position: 1 }]);
    }
    if (path.endsWith('/workout_sets')) {
      if (method === 'POST') { writes.push(`sets ${JSON.stringify(body)}`); return reply(route, []); }
      return reply(route, [
        { entry_id: 'e1', set_number: 1, reps: 8, weight_kg: 50, duration_seconds: null, distance_m: null, calories: null, custom_value: null, custom_unit: null, side: null },
        { entry_id: 'e1', set_number: 2, reps: 8, weight_kg: 52.5, duration_seconds: null, distance_m: null, calories: null, custom_value: null, custom_unit: null, side: null },
        { entry_id: 'e2', set_number: 1, reps: null, weight_kg: null, duration_seconds: 60, distance_m: null, calories: null, custom_value: null, custom_unit: null, side: null },
      ]);
    }
    if (path.endsWith('/personal_bests')) return reply(route, method === 'POST' ? [] : []);
    return false;
  });
  const c = runChecks();
  await page.goto(`${base}/m/train`);
  await page.getByRole('link', { name: /^Leg day with a rather long workout name/ }).click();
  await c.has('the past workout opens with its name', page.getByRole('heading', { name: 'Leg day with a rather long workout name' }));
  await c.has('each exercise is listed', page.getByRole('region', { name: 'Back squat' }));
  c.ok('with the sets that were recorded', (await page.getByRole('region', { name: 'Back squat' }).getByText(/Set \d/).count()) === 2);
  c.ok('and the note', (await page.getByText('Note: Shaky').count()) === 1);
  c.ok('layout (past workout)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.getByRole('link', { name: 'Do it again' }).click();
  await c.has('it starts a new workout saying where it came from', page.getByText(/^Copied from Leg day/));
  c.ok('with last time\'s weight in the box', (await page.getByLabel('Back squat set 1 Weight').inputValue()) === '50');
  c.ok('and last time\'s reps', (await page.getByLabel('Back squat set 2 Reps').inputValue()) === '8');
  await page.getByLabel('Back squat set 1 Weight').fill('55');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('it saves as a new workout', page.getByText('Workout saved.', { exact: true }));
  c.ok('the new workout has the old name', writes.some((w) => w.startsWith('session') && w.includes('Leg day with a rather long workout name')));
  c.ok('and today\'s weight', writes.some((w) => w.startsWith('sets') && w.includes('"weight_kg":55')));
  c.ok('and nothing was marked done on a coach workout', !writes.some((w) => w.startsWith('PATCH')));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
