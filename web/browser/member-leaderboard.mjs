// Browser gate: the member's lift leaderboards. Members see a ranking for each lift the gym ticked (ties share a place, you are
// marked), can switch lift, and have their own show/hide choice, which says plainly when the gym's switch is what decides. The
// choice is reachable from the leaderboard screen and from Me. Signed in as a member, phone and desktop width. Supabase is mocked
// at the network layer; the exact request of every action is checked.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

process.env.MOCK_ROLE = 'member';
function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side') || e.closest('[hidden]')) continue;
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

const boards = {
  'back squat': [{ rank: 1, display_name: 'Coach A.', value: 180, is_me: false }, { rank: 2, display_name: 'Priya N.', value: 150, is_me: false }, { rank: 2, display_name: 'Sam L.', value: 150, is_me: false }, { rank: 4, display_name: 'Pat', value: 120, is_me: true }],
  deadlift: [{ rank: 1, display_name: 'Priya N.', value: 200, is_me: false }],
};

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  for (const scenario of ['default-on', 'default-off', 'none']) {
    const writes = [];
    const calls = [];
    let showByDefault = scenario === 'default-on' ? [] : scenario === 'default-off' ? [{ show_by_default: false }] : [];
    let choice = [];
    const lifts = scenario === 'none' ? [] : [{ exercise_key: 'back squat', exercise_name: 'Back Squat' }, { exercise_key: 'deadlift', exercise_name: 'Deadlift' }];
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, url, path, method, body }) => {
      if (path.endsWith('/rpc/get_lift_leaderboard')) { calls.push(body); return reply(route, boards[body.p_exercise_key] ?? []); }
      if (path.endsWith('/tracked_lifts')) return reply(route, lifts);
      if (path.endsWith('/gym_lift_settings')) return reply(route, showByDefault);
      if (path.endsWith('/member_lift_choice')) {
        if (method === 'POST') { writes.push({ method, query: Object.fromEntries(url.searchParams), body }); choice = [{ show: body.show }]; await route.fulfill({ status: 204, body: '' }); return true; }
        return reply(route, choice);
      }
      return false;
    });

    await page.goto(`${base}/m/train/leaderboard`);
    const c = runChecks();
    await c.has('heading', page.getByRole('heading', { name: 'Leaderboards', level: 1 }));
    if (scenario === 'none') {
      await c.has('no lifts ticked says so', page.getByText('No lifts have a leaderboard yet.'));
      await page.goto(`${base}/m/train`);
      await c.has('the workouts tab loads', page.getByRole('heading', { name: 'Personal bests' }));
      c.ok('and offers no leaderboard link', (await page.getByRole('link', { name: 'Leaderboards' }).count()) === 0);
      c.ok('no page errors', errors.length === 0);
      if (!c.report(`${name} / ${scenario}`)) allOk = false;
      await ctx.close();
      continue;
    }
    await c.has('the first lift (by name) is shown', page.getByRole('combobox', { name: 'Lift' }));
    await page.getByRole('listitem').filter({ hasText: 'Coach A.' }).waitFor();
    c.ok('the request is exact: this gym, the lift key', calls.length === 1 && calls[0].p_gym_id === GYM && calls[0].p_exercise_key === 'back squat');
    const rows = await page.locator('.tr-board li').allInnerTexts();
    c.ok('ranked, ties share a place, in order', rows.length === 4 && rows[0].replace(/\s+/g, ' ') === '1 Coach A. 180 kg' && rows[1].replace(/\s+/g, ' ') === '2 Priya N. 150 kg' && rows[2].replace(/\s+/g, ' ') === '2 Sam L. 150 kg' && rows[3].replace(/\s+/g, ' ') === '4 Pat (you) 120 kg');
    c.ok('you are marked', (await page.locator('.tr-board li.me').count()) === 1);
    await page.getByRole('combobox', { name: 'Lift' }).selectOption('deadlift');
    await page.getByRole('listitem').filter({ hasText: 'Priya N.' }).waitFor();
    c.ok('another lift asks for that lift', calls.length === 2 && calls[1].p_exercise_key === 'deadlift');
    await c.has('and says when you are not on it', page.getByText('You are not on this one yet.'));

    // Your choice
    const box = page.getByRole('checkbox', { name: 'Show me on the lift leaderboards' });
    if (scenario === 'default-on') {
      c.ok('the gym shows people by default, so you are ticked', await box.isChecked());
      await c.has('and it says why', page.getByText('You are shown, because that is how the gym has it set. You can hide yourself.'));
      c.ok('looking wrote nothing', writes.length === 0);
      await box.uncheck();
      await c.has('hiding says it is your choice', page.getByText('You chose to be hidden.'));
      c.ok('the choice is saved exactly: this gym, you, hidden', writes.length === 1 && writes[0].body.gym_id === GYM && writes[0].body.user_id === USER && writes[0].body.show === false && writes[0].query.on_conflict === 'gym_id,user_id');
      await box.check();
      await c.has('and you can change your mind', page.getByText('You chose to be shown.'));
      c.ok('saved', writes.length === 2 && writes[1].body.show === true);
    } else {
      c.ok('the gym hides people until they opt in, so you are not ticked', !(await box.isChecked()));
      await c.has('and it says why', page.getByText('You are hidden, because that is how the gym has it set. You can choose to be shown.'));
      await box.check();
      await c.has('opting in says it is your choice', page.getByText('You chose to be shown.'));
      c.ok('saved exactly', writes.length === 1 && writes[0].body.show === true && writes[0].body.user_id === USER);
    }
    c.ok('layout (leaderboard)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/leaderboard-${scenario}-${name}.png`, fullPage: true });

    // Me has the same switch; the workouts tab links here
    await page.goto(`${base}/m/me`);
    await c.has('Me has the same switch', page.getByRole('heading', { name: 'Lift leaderboards' }));
    c.ok('and it shows the saved choice', (await page.getByRole('checkbox', { name: 'Show me on the lift leaderboards' }).isChecked()) === (writes[writes.length - 1].body.show));
    await page.goto(`${base}/m/train`);
    await page.getByRole('link', { name: 'Leaderboards' }).click();
    await c.has('the workouts tab links to the leaderboards', page.getByRole('heading', { name: 'Leaderboards', level: 1 }));
    c.ok('no page errors', errors.length === 0);
    if (!c.report(`${name} / ${scenario}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
