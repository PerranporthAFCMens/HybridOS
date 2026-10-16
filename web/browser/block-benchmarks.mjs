// Browser gate: block benchmarks. An owner opens a block, adds a movement to test with a start day, an end day and which result is
// better, and removes it again. Wrong forms are refused in plain words with nothing sent. Signed in as an owner, at phone and desktop
// width. Supabase is mocked at the network layer; the exact request of each write is checked.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const gymToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const plus = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const movements = [
  { id: 'mv1', name: '1 km Row', video_url: null, cue: null, default_tracking: 'time', is_active: true },
  { id: 'mv2', name: 'Back Squat', video_url: null, cue: null, default_tracking: 'strength', is_active: true },
  { id: 'mv3', name: 'Old Move', video_url: null, cue: null, default_tracking: 'reps', is_active: false },
];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  let benchmarks = [{ id: 'b1', block_id: 'blk1', movement_id: 'mv2', test_start_on: gymToday, test_end_on: plus(gymToday, 35), better: 'higher', created_at: '2026-10-16T09:00:00Z', movements: { name: 'Back Squat', default_tracking: 'strength' } }];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/class_blocks')) return reply(route, [{ id: 'blk1', name: 'Hybrid Uppers', starts_on: gymToday, weeks: 6 }]);
    if (path.endsWith('/movements')) return reply(route, movements);
    if (path.endsWith('/movement_levels')) return reply(route, []);
    if (path.endsWith('/block_benchmarks')) {
      if (method === 'POST') {
        writes.push({ method, body });
        benchmarks = [...benchmarks, { id: 'b2', block_id: body.block_id, movement_id: body.movement_id, test_start_on: body.test_start_on, test_end_on: body.test_end_on, better: body.better, created_at: '2026-10-16T10:00:00Z', movements: { name: '1 km Row', default_tracking: 'time' } }];
        await route.fulfill({ status: 201, body: '' });
        return true;
      }
      if (method === 'DELETE') {
        writes.push({ method, query: Object.fromEntries(url.searchParams) });
        benchmarks = benchmarks.filter((b) => `eq.${b.id}` !== url.searchParams.get('id'));
        await route.fulfill({ status: 204, body: '' });
        return true;
      }
      return reply(route, benchmarks);
    }
    if (path.endsWith('/class_block_sessions')) return reply(route, []);
    if (path.endsWith('/class_session_workouts')) return reply(route, []);
    if (path.endsWith('/rpc/get_class_calendar')) return reply(route, []);
    return false;
  });

  await page.goto(`${base}/classes`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Blocks', exact: true }).click();
  await dialog.getByRole('button', { name: 'Open Hybrid Uppers' }).click();
  const section = dialog.getByRole('region', { name: 'Benchmarks' });
  await c.has('the block shows its benchmarks', section.getByText('Back Squat'));
  c.ok('with both test days and which result is better', (await section.getByText(/Start test .* · End test .* · Higher is better/).count()) === 1);
  c.ok('a movement already tested is not offered again, a switched-off one never is', (await section.getByLabel('Movement to test').getByRole('option').allTextContents()).join('|') === 'Choose a movement|1 km Row');
  c.ok('looking wrote nothing', writes.length === 0);

  // Refused forms send nothing
  await section.getByRole('button', { name: 'Add benchmark' }).click();
  await c.has('a movement is needed', section.getByText('Choose the movement to test.'));
  await section.getByLabel('Movement to test').selectOption('mv1');
  c.ok('a time is better when lower', (await section.getByLabel('Which result is better').inputValue()) === 'lower');
  await section.getByLabel('End test opens').fill(gymToday);
  await section.getByRole('button', { name: 'Add benchmark' }).click();
  await c.has('the end test must come after the start', section.getByText('The end test must come after the start test.'));
  await section.getByLabel('End test opens').fill(plus(gymToday, 80));
  await section.getByRole('button', { name: 'Add benchmark' }).click();
  await c.has('a test outside the block is refused', section.getByText('The end test must open inside the block.'));
  c.ok('nothing was written for refused forms', writes.length === 0);

  // A good one
  await section.getByLabel('End test opens').fill(plus(gymToday, 35));
  await section.getByRole('button', { name: 'Add benchmark' }).click();
  await c.has('it is added', section.getByText('Benchmark added.'));
  await c.has('and listed', section.getByText('1 km Row'));
  const made = writes.find((w) => w.method === 'POST');
  c.ok('the request is exact: this gym, this block, the movement, both days, lower is better, who', made && made.body.gym_id === GYM && made.body.block_id === 'blk1' && made.body.movement_id === 'mv1' && made.body.test_start_on === gymToday && made.body.test_end_on === plus(gymToday, 35) && made.body.better === 'lower' && made.body.created_by === USER);

  // Remove
  await section.getByRole('button', { name: 'Remove Back Squat' }).click();
  await page.waitForTimeout(300);
  const del = writes.find((w) => w.method === 'DELETE');
  c.ok('removing deletes only that benchmark', del && del.query.id === 'eq.b1');
  c.ok('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  c.ok('no page errors', errors.length === 0);
  if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
  if (!c.report(`block benchmarks ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
