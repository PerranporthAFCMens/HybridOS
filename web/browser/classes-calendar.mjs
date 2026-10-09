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
  const validated = [];
  const updated = [];
  const booking = [];
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
    if (path.endsWith('/rpc/validate_class_schedule')) {
      validated.push(body);
      const bad = new Date(body.p_starts_at).getTime() === londonInstant(todayKey, '11:00').getTime();
      return reply(route, bad ? { ok: false, errors: ['Studio A is already booked at this time.'], warnings: [] } : { ok: true, errors: [], warnings: [] });
    }
    if (path.endsWith('/rpc/update_validated_class_session')) {
      updated.push(body);
      return reply(route, { ok: true, overridden: !!body.p_override_reason, session_id: body.p_session_id });
    }
    if (path.endsWith('/class_sessions') && method === 'GET') {
      const h = sessions[0];
      return reply(route, { id: h.session_id, class_type_id: 'ty1', name: h.name, description: h.description, starts_at: h.starts_at, ends_at: h.ends_at, capacity: 16, reserved_capacity: 0, reserved_release_minutes_before: null });
    }
    if (path.endsWith('/rpc/admin_manage_class_booking')) {
      booking.push(body);
      if (body.p_user_id === 'u5') return reply(route, { ok: false, errors: ['This class is full (16). Raise the capacity first if you want to add someone.'], warnings: [] });
      return reply(route, { ok: true, warnings: body.p_action === 'add' ? ['Their membership does not include classes.'] : [] });
    }
    if (path.endsWith('/gym_members') && url.searchParams.get('select')?.includes('attrition_on')) {
      return reply(route, ['u1', 'u2', 'u3', 'u4', 'u5'].map((id) => ({ user_id: id, role: 'member', joined_at: '2026-01-01T00:00:00Z', attrition_on: null })));
    }
    if (path.endsWith('/class_bookings') && method === 'GET') {
      if (url.searchParams.get('session_id') !== 'eq.h') return reply(route, []);
      return reply(route, [
        { id: 'b1', user_id: 'u1', status: 'booked', booked_at: '2026-10-01T10:00:00Z' },
        { id: 'b2', user_id: 'u2', status: 'attended', booked_at: '2026-10-01T11:00:00Z' },
        { id: 'b3', user_id: 'u3', status: 'no_show', booked_at: '2026-10-01T12:00:00Z' },
      ]);
    }
    if (path.endsWith('/profiles')) return reply(route, [{ id: 'u1', display_name: 'Amelia Hart', first_name: null, last_name: null }, { id: 'u2', display_name: null, first_name: 'Jack', last_name: 'Pengelly' }, { id: 'u4', display_name: 'Zara Menhenitt', first_name: null, last_name: null }, { id: 'u5', display_name: 'Full Person', first_name: null, last_name: null }]);
    if (path.endsWith('/class_session_staff')) return reply(route, []);
    if (path.endsWith('/class_types')) return reply(route, [{ id: 'ty1', name: 'HIIT', description: null, duration_minutes: 45, default_capacity: 16, is_active: true }]);
    return false;
  });

  await page.goto(`${base}/next/#/classes`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Classes', level: 1 }));
  // Week is the default where there is room for it; a phone opens on the day (it has no Week button).
  const defaultView = name === 'desktop' ? 'Week' : 'Day';
  c.ok(`${defaultView} is the default view`, (await page.getByRole('button', { name: defaultView, exact: true }).getAttribute('aria-pressed')) === 'true');
  if (name === 'desktop') {
    // The calendar draws once the classes have loaded, so wait for the seventh day before counting.
    await page.locator('.cal-col').nth(6).waitFor({ timeout: 15000 }).catch(() => undefined);
    c.ok('the default week shows seven days', (await page.locator('.cal-col').count()) === 7);
    await page.getByRole('button', { name: 'Day', exact: true }).click();
  }
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
  await c.has('who has booked', dialog.getByText('Who has booked'));
  await c.has('roster summary', dialog.getByText('3 booked · 1 attended · 1 no-show'));
  await c.has('first booked person', dialog.getByText('Amelia Hart'));
  await c.has('name from first and last name', dialog.getByText('Jack Pengelly'));
  await c.has('person with no profile name', dialog.getByText('Member', { exact: true }));
  await c.has('attended status', dialog.getByText('Attended', { exact: true }));
  await c.has('no-show status', dialog.getByText('No-show', { exact: true }));
  c.ok('roster is in booking order', (await dialog.locator('.roster li .roster-name').allTextContents()).join('|') === 'Amelia Hart|Jack Pengelly|Member');
  // Attendance, removing and adding people
  c.ok('layout (class details with the list and add box)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Attended: Amelia Hart' }).click();
  await page.waitForTimeout(300);
  c.ok('Attended sends the checked call for that person and class', booking.length === 1 && booking[0].p_action === 'attended' && booking[0].p_user_id === 'u1' && booking[0].p_session_id === 'h' && booking[0].p_gym_id === GYM);
  await dialog.getByRole('button', { name: 'No-show: Amelia Hart' }).click();
  await page.waitForTimeout(300);
  c.ok('No-show sends no_show', booking.length === 2 && booking[1].p_action === 'no_show');
  await dialog.getByRole('button', { name: 'Undo: Jack Pengelly' }).click();
  await page.waitForTimeout(300);
  c.ok('Undo sets the person back to booked', booking.length === 3 && booking[2].p_action === 'booked' && booking[2].p_user_id === 'u2');
  await dialog.getByRole('button', { name: 'Remove: Jack Pengelly' }).click();
  await c.has('asks before removing', dialog.getByRole('button', { name: 'Yes, remove' }));
  c.ok('nothing sent until confirmed', booking.length === 3);
  await dialog.getByRole('button', { name: 'Keep' }).click();
  c.ok('Keep sends nothing', booking.length === 3);
  await dialog.getByRole('button', { name: 'Remove: Jack Pengelly' }).click();
  await dialog.getByRole('button', { name: 'Yes, remove' }).click();
  await page.waitForTimeout(300);
  c.ok('Remove sends cancel for that person', booking.length === 4 && booking[3].p_action === 'cancel' && booking[3].p_user_id === 'u2');
  await dialog.getByLabel('Add someone to this class').fill('amel');
  await c.has('people already on the list are not offered', dialog.getByText('No member found who is not already on the list.'));
  await dialog.getByLabel('Add someone to this class').fill('zar');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await c.has('added with the owner warning shown', dialog.getByText('Zara Menhenitt added. Their membership does not include classes.'));
  c.ok('Add sends add for that member', booking.length === 5 && booking[4].p_action === 'add' && booking[4].p_user_id === 'u4');
  await dialog.getByLabel('Add someone to this class').fill('full');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await c.has('a refusal from the database is shown', dialog.getByText(/This class is full \(16\)/));
  await dialog.getByRole('button', { name: 'Cancel class' }).click();
  await c.has('asks before cancelling', dialog.getByText(/Cancel this class\?/));
  c.ok('nothing written yet', patches.length === 0);
  await dialog.getByRole('button', { name: 'Yes, cancel class' }).click();
  c.ok('dialog closes after cancelling', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('cancel wrote is_cancelled true to that class in this gym', patches.length === 1 && patches[0].body.is_cancelled === true && patches[0].id === 'eq.h' && patches[0].gym === `eq.${GYM}`);

  // A class nobody has booked says so
  await page.getByRole('button', { name: /^Morning Spin/ }).click();
  await c.has('empty roster message', dialog.getByText('Nobody has booked yet.'));
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Bring a cancelled class back
  await page.getByRole('button', { name: /^Lunch Yoga/ }).click();
  await c.has('cancelled status shown', dialog.getByText('Cancelled', { exact: true }));
  c.ok('a cancelled class cannot take new people', await dialog.getByLabel('Add someone to this class').isDisabled());
  await dialog.getByRole('button', { name: 'Bring class back' }).click();
  c.ok('dialog closes after bringing back', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('reinstate wrote is_cancelled false', patches.length === 2 && patches[1].body.is_cancelled === false && patches[1].id === 'eq.y');

  // Edit a class: same form as Add class, filled in; checked against the gym rules ignoring the class itself
  await page.getByRole('button', { name: /^Morning HIIT/ }).click();
  await dialog.getByRole('button', { name: 'Edit class' }).click();
  await c.has('edit form opens', dialog.getByText('Edit class', { exact: true }).first());
  c.ok('edit form is filled in with the saved class', (await dialog.getByLabel('Class name').inputValue()) === 'Morning HIIT' && (await dialog.getByLabel('Start time').inputValue()) === '09:00' && (await dialog.getByLabel('Duration (minutes)').inputValue()) === '60' && (await dialog.getByLabel('Total capacity').inputValue()) === '16' && (await dialog.getByLabel('Date', { exact: true }).inputValue()) === todayKey);
  c.ok('class type cannot be changed when editing', await dialog.getByLabel('Class type').isDisabled());
  c.ok('no repeat option when editing', (await dialog.getByLabel('Repeat weekly').count()) === 0);
  await dialog.getByLabel('Class name').fill('Morning HIIT Plus');
  await dialog.getByLabel('Start time').fill('10:30');
  await c.has('check passes', dialog.getByText('Coaches, working hours, rooms, equipment and clashes all check out.'));
  c.ok('the check ignores the class being edited', validated.length > 0 && validated.every((v) => v.p_exclude_session_id === 'h'));
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  c.ok('edit closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const u = updated[0];
  c.ok('saved through the checked database call for that class', updated.length === 1 && u.p_session_id === 'h' && u.p_gym_id === GYM && u.p_name === 'Morning HIIT Plus' && u.p_capacity === 16 && new Date(u.p_starts_at).getTime() === londonInstant(todayKey, '10:30').getTime() && new Date(u.p_ends_at).getTime() === londonInstant(todayKey, '11:30').getTime());
  c.ok('a normal change sends no override reason', !('p_override_reason' in u));

  // A change that fails the checks can be saved anyway, with a reason
  await page.getByRole('button', { name: /^Morning HIIT/ }).click();
  await dialog.getByRole('button', { name: 'Edit class' }).click();
  await dialog.getByLabel('Start time').fill('11:00');
  await c.has('failing check shown', dialog.getByText('Studio A is already booked at this time.'));
  c.ok('Save changes is off while the check fails', await dialog.getByRole('button', { name: 'Save changes' }).isDisabled());
  c.ok('Save anyway is off until there is a reason', await dialog.getByRole('button', { name: 'Save anyway' }).isDisabled());
  await dialog.getByLabel('Reason', { exact: true }).fill('Room swap agreed with the coach');
  await dialog.getByRole('button', { name: 'Save anyway' }).click();
  c.ok('override edit closes', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  c.ok('the reason is sent with the change', updated.length === 2 && updated[1].p_override_reason === 'Room swap agreed with the coach' && updated[1].p_session_id === 'h');

  // Closing the edit form without saving writes nothing and returns to the class
  await page.getByRole('button', { name: /^Morning HIIT/ }).click();
  await dialog.getByRole('button', { name: 'Edit class' }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await c.has('back at the class details', dialog.getByRole('button', { name: 'Edit class' }));
  await dialog.getByRole('button', { name: 'Close' }).click();
  c.ok('closing the edit form wrote nothing', updated.length === 2);

  // The List view is still there
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await c.has('list view cards', page.getByRole('heading', { name: 'Morning HIIT' }));
  // A card in the list opens the same class details as a block on the calendar.
  await page.getByRole('heading', { name: 'Morning HIIT' }).click();
  await c.has('a list card opens the class details', dialog.getByText('Who has booked'));
  await page.keyboard.press('Escape');
  c.ok('Escape closes the details', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
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
  c.ok(`only the cancel changes and the edit calls were written (${other.join(', ') || 'no other writes'})`, other.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
