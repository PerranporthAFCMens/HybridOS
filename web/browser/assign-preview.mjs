// Browser gate: assigning a workout shows the coach the kilos the client will see for weights set as a percentage of their best,
// worked out from that client's own bests (a client with no best is flagged). Switching client changes the numbers; a workout with
// only plain kilos shows no preview. Signed in as an owner, phone and desktop width. Supabase is mocked at the network layer.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const templates = [
  { id: 't-sq', title: 'Squat day', description: null, workout_type: 'strength', focus_tags: [], estimated_minutes: null, visibility: 'private' },
  { id: 't-plain', title: 'Plain day', description: null, workout_type: 'strength', focus_tags: [], estimated_minutes: null, visibility: 'private' },
];
const blocks = { 't-sq': [{ id: 'b1', title: 'Workout', block_type: 'standard', position: 0, rounds: null, instructions: null }], 't-plain': [{ id: 'b2', title: 'Workout', block_type: 'standard', position: 0, rounds: null, instructions: null }] };
const activities = {
  b1: [
    { id: 'a1', block_id: 'b1', activity_name: 'Back Squat', activity_type: 'exercise', tracking_type: 'strength', position: 0, prescription: { display: '3 sets: 5 × 80%', sets: [{ reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }, { reps: '5', weight: '80%' }] }, notes: null },
    { id: 'a2', block_id: 'b1', activity_name: 'Bench Press', activity_type: 'exercise', tracking_type: 'strength', position: 1, prescription: { display: '5 × 75%', sets: [{ reps: '8', weight: '75%' }] }, notes: null },
    { id: 'a3', block_id: 'b1', activity_name: 'Deadlift', activity_type: 'exercise', tracking_type: 'strength', position: 2, prescription: { display: '3 × 100 kg', sets: [{ reps: '3', weight: '100' }] }, notes: null },
  ],
  b2: [{ id: 'a4', block_id: 'b2', activity_name: 'Deadlift', activity_type: 'exercise', tracking_type: 'strength', position: 0, prescription: { display: '3 × 100 kg', sets: [{ reps: '3', weight: '100' }] }, notes: null }],
};
const bests = {
  'u-amy': [{ id: 'p1', exercise_name: 'Back Squat', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 140, unit: 'kg', achieved_at: '2026-09-01T10:00:00Z', notes: null }, { id: 'p2', exercise_name: 'Bench Press', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 82.5, unit: 'kg', achieved_at: '2026-09-02T10:00:00Z', notes: null }],
  'u-ben': [{ id: 'p3', exercise_name: 'Back Squat', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 100, unit: 'kg', achieved_at: '2026-09-01T10:00:00Z', notes: null }],
};

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
  const pbRequests = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path }) => {
    if (path.endsWith('/workout_templates')) return reply(route, templates);
    if (path.endsWith('/workout_template_blocks')) return reply(route, blocks[(url.searchParams.get('template_id') ?? '').replace('eq.', '')] ?? []);
    if (path.endsWith('/workout_template_activities')) return reply(route, (blocks[(url.searchParams.get('template_id') ?? '').replace('eq.', '')] ?? []).flatMap((b) => activities[b.id] ?? []));
    if (path.endsWith('/members')) return reply(route, [{ user_id: 'u-amy', display_name: 'Amy Active', first_name: null, last_name: null, email: null }, { user_id: 'u-ben', display_name: 'Ben Lifter', first_name: null, last_name: null, email: null }]);
    if (path.endsWith('/personal_bests')) {
      const u = (url.searchParams.get('user_id') ?? '').replace('eq.', '');
      pbRequests.push({ user: u, gym: url.searchParams.get('gym_id') });
      return reply(route, bests[u] ?? []);
    }
    return false;
  });
  await page.goto(`${base}/workouts`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('library lists workouts', page.getByText('Squat day'));
  await page.getByRole('button', { name: 'Open Squat day' }).click();
  await c.has('editor loaded', page.getByLabel('Workout name'));
  await page.getByRole('button', { name: 'Assign to member' }).click();
  await dialog.getByLabel('Client').waitFor();

  // First client (Amy): her own bests
  const preview = dialog.getByRole('region', { name: 'What Amy Active will see' });
  await c.has('a preview of what the client will see', preview);
  const items = await preview.locator('li').allInnerTexts();
  c.ok('percentages become that client\'s kilos, in the words she will read', items.length === 2 && items[0] === 'Back Squat: 3 sets: 5 × 80% (112 kg)' && items[1] === 'Bench Press: 8 × 75% (62 kg)');
  c.ok('plain kilos are not previewed', !(await preview.textContent()).includes('Deadlift'));
  c.ok('nobody is missing a best, so no warning', (await preview.getByRole('status').count()) === 0);
  c.ok('the bests were asked for this client in this gym only', pbRequests.length > 0 && pbRequests.every((r) => r.gym === `eq.${GYM}`) && pbRequests.some((r) => r.user === 'u-amy'));
  c.ok('layout (preview)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/assign-preview-${name}.png` });

  // Second client (Ben): one best missing
  await dialog.getByLabel('Client').selectOption('u-ben');
  const benPreview = dialog.getByRole('region', { name: 'What Ben Lifter will see' });
  await c.has('the preview changes with the client', benPreview);
  const benItems = await benPreview.locator('li').allInnerTexts();
  c.ok('Ben\'s own best gives his kilos, and a missing best says so', benItems.length === 2 && benItems[0] === 'Back Squat: 3 sets: 5 × 80% (80 kg)' && benItems[1] === 'Bench Press: 8 × 75% (no best recorded yet)');
  await c.has('and says he will fill in the weight himself', benPreview.getByText('Ben Lifter has no best yet for Bench Press, so they will fill in the weight themselves.'));

  // A workout with only plain kilos shows no preview
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Squat day/).uncheck();
  await dialog.getByRole('group', { name: 'Workouts to assign' }).getByLabel(/^Plain day/).check();
  await page.waitForTimeout(400);
  c.ok('a workout with only plain kilos has no preview', (await dialog.getByRole('region', { name: /will see/ }).count()) === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
