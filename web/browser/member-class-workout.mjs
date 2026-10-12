// Browser gate: a member opens the workout their coach made available for a class they were in, fills in what they did
// ("As set" puts the coach's numbers in the boxes), and keeps it. Phone and desktop. Supabase is mocked at the network layer.
// Checks what is listed (recent classes only), that the class workout is the member's own record (nothing is marked on an
// assignment, no review questions), the exact writes, and that a second visit says it is already recorded.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const hrs = (h) => new Date(Date.now() + h * 3600000).toISOString();
const snapshot = {
  title: 'Hybrid benchmark',
  blocks: [{ position: 0, title: 'Workout', activities: [
    { position: 0, activity_name: 'Back squat', tracking_type: 'strength', prescription: { display: '3 sets: 8 × 60 kg', sets: [{ reps: '8', weight: '60' }, { reps: '8', weight: '60' }, { reps: '8', weight: '60' }] }, notes: 'Brace' },
    { position: 1, activity_name: 'Row', tracking_type: 'distance', prescription: { display: '500 m' } },
  ] }],
};
const classWorkouts = [
  { session_id: 'c1', title: 'Hybrid benchmark', workout_snapshot: snapshot, class_sessions: { name: 'Hybrid 6pm', starts_at: hrs(-3) } },
  { session_id: 'c2', title: 'Old one', workout_snapshot: snapshot, class_sessions: { name: 'Hybrid last month', starts_at: hrs(-24 * 30) } },
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
process.env.MOCK_ROLE = 'member';
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  let recorded = false;
  let unread = true;
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await mockSupabase(page, async ({ route, path, select, method, body, url }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
    if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
      ? [{ status: 'active', membership_plans: { name: 'Gym Monthly', includes_classes: true, includes_open_gym: true, includes_pt: false } }]
      : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/profiles')) return reply(route, [{ display_name: 'Priya Nair', first_name: 'Priya', last_name: 'Nair' }]);
    if (path.endsWith('/pt_appointments')) return reply(route, []);
    if (path.endsWith('/member_notifications')) {
      if (method === 'PATCH') { writes.push('PATCH notifications'); unread = false; return reply(route, []); }
      return reply(route, unread ? [{ id: 'n1', notification_type: 'class_workout', title: 'Your class workout is ready', body: 'Hybrid benchmark', related_assignment_id: null, related_session_id: 'c1', created_at: hrs(-1) }] : []);
    }
    if (path.endsWith('/class_session_workouts')) {
      const only = url.searchParams.get('session_id');
      const rows = classWorkouts.filter((w) => !only || only === `eq.${w.session_id}`);
      return reply(route, rows);
    }
    if (path.endsWith('/workout_assignments')) {
      if (method === 'PATCH') { writes.push('PATCH assignment'); return reply(route, []); }
      return reply(route, []);
    }
    if (path.endsWith('/workout_assignment_feedback')) return reply(route, []);
    if (path.endsWith('/workout_entries')) {
      if (method === 'POST') { writes.push(`entry ${JSON.stringify(body)}`); return reply(route, [{ id: `e${writes.length}` }]); }
      if (method === 'DELETE') { writes.push('DELETE entry'); return reply(route, []); }
      return reply(route, []);
    }
    if (path.endsWith('/personal_bests')) {
      if (method === 'POST') { writes.push(`pb ${JSON.stringify(body)}`); return reply(route, []); }
      if (method === 'DELETE') { writes.push('DELETE pb'); return reply(route, []); }
      return reply(route, []);
    }
    if (path.endsWith('/workout_sets') && method === 'POST') { writes.push(`sets ${JSON.stringify(body)}`); return reply(route, []); }
    if (path.endsWith('/workout_sessions')) {
      if (method === 'POST') { writes.push(`session ${JSON.stringify(body)}`); recorded = true; return reply(route, [{ id: 's9' }]); }
      if (method === 'PATCH') { writes.push(`PATCH session ${JSON.stringify(body)}`); return reply(route, []); }
      if (select === 'class_session_id') return reply(route, recorded ? [{ class_session_id: 'c1' }] : []);
      if (select === 'id') return reply(route, recorded ? [{ id: 's9' }] : []);
      return reply(route, []);
    }
    return false;
  });
  const c = runChecks();

  // Today: the class workout is announced and opens the workout
  await page.goto(`${base}/m/today`);
  const notice = page.getByRole('region', { name: 'New from your coach' });
  await c.has('Today announces the class workout', notice.getByText('Your class workout is ready'));
  c.ok('and names it', (await notice.getByText('Hybrid benchmark').count()) === 1);
  c.ok('the button goes to that class workout', (await notice.getByRole('link', { name: 'Open' }).getAttribute('href')) === '/m/train/class/c1');
  c.ok('layout (today)', (await page.evaluate(layoutProblems)).length === 0);

  // Workouts: only recent classes are listed
  await page.getByRole('navigation', { name: 'Member' }).getByRole('link', { name: /^Workouts/ }).click();
  const list = page.getByRole('region', { name: 'From your classes' });
  await c.has('Workouts lists the class workout', list.getByText('Hybrid benchmark'));
  c.ok('with its class', (await list.getByText(/Hybrid 6pm/).count()) === 1);
  c.ok('a class from last month is not listed', (await list.getByText('Old one').count()) === 0);
  c.ok('looking at the list cleared the notice', writes.includes('PATCH notifications'));
  c.ok('layout (workouts)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/member-class-list-${name}.png`, fullPage: true });

  // Open and record it
  writes.length = 0;
  await list.getByRole('link', { name: /^Record Hybrid benchmark/ }).click();
  await c.has('the workout opens', page.getByRole('heading', { name: 'Hybrid benchmark' }));
  c.ok('it says it is from the class and is their own record', (await page.getByText(/From your class\. Fill in what you did/).count()) === 1);
  const squat = page.getByRole('region', { name: 'Back squat' });
  c.ok('the coach\'s numbers are shown', (await squat.textContent()).includes('Suggested: 3 sets: 8 × 60 kg') && (await squat.textContent()).includes('Coach: Brace'));
  c.ok('no coach-review questions: no "I changed it", no reasons, no how-hard box', (await page.getByRole('radio', { name: 'I changed it' }).count()) === 0 && (await page.getByText('What happened?').count()) === 0 && (await page.getByLabel('How hard was it').count()) === 0);
  await squat.getByRole('radio', { name: 'As set' }).click();
  c.ok('"As set" puts the coach\'s numbers in the boxes', (await page.getByLabel('Back squat set 1 Weight').inputValue()) === '60' && (await page.getByLabel('Back squat set 3 Reps').inputValue()) === '8');
  await page.getByLabel('Back squat set 1 Weight').fill('62.5');
  await page.getByLabel('Your note on Back squat').fill('felt strong today');
  await page.getByRole('button', { name: 'Skip Row' }).click();
  c.ok('layout (recording)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/member-class-record-${name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await c.has('back on Workouts with a message', page.getByText('Class workout saved.'));
  await page.waitForTimeout(500);
  c.ok('no half-finished draft is left behind once it is finished', (await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('hybrid-train-draft:')).length)) === 0);
  const joined = writes.join('\n');
  const sess = writes.find((w) => w.startsWith('session '));
  c.ok('one session, tied to the class and not to any assignment', writes.filter((w) => w.startsWith('session ')).length === 1 && sess.includes('"class_session_id":"c1"') && sess.includes('"assignment_id":null') && sess.includes('"title":"Hybrid benchmark"'));
  c.ok('one exercise saved, with their note and their numbers', writes.filter((w) => w.startsWith('entry ')).length === 1 && joined.includes('"exercise_name":"Back squat"') && joined.includes('felt strong today') && joined.includes('"weight_kg":62.5') && joined.includes('"reps":8'));
  c.ok('the skipped exercise is not saved', !joined.includes('"exercise_name":"Row"'));
  c.ok('a new personal best is recorded from it', joined.includes('pb ') && joined.includes('"value_numeric":62.5'));
  c.ok('nothing is marked on an assignment', !joined.includes('PATCH assignment'));
  c.ok('the workout is named and finished', joined.includes('PATCH session'));
  await c.has('the list now says it is recorded', page.getByRole('region', { name: 'From your classes' }).getByText('Recorded', { exact: true }));

  // A second visit
  await page.getByRole('region', { name: 'From your classes' }).getByRole('link', { name: /^View Hybrid benchmark/ }).click();
  await c.has('opening it again says so', page.getByText('You have already recorded this class.'));
  c.ok('and offers to record it again or go back', (await page.getByRole('button', { name: 'Record it again' }).count()) === 1 && (await page.getByRole('link', { name: 'Back to Workouts' }).count()) === 1);
  c.ok('layout (already recorded)', (await page.evaluate(layoutProblems)).length === 0);
  await page.getByRole('button', { name: 'Record it again' }).click();
  await c.has('recording again opens a fresh workout', page.getByRole('button', { name: 'Finish workout' }));

  // Not available to them
  await page.goto(`${base}/m/train/class/nope`);
  await c.has('a class workout they cannot see is not found', page.getByRole('heading', { name: 'Workout not found' }));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
