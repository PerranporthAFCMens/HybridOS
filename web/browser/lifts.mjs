// Browser gate: Lifts and leaderboards (admin). The gym ticks which exercises get a leaderboard (a one-tap start with the usual
// big lifts, untick, find, add one by hand) and flips the one switch for whether members are shown until they opt out or only if
// they opt in. Signed in as an owner, phone and desktop width. Supabase is mocked at the network layer; the exact request of
// every action is checked.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

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

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  let tracked = [];
  let settings = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/tracked_lifts')) {
      if (method === 'POST') { writes.push({ table: 'tracked_lifts', method, query: Object.fromEntries(url.searchParams), body }); tracked = [...tracked.filter((t) => t.exercise_key !== body.exercise_key), body]; await route.fulfill({ status: 204, body: '' }); return true; }
      if (method === 'DELETE') { writes.push({ table: 'tracked_lifts', method, query: Object.fromEntries(url.searchParams) }); tracked = tracked.filter((t) => `eq.${t.exercise_key}` !== url.searchParams.get('exercise_key')); await route.fulfill({ status: 204, body: '' }); return true; }
      return reply(route, tracked);
    }
    if (path.endsWith('/gym_lift_settings')) {
      if (method === 'POST') { writes.push({ table: 'gym_lift_settings', method, query: Object.fromEntries(url.searchParams), body }); settings = [{ show_by_default: body.show_by_default }]; await route.fulfill({ status: 204, body: '' }); return true; }
      return reply(route, settings);
    }
    return false;
  });

  await page.goto(`${base}/lifts`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Lifts and leaderboards', level: 1 }));
  await c.has('the switch is on when nothing has been set (people are shown until they opt out)', page.getByText('Everyone is on the leaderboards until they opt out.'));
  const sw = page.getByRole('checkbox', { name: 'Members are shown unless they opt out' });
  c.ok('...and ticked', await sw.isChecked());
  await c.has('nothing is ticked yet, so the one-tap start is offered', page.getByRole('button', { name: 'Tick the usual big lifts' }));
  c.ok('the list offers weight exercises only (no runs or holds)', (await page.getByRole('checkbox', { name: 'Back Squat', exact: true }).count()) === 1 && (await page.getByRole('checkbox', { name: 'Run 5K' }).count()) === 0 && (await page.getByRole('checkbox', { name: 'Plank' }).count()) === 0);
  c.ok('looking wrote nothing', writes.length === 0);
  c.ok('layout (empty)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/lifts-empty-${name}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Tick the usual big lifts' }).click();
  await c.has('the usual lifts are ticked', page.getByRole('checkbox', { name: 'Deadlift', exact: true }));
  await page.waitForFunction(() => document.querySelectorAll('.lift-list li.on').length === 5);
  const keys = writes.filter((w) => w.table === 'tracked_lifts' && w.method === 'POST').map((w) => w.body.exercise_key).sort();
  c.ok('five ticks, each exact: this gym, lower-case key, the name as shown', keys.join(',') === 'back squat,bench press,deadlift,front squat,overhead press' && writes.every((w) => w.body.gym_id === GYM && w.body.exercise_name.toLowerCase() === w.body.exercise_key) && writes.every((w) => w.query.on_conflict === 'gym_id,exercise_key'));
  c.ok('ticked ones are listed first', (await page.locator('.lift-list li').first().getAttribute('class')) === 'on');
  c.ok('and the one-tap start has gone', (await page.getByRole('button', { name: 'Tick the usual big lifts' }).count()) === 0);

  writes.length = 0;
  await page.getByRole('checkbox', { name: 'Front Squat', exact: true }).uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.lift-list li.on').length === 4);
  c.ok('unticking removes only that one, in this gym', writes.length === 1 && writes[0].method === 'DELETE' && writes[0].query.gym_id === `eq.${GYM}` && writes[0].query.exercise_key === 'eq.front squat');
  writes.length = 0;
  await page.getByRole('checkbox', { name: 'Hip Thrust', exact: true }).check();
  await page.waitForFunction(() => document.querySelectorAll('.lift-list li.on').length === 5);
  c.ok('ticking one from the list adds exactly it', writes.length === 1 && writes[0].body.exercise_key === 'hip thrust' && writes[0].body.exercise_name === 'Hip Thrust');

  // Find
  writes.length = 0;
  await page.getByLabel('Find an exercise').fill('bench');
  c.ok('searching narrows the list', (await page.locator('.lift-list li').count()) > 1 && (await page.getByRole('checkbox', { name: 'Back Squat', exact: true }).count()) === 0 && (await page.getByRole('checkbox', { name: 'Bench Press', exact: true }).isChecked()));
  await page.getByLabel('Find an exercise').fill('zzz');
  await c.has('nothing matching says so', page.getByText('Nothing matches. Add it below.'));
  await page.getByLabel('Find an exercise').fill('');

  // Adding by hand
  await page.getByLabel('Another exercise').fill('Deadlift');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await c.has('a repeat is refused', page.getByText('That one is already ticked.'));
  await page.getByLabel('Another exercise').fill('   ');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await c.has('an empty name is refused', page.getByText('Type the name of the exercise.'));
  c.ok('nothing written for refused names', writes.length === 0);
  await page.getByLabel('Another exercise').fill('Zercher Squat');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.lift-list li.on').length === 6);
  c.ok('a hand-typed lift is added with a lower-case key', writes.length === 1 && writes[0].body.exercise_key === 'zercher squat' && writes[0].body.exercise_name === 'Zercher Squat');
  c.ok('and it shows in the ticked list even though it is not in the exercise list', (await page.getByRole('checkbox', { name: 'Zercher Squat', exact: true }).isChecked()));

  // The one switch
  writes.length = 0;
  await sw.uncheck();
  await c.has('turning it off says what that means', page.getByText('Nobody is on the leaderboards until they opt in.'));
  c.ok('the switch is saved exactly: this gym, off', writes.length === 1 && writes[0].table === 'gym_lift_settings' && writes[0].body.gym_id === GYM && writes[0].body.show_by_default === false && writes[0].query.on_conflict === 'gym_id');
  await sw.check();
  await c.has('turning it back on is just as easy', page.getByText('Everyone is on the leaderboards until they opt out.'));
  c.ok('and saved', writes.length === 2 && writes[1].body.show_by_default === true);
  c.ok('layout (ticked)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/lifts-${name}.png`, fullPage: true });

  // It is linked from Settings
  await page.goto(`${base}/settings`);
  await c.has('Settings links to it', page.getByText('Lifts and leaderboards'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
