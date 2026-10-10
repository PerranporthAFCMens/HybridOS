// Browser gate: the Classes timetable and the Add class form, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Checks what is on screen, the exact date range asked for
// when moving between weeks, and the same layout rules as audit.mjs (no sideways scroll, nothing off
// screen, 40px tap targets).
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const COACH = '66666666-6666-4666-8666-666666666666';
const ALEX = '77777777-7777-4777-8777-777777777777';
const TYPE = '91111111-1111-4111-8111-111111111111';
const CAP = '92222222-2222-4222-8222-222222222222';
const STUDIO = '93333333-3333-4333-8333-333333333333';
const BIKE = '94444444-4444-4444-8444-444444444444';
const monday = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
const at = (dayOffset, h, m = 0) => { const x = new Date(monday); x.setDate(x.getDate() + dayOffset); x.setHours(h, m, 0, 0); return x.toISOString(); };
const row = (over) => ({ session_id: 's', name: 'Class', starts_at: at(0, 9), ends_at: at(0, 10), booked_count: 3, capacity: 12, spaces_left: 9, is_cancelled: false, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0, ...over });
const thisWeek = [
  row({ session_id: 'a', name: 'Strength and conditioning with a rather long class name', starts_at: at(0, 7, 30), ends_at: at(0, 8, 30), description: 'Heavy lifting and finishers, all levels welcome', booked_count: 9, capacity: 12, spaces_left: 3 }),
  row({ session_id: 'b', name: 'Evening Hybrid', starts_at: at(0, 18), ends_at: at(0, 19), reserved_capacity: 4, reserved_plan_names: ['Premium', 'Hybrid Monthly'], availability_note: 'Premium only' }),
  row({ session_id: 'c', name: 'Cancelled Spin', starts_at: at(2, 12), ends_at: at(2, 13), is_cancelled: true }),
  row({ session_id: 'd', name: 'Sunday Long Run', starts_at: at(6, 10), ends_at: at(6, 11), spaces_left: 0, availability_note: 'Full' }),
];
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
const plusDays = (date, n) => { const [y, m, d] = date.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`; };
const nextSaturday = (() => { const x = new Date(monday); x.setDate(x.getDate() + 12); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })();
const weekStart = (k) => londonInstant(plusDays(nextSaturday, 7 * k), '09:30');
const nextWeek = [row({ session_id: 'e', name: 'Next Week Mobility', starts_at: at(8, 17), ends_at: at(8, 18) })];

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
  const writes = [];
  const saved = [];
  const checks = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && !u.pathname.includes('/rpc/get_class_calendar') && !u.pathname.includes('/rpc/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`); });
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/get_class_calendar')) {
      asked.push(body);
      return reply(route, new Date(body.p_from).getTime() === monday.getTime() ? thisWeek : nextWeek);
    }
    if (path.endsWith('/rpc/validate_class_schedule')) {
      checks.push(body);
      if (new Date(body.p_ends_at).getTime() - new Date(body.p_starts_at).getTime() === 90 * 60000) return reply(route, { ok: false, errors: ['Classes cannot currently run across midnight.'], warnings: [] });
      if (new Date(body.p_starts_at).getTime() === weekStart(2).getTime()) return reply(route, { ok: false, errors: ['Studio A is outside its configured available hours.'], warnings: [] });
      const none = !body.p_staff_ids?.length;
      return reply(route, none ? { ok: false, errors: ['No selected staff member is currently qualified for Spin instructor.'], warnings: [] } : { ok: true, errors: [], warnings: [] });
    }
    if (path.endsWith('/rpc/create_validated_class_session')) {
      saved.push(body);
      if (body.p_name === 'Partial series' && new Date(body.p_starts_at).getTime() === weekStart(1).getTime()) return reply(route, { ok: false, errors: ['A selected staff member is already assigned to another class at this time.'], warnings: [] });
      if (body.p_name === 'Clash class') return reply(route, { ok: false, errors: ['Studio A is already booked at this time.', 'A selected staff member is already assigned to another class at this time.'], warnings: [] });
      return reply(route, { ok: true, session_id: 'new1', overridden: !!body.p_override_reason });
    }
    if (path.endsWith('/class_types')) return reply(route, [{ id: TYPE, name: 'Spin', description: 'Indoor cycling', duration_minutes: 45, default_capacity: 12 }]);
    if (path.endsWith('/service_requirements')) return reply(route, [{ class_type_id: TYPE, capability_id: CAP, resource_id: null, quantity: 1 }, { class_type_id: TYPE, capability_id: null, resource_id: STUDIO, quantity: 1 }, { class_type_id: TYPE, capability_id: null, resource_id: BIKE, quantity: 12 }]);
    if (path.endsWith('/capabilities')) return reply(route, [{ id: CAP, name: 'Spin instructor' }]);
    if (path.endsWith('/resources')) return reply(route, [{ id: STUDIO, name: 'Studio A', resource_type: 'room', capacity: 20 }, { id: BIKE, name: 'Spin bike', resource_type: 'equipment', capacity: 12 }]);
    if (path.endsWith('/staff_capabilities')) return reply(route, [{ user_id: COACH, capability_id: CAP, qualified: true, expires_on: null }]);
    if (path.endsWith('/staff_working_hours')) return reply(route, [COACH, ALEX].flatMap((u) => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ user_id: u, weekday: d, start_time: '06:00:00', end_time: '22:00:00', is_working: true }))));
    if (path.endsWith('/class_session_staff')) return reply(route, [{ session_id: 'a', user_id: COACH, is_lead: true }]);
    if (path.endsWith('/gym_members')) return reply(route, [{ user_id: COACH, role: 'coach' }, { user_id: ALEX, role: 'admin' }]);
    if (path.endsWith('/membership_plans')) return reply(route, [{ id: 'pl1', name: 'Premium', price_pence: 6000, billing_interval: 'monthly', access_type: 'hybrid', is_active: true }]);
    if (path.endsWith('/profiles')) return reply(route, [{ id: COACH, display_name: 'Coach Carla', first_name: null, last_name: null }, { id: ALEX, display_name: null, first_name: 'Alex', last_name: 'Admin' }]);
    return false;
  });

  await page.goto(`${base}/classes`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Classes', level: 1 }));
  // The calendar is the default view; the card list is the List view (checked here, the calendar has its own check).
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await c.has('class card', page.getByRole('heading', { name: /Strength and conditioning/ }));
  await c.has('week summary', page.getByText('3 classes · 1 cancelled'));
  await c.has('time range', page.getByText('07:30–08:30'));
  await c.has('coach name', page.getByText('Coach: Coach Carla'));
  await c.has('booked count', page.getByText('9/12 booked'));
  await c.has('spaces left', page.getByText('3 spaces left'));
  await c.has('description', page.getByText('Heavy lifting and finishers'));
  await c.has('reserved plans', page.getByText('Reserved: Premium, Hybrid Monthly'));
  await c.has('availability note', page.getByText('Premium only'));
  await c.has('cancelled', page.getByText('Cancelled', { exact: true }));
  await c.has('full', page.getByText('Full', { exact: true }));
  c.ok('seven days', (await page.locator('.day').count()) === 7);
  c.ok('no classes message on empty days', (await page.getByText('No classes', { exact: true }).count()) >= 4);
  c.ok('asked for this Monday to next Monday', asked[0] && new Date(asked[0].p_from).getTime() === monday.getTime() && new Date(asked[0].p_to).getTime() === new Date(monday.getTime() + 7 * 86400000).getTime() && asked[0].p_gym_id === GYM);
  c.ok('layout (this week)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/classes-${name}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Next' }).click();
  await c.has('next week class', page.getByRole('heading', { name: 'Next Week Mobility' }));
  c.ok('next week asked for 7 days later', asked.some((b) => new Date(b.p_from).getTime() === new Date(monday.getTime() + 7 * 86400000).getTime() || Math.abs(new Date(b.p_from).getTime() - (monday.getTime() + 7 * 86400000)) <= 3600000));
  await page.getByRole('button', { name: 'Previous' }).click();
  await c.has('previous goes back', page.getByRole('heading', { name: /Strength and conditioning/ }));
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Today' }).click();
  await c.has('Today returns to this week', page.getByRole('heading', { name: /Strength and conditioning/ }));
  c.ok('Class setup link goes to the new Class setup screen', (await page.getByRole('link', { name: 'Class setup' }).getAttribute('href')) === '/class-setup');
  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);

  // Add class: pick a class type, see what it needs, let the gym rules guide who can teach it
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Add class' }).click();
  await c.has('add form opens', dialog.getByText('Add to timetable').first());
  await dialog.getByLabel('Class type').selectOption({ label: 'Spin' });
  await c.has('what the class type needs', dialog.getByText('Qualification: Spin instructor · Needs: Studio A, 12 × Spin bike'));
  c.ok('class type fills duration, capacity and description', (await dialog.getByLabel('Duration (minutes)').inputValue()) === '45' && (await dialog.getByLabel('Total capacity').inputValue()) === '12' && (await dialog.getByLabel('Description').inputValue()) === 'Indoor cycling');
  c.ok('class name filled from the type when blank', (await dialog.getByLabel('Class name').inputValue()) === 'Spin');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('09:30');
  await c.has('unqualified staff are greyed out with a reason', dialog.locator('.staff-pick.unavailable', { hasText: 'Alex Admin' }).getByText('Not qualified'));
  c.ok('and cannot be ticked', await dialog.getByLabel('Alex Admin · admin').isDisabled());
  c.ok('the qualified coach can', await dialog.getByLabel('Coach Carla · coach').isEnabled());
  await c.has('no one assigned: the database says why', dialog.getByText('No selected staff member is currently qualified for Spin instructor.'));
  c.ok('Save is blocked while the check fails', await dialog.getByRole('button', { name: 'Save class' }).isDisabled());
  c.ok('add form layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-form-${name}.png` });
  await dialog.getByLabel('Coach Carla · coach').click();
  await c.has('check passes', dialog.getByText('Coaches, working hours, rooms, equipment and clashes all check out.'));
  const lastCheck = checks[checks.length - 1];
  c.ok('the check asked about the right class, time and coach', lastCheck && lastCheck.p_gym_id === GYM && lastCheck.p_class_type_id === TYPE && lastCheck.p_capacity === 12 && JSON.stringify(lastCheck.p_staff_ids) === JSON.stringify([COACH]) && new Date(lastCheck.p_ends_at).getTime() - new Date(lastCheck.p_starts_at).getTime() === 45 * 60000);

  // A clash found by the database at save time is shown in full and nothing jumps
  await dialog.getByLabel('Class name').fill('Clash class');
  await dialog.getByRole('button', { name: 'Save class' }).click();
  await c.has('clash reasons listed', dialog.getByText('Studio A is already booked at this time.'));
  await c.has('second reason listed', dialog.getByText('A selected staff member is already assigned to another class at this time.'));
  c.ok('form stays open on a clash', await dialog.isVisible());

  // A good class saves in ONE call that carries everything
  await dialog.getByLabel('Class name').fill('Saturday Spin');
  await dialog.getByLabel('Reserved spaces', { exact: true }).fill('4');
  await dialog.getByLabel('Release reserved spaces').selectOption('120');
  await dialog.getByLabel('Premium · £60.00').click();
  await dialog.getByRole('button', { name: 'Save class' }).click();
  c.ok('form closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const made = saved.find((b) => b.p_name === 'Saturday Spin');
  const startsExpected = londonInstant(nextSaturday, '09:30');
  c.ok('one save call carries the class, type, coach and reserved plan', made && made.p_gym_id === GYM && made.p_class_type_id === TYPE && made.p_description === 'Indoor cycling' && new Date(made.p_starts_at).getTime() === startsExpected.getTime() && new Date(made.p_ends_at).getTime() === startsExpected.getTime() + 45 * 60000 && made.p_capacity === 12 && made.p_reserved_capacity === 4 && made.p_reserved_release_minutes_before === 120 && JSON.stringify(made.p_staff_ids) === JSON.stringify([COACH]) && JSON.stringify(made.p_plan_ids) === JSON.stringify(['pl1']));
  c.ok('no direct table writes any more', !writes.some((w) => /class_sessions|class_session_staff|class_session_reserved_plans/.test(w)));
  await c.has('timetable jumped to the new class week', page.getByRole('heading', { name: 'Next Week Mobility' }));
  c.ok('asked for the new class week', asked.some((b) => Math.abs(new Date(b.p_from).getTime() - (monday.getTime() + 7 * 86400000)) <= 3600000));

  // A custom class: no class type, nothing to check against, still saved through the same call
  await page.getByRole('button', { name: 'Add class' }).click();
  await c.has('custom class explained', dialog.getByText('Custom class: no qualification, room or equipment checks are made.'));
  await dialog.getByLabel('Class name').fill('Open workshop');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByRole('button', { name: 'Save class' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  const custom = saved.find((b) => b.p_name === 'Open workshop');
  c.ok('custom class saved with no class type', custom && custom.p_class_type_id === null && JSON.stringify(custom.p_staff_ids) === '[]');

  // Repeat weekly: every week is checked on its own; a bad week is shown and left out; the rest are saved one by one
  await page.getByRole('button', { name: 'Add class' }).click();
  await dialog.getByLabel('Class type').selectOption({ label: 'Spin' });
  await dialog.getByLabel('Class name').fill('Weekly Spin');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('09:30');
  await dialog.getByLabel('Coach Carla · coach').click();
  await dialog.getByLabel('Repeat weekly').click();
  await dialog.getByLabel('Number of weeks').fill('1');
  await c.has('weeks out of range is explained straight away', dialog.getByText('Choose between 2 and 52 weeks.'));
  c.ok('and Save is not available', await dialog.getByRole('button', { name: /^Save/ }).isDisabled());
  await dialog.getByLabel('Number of weeks').fill('4');
  await c.has('four weeks listed', dialog.getByText('Weeks: 3 of 4 will be saved'));
  const labels = await dialog.locator('.week-row .check span:last-child').allTextContents();
  c.ok('each week is a different Saturday, same time', labels.length === 4 && labels.every((l) => l.includes('09:30')) && new Set(labels).size === 4);
  await c.has('the bad week says why', dialog.getByText('Studio A is outside its configured available hours.'));
  c.ok('and is left out unless the owner ticks it as an override', !(await dialog.locator('.week-row').nth(2).getByRole('checkbox').isChecked()) && await dialog.locator('.week-row').nth(2).getByRole('checkbox').isEnabled());
  await c.has('the way to override is explained', dialog.getByText('Tick the box to schedule this week anyway.'));
  c.ok('Save says how many', await dialog.getByRole('button', { name: 'Save 3 classes' }).isVisible());
  await dialog.locator('.week-row').nth(1).getByRole('checkbox').click({ force: true });
  await c.has('a week can be skipped', dialog.getByText('Weeks: 2 of 4 will be saved'));
  await dialog.locator('.week-row').nth(1).getByRole('checkbox').click({ force: true });
  c.ok('and put back', await dialog.getByRole('button', { name: 'Save 3 classes' }).isVisible());
  c.ok('series layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-repeat-${name}.png` });
  await dialog.getByRole('button', { name: 'Save 3 classes' }).click();
  c.ok('form closes after saving the series', await dialog.waitFor({ state: 'detached', timeout: 8000 }).then(() => true, () => false));
  const weekly = saved.filter((b) => b.p_name === 'Weekly Spin').map((b) => new Date(b.p_starts_at).getTime());
  c.ok('three classes saved: weeks 1, 2 and 4, at the same clock time', JSON.stringify(weekly) === JSON.stringify([weekStart(0).getTime(), weekStart(1).getTime(), weekStart(3).getTime()]));
  c.ok('each carries the class type and coach', saved.filter((b) => b.p_name === 'Weekly Spin').every((b) => b.p_class_type_id === TYPE && JSON.stringify(b.p_staff_ids) === JSON.stringify([COACH])));

  // A week that fails at save time is reported; Save again retries only that week
  await page.getByRole('button', { name: 'Add class' }).click();
  await dialog.getByLabel('Class type').selectOption({ label: 'Spin' });
  await dialog.getByLabel('Class name').fill('Partial series');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('09:30');
  await dialog.getByLabel('Coach Carla · coach').click();
  await dialog.getByLabel('Repeat weekly').click();
  await dialog.getByLabel('Number of weeks').fill('2');
  await c.has('two weeks', dialog.getByText('Weeks: 2 of 2 will be saved'));
  await dialog.getByRole('button', { name: 'Save 2 classes' }).click();
  await c.has('partial summary', dialog.getByText('Saved 1 of 2 weeks.'));
  await c.has('the failed week is named with its reason', dialog.getByText(/A selected staff member is already assigned to another class at this time\./).first());
  c.ok('form stays open', await dialog.isVisible());
  c.ok('Save now retries only the failed week', await dialog.getByRole('button', { name: 'Save 1 class' }).isVisible());
  const partialCalls = saved.filter((b) => b.p_name === 'Partial series').length;
  c.ok('first attempt made two calls', partialCalls === 2);
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Override: schedule anyway, with a reason that must be given and is sent with the save
  await page.getByRole('button', { name: 'Add class' }).click();
  await dialog.getByLabel('Class type').selectOption({ label: 'Spin' });
  await dialog.getByLabel('Class name').fill('Override class');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('09:30');
  await c.has('the failing check offers an override', dialog.getByText('Schedule it anyway'));
  c.ok('Save class stays blocked', await dialog.getByRole('button', { name: 'Save class' }).isDisabled());
  c.ok('Schedule anyway needs a reason', await dialog.getByRole('button', { name: 'Schedule anyway' }).isDisabled());
  await dialog.getByLabel('Reason', { exact: true }).fill('ab');
  c.ok('two characters is not enough', await dialog.getByRole('button', { name: 'Schedule anyway' }).isDisabled());
  await dialog.getByLabel('Reason', { exact: true }).fill('  Coach swap agreed  ');
  c.ok('three or more is', await dialog.getByRole('button', { name: 'Schedule anyway' }).isEnabled());
  c.ok('override layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-override-${name}.png` });
  await dialog.getByRole('button', { name: 'Schedule anyway' }).click();
  c.ok('form closes after the override', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const forcedCall = saved.find((b) => b.p_name === 'Override class');
  c.ok('the save carries the trimmed reason and no coach', forcedCall && forcedCall.p_override_reason === 'Coach swap agreed' && JSON.stringify(forcedCall.p_staff_ids) === '[]' && forcedCall.p_class_type_id === TYPE);
  c.ok('normal saves never carry a reason', saved.filter((b) => b.p_name !== 'Override class' && b.p_name !== 'Weekly Override').every((b) => !('p_override_reason' in b)));

  // A class that crosses midnight can never be overridden
  await page.getByRole('button', { name: 'Add class' }).click();
  await dialog.getByLabel('Class type').selectOption({ label: 'Spin' });
  await dialog.getByLabel('Class name').fill('Late night');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('23:30');
  await dialog.getByLabel('Duration (minutes)').fill('90');
  await c.has('midnight problem shown', dialog.getByText('Classes cannot currently run across midnight.'));
  c.ok('and no override is offered', (await dialog.getByText('Schedule it anyway').count()) === 0);
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Weekly: tick the failing week as an override; one shared reason; only that week carries it
  await page.getByRole('button', { name: 'Add class' }).click();
  await dialog.getByLabel('Class type').selectOption({ label: 'Spin' });
  await dialog.getByLabel('Class name').fill('Weekly Override');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('09:30');
  await dialog.getByLabel('Coach Carla · coach').click();
  await dialog.getByLabel('Repeat weekly').click();
  await dialog.getByLabel('Number of weeks').fill('4');
  await c.has('three of four before overriding', dialog.getByText('Weeks: 3 of 4 will be saved'));
  await dialog.locator('.week-row').nth(2).getByRole('checkbox').click({ force: true });
  await c.has('all four once the failing week is ticked', dialog.getByText('Weeks: 4 of 4 will be saved'));
  c.ok('a reason is now needed and Save waits for it', await dialog.getByRole('button', { name: 'Save 4 classes' }).isDisabled());
  await dialog.getByLabel('Reason for scheduling despite the checks').fill('Maintenance finished early');
  await dialog.getByRole('button', { name: 'Save 4 classes' }).click();
  c.ok('series closes after saving', await dialog.waitFor({ state: 'detached', timeout: 8000 }).then(() => true, () => false));
  const weeklyOverride = saved.filter((b) => b.p_name === 'Weekly Override');
  c.ok('four weeks saved', weeklyOverride.length === 4);
  c.ok('only the overridden week carries the reason', weeklyOverride.filter((b) => b.p_override_reason).length === 1 && new Date(weeklyOverride.find((b) => b.p_override_reason).p_starts_at).getTime() === weekStart(2).getTime() && weeklyOverride.find((b) => b.p_override_reason).p_override_reason === 'Maintenance finished early');
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
