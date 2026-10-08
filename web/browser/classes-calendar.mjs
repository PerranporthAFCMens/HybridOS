// Browser gate: the Classes calendar (day and week), tapping an hour to add a class, opening a class to
// cancel it or bring it back. Supabase is mocked at the network layer, at phone and desktop width.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const todayKey = keyOf(today);
const tomorrowKey = keyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
// The form means gym time (UK), whatever the device's timezone. This is the same sum the app does.
const londonFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const londonInstant = (date, time) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(londonFormat.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    guess += wall - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return new Date(guess);
};
const gymTime = (key, hhmm) => londonInstant(key, hhmm).toISOString();
const row = (over) => ({ session_id: 's', name: 'Class', starts_at: '', ends_at: '', booked_count: 3, capacity: 12, spaces_left: 9, is_cancelled: false, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0, ...over });
const sessions = [
  row({ session_id: 'h', name: 'Morning HIIT', starts_at: gymTime(todayKey, '09:00'), ends_at: gymTime(todayKey, '10:00'), booked_count: 5, capacity: 16, spaces_left: 11, description: 'Intervals for everyone' }),
  row({ session_id: 'p', name: 'Morning Spin', starts_at: gymTime(todayKey, '09:30'), ends_at: gymTime(todayKey, '10:15'), capacity: 12 }),
  row({ session_id: 'y', name: 'Lunch Yoga', starts_at: gymTime(todayKey, '12:15'), ends_at: gymTime(todayKey, '13:00'), is_cancelled: true }),
  row({ session_id: 't', name: 'Tomorrow Strength', starts_at: gymTime(tomorrowKey, '18:00'), ends_at: gymTime(tomorrowKey, '19:00') }),
];

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
    if (cs.position !== 'fixed' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const p = e.parentElement;
    if (p && cs.position !== 'fixed' && cs.position !== 'absolute' && !e.closest('.menu-btn')) {
      const pr = p.getBoundingClientRect();
      if (getComputedStyle(p).display !== 'contents' && (r.right > pr.right + 1 || r.left < pr.left - 1)) problems.push(`${name} sticks out of its parent`);
    }
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const asked = [];
  const patches = [];
  const other = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, path, url, method, body }) => {
    if (path.endsWith('/rpc/get_class_calendar')) {
      asked.push(body);
      const from = new Date(body.p_from).getTime();
      const to = new Date(body.p_to).getTime();
      return reply(route, sessions.filter((s) => new Date(s.starts_at).getTime() >= from && new Date(s.starts_at).getTime() < to));
    }
    if (path.endsWith('/class_sessions') && method === 'PATCH') {
      patches.push({ body, id: url.searchParams.get('id'), gym: url.searchParams.get('gym_id') });
      return false;
    }
    if (method !== 'GET' && method !== 'HEAD' && !path.includes('/rpc/') && !path.endsWith('/class_sessions')) other.push(`${method} ${path}`);
    if (path.endsWith('/class_session_staff')) return reply(route, []);
    if (path.endsWith('/class_types')) return reply(route, [{ id: 'ty1', name: 'HIIT', description: null, duration_minutes: 45, default_capacity: 16, is_active: true }]);
    return false;
  });

  await page.goto(`${base}/next/#/classes`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Classes', level: 1 }));
  c.ok('Day is the default view', (await page.getByRole('button', { name: 'Day', exact: true }).getAttribute('aria-pressed')) === 'true');
  await c.has('class on the calendar', page.getByRole('button', { name: /^Morning HIIT/ }));
  await c.has('overlapping class on the calendar', page.getByRole('button', { name: /^Morning Spin/ }));
  await c.has('hour labels', page.getByText('09:00', { exact: true }).first());
  c.ok('tomorrow is not on today', (await page.getByRole('button', { name: /^Tomorrow Strength/ }).count()) === 0);
  const a = await page.getByRole('button', { name: /^Morning HIIT/ }).boundingBox();
  const b = await page.getByRole('button', { name: /^Morning Spin/ }).boundingBox();
  c.ok('overlapping classes sit side by side, not on top of each other', !!a && !!b && (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1));
  c.ok('class position follows its time (09:00 is above 09:30 start of the next)', !!a && !!b && b.y > a.y);
  c.ok('opens scrolled to the first class, not 05:00', (await page.locator('.cal-scroll').evaluate((e) => e.scrollTop)) > 100);
  c.ok('layout (day view)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/classes-calendar-${name}.png`, fullPage: true });

  // Day navigation moves one day
  await page.getByRole('button', { name: 'Next' }).click();
  await c.has('next day shows tomorrow\'s class', page.getByRole('button', { name: /^Tomorrow Strength/ }));
  await page.getByRole('button', { name: 'Previous' }).click();
  await c.has('previous day is back', page.getByRole('button', { name: /^Morning HIIT/ }));

  // Tap an hour to add a class there
  await page.getByRole('button', { name: /^Add a class on .* at 14:00$/ }).click();
  const dialog = page.getByRole('dialog');
  await c.has('Add class opens', dialog.getByText('Add to timetable').first());
  c.ok('opens on the tapped date', (await dialog.getByLabel('Date', { exact: true }).inputValue()) === todayKey);
  c.ok('opens on the tapped time', (await dialog.getByLabel('Start time').inputValue()) === '14:00');
  await dialog.getByRole('button', { name: 'Close' }).click();
  c.ok('closes without saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));

  // Open a class
  await page.getByRole('button', { name: /^Morning HIIT/ }).click();
  await c.has('class details open', dialog.getByText('5/16 booked'));
  await c.has('class description', dialog.getByText('Intervals for everyone'));
  await dialog.getByRole('button', { name: 'Cancel class' }).click();
  await c.has('asks before cancelling', dialog.getByText(/Cancel this class\?/));
  c.ok('nothing written yet', patches.length === 0);
  await dialog.getByRole('button', { name: 'Yes, cancel class' }).click();
  c.ok('dialog closes after cancelling', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('cancel wrote is_cancelled true to that class in this gym', patches.length === 1 && patches[0].body.is_cancelled === true && patches[0].id === 'eq.h' && patches[0].gym === `eq.${GYM}`);

  // Bring a cancelled class back
  await page.getByRole('button', { name: /^Lunch Yoga/ }).click();
  await c.has('cancelled status shown', dialog.getByText('Cancelled', { exact: true }));
  await dialog.getByRole('button', { name: 'Bring class back' }).click();
  c.ok('dialog closes after bringing back', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('reinstate wrote is_cancelled false', patches.length === 2 && patches[1].body.is_cancelled === false && patches[1].id === 'eq.y');

  // The List view is still there
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await c.has('list view cards', page.getByRole('heading', { name: 'Morning HIIT' }));
  await page.getByRole('button', { name: /Morning HIIT/ }).first().click().catch(() => {});
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Day', exact: true }).click();

  if (name === 'desktop') {
    await page.getByRole('button', { name: 'Week', exact: true }).click();
    c.ok('week view has seven day columns', (await page.locator('.cal-col').count()) === 7);
    await c.has('this week\'s class', page.getByRole('button', { name: /^Tomorrow Strength/ }));
    c.ok('layout (week view)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/classes-calendar-week.png`, fullPage: true });
    const before = asked.length;
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(400);
    c.ok('Next in week view moves a week', asked.length > before);
  } else {
    c.ok('Week button is hidden on a phone', !(await page.getByRole('button', { name: 'Week', exact: true }).isVisible()));
  }
  c.ok(`only the two cancel changes were written (${other.join(', ') || 'no other writes'})`, other.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
