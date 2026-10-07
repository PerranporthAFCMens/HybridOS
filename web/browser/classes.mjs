// Browser gate: the Classes timetable and the Add class form, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Checks what is on screen, the exact date range asked for
// when moving between weeks, and the same layout rules as audit.mjs (no sideways scroll, nothing off
// screen, 40px tap targets).
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const COACH = '66666666-6666-4666-8666-666666666666';
const ALEX = '77777777-7777-4777-8777-777777777777';
const monday = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
const at = (dayOffset, h, m = 0) => { const x = new Date(monday); x.setDate(x.getDate() + dayOffset); x.setHours(h, m, 0, 0); return x.toISOString(); };
const row = (over) => ({ session_id: 's', name: 'Class', starts_at: at(0, 9), ends_at: at(0, 10), booked_count: 3, capacity: 12, spaces_left: 9, is_cancelled: false, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0, ...over });
const thisWeek = [
  row({ session_id: 'a', name: 'Strength and conditioning with a rather long class name', starts_at: at(0, 7, 30), ends_at: at(0, 8, 30), description: 'Heavy lifting and finishers, all levels welcome', booked_count: 9, capacity: 12, spaces_left: 3 }),
  row({ session_id: 'b', name: 'Evening Hybrid', starts_at: at(0, 18), ends_at: at(0, 19), reserved_capacity: 4, reserved_plan_names: ['Premium', 'Hybrid Monthly'], availability_note: 'Premium only' }),
  row({ session_id: 'c', name: 'Cancelled Spin', starts_at: at(2, 12), ends_at: at(2, 13), is_cancelled: true }),
  row({ session_id: 'd', name: 'Sunday Long Run', starts_at: at(6, 10), ends_at: at(6, 11), spaces_left: 0, availability_note: 'Full' }),
];
const nextSaturday = (() => { const x = new Date(monday); x.setDate(x.getDate() + 12); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })();
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
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && !u.pathname.includes('/rpc/get_class_calendar') && !u.pathname.includes('/class_session') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`); });
  await mockSupabase(page, async ({ route, path, method, body }) => {
    if (path.endsWith('/rpc/get_class_calendar')) {
      asked.push(body);
      return reply(route, new Date(body.p_from).getTime() === monday.getTime() ? thisWeek : nextWeek);
    }
    if (path.endsWith('/class_sessions') && method === 'POST') { saved.push({ table: 'class_sessions', body }); return reply(route, [{ id: 'new1' }]); }
    if (path.endsWith('/class_session_reserved_plans') && method === 'POST') { saved.push({ table: 'reserved', body }); await route.fulfill({ status: 201, body: '' }); return true; }
    if (path.endsWith('/class_session_staff') && method === 'POST') { saved.push({ table: 'staff', body }); await route.fulfill({ status: 201, body: '' }); return true; }
    if (path.endsWith('/class_session_staff')) return reply(route, [{ session_id: 'a', user_id: COACH, is_lead: true }]);
    if (path.endsWith('/gym_members')) return reply(route, [{ user_id: COACH, role: 'coach' }, { user_id: ALEX, role: 'admin' }]);
    if (path.endsWith('/membership_plans')) return reply(route, [{ id: 'pl1', name: 'Premium', price_pence: 6000, billing_interval: 'monthly', access_type: 'hybrid', is_active: true }]);
    if (path.endsWith('/profiles')) return reply(route, [{ id: COACH, display_name: 'Coach Carla', first_name: null, last_name: null }, { id: ALEX, display_name: null, first_name: 'Alex', last_name: 'Admin' }]);
    return false;
  });

  await page.goto(`${base}/next/#/classes`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Classes', level: 1 }));
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
  c.ok('old class setup link kept (class types library)', (await page.getByRole('link', { name: 'Class setup' }).getAttribute('href')).includes('class-setup.html'));
  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);

  // Add class: validation first, then a real save of everything the form collects
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Add class' }).click();
  await c.has('add form opens', dialog.getByText('Add to timetable').first());
  c.ok('add form layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/class-form-${name}.png` });
  await c.has('staff options', dialog.getByLabel('Alex Admin · admin'));
  await c.has('plan options', dialog.getByLabel('Premium · £60.00'));
  await dialog.getByRole('button', { name: 'Save class' }).click();
  await c.has('blank form refused', dialog.getByText('Check the class name, date, duration and capacity values.'));
  c.ok('nothing saved on a bad form', saved.length === 0);
  await dialog.getByLabel('Class name').fill('Saturday Hybrid');
  await dialog.getByLabel('Date', { exact: true }).fill(nextSaturday);
  await dialog.getByLabel('Start time').fill('09:30');
  await dialog.getByLabel('Duration (minutes)').fill('45');
  await dialog.getByLabel('Total capacity').fill('10');
  await dialog.getByLabel('Reserved spaces', { exact: true }).fill('4');
  await c.has('worked example updates', dialog.getByText(/capacity 10 \+ 4 reserved means standard members can fill up to 6 places/));
  await dialog.getByLabel('Release reserved spaces').selectOption('120');
  await dialog.getByLabel('Description').fill('Bring water');
  await dialog.getByLabel('Alex Admin · admin').click();
  await dialog.getByLabel('Coach Carla · coach').click();
  await dialog.getByLabel('Premium · £60.00').click();
  await dialog.getByRole('button', { name: 'Save class' }).click();
  c.ok('form closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const sessionWrite = saved.find((w) => w.table === 'class_sessions')?.body;
  const startsExpected = new Date(`${nextSaturday}T09:30:00`);
  c.ok('class write', sessionWrite && sessionWrite.gym_id === GYM && sessionWrite.name === 'Saturday Hybrid' && sessionWrite.description === 'Bring water' && new Date(sessionWrite.starts_at).getTime() === startsExpected.getTime() && new Date(sessionWrite.ends_at).getTime() === startsExpected.getTime() + 45 * 60000 && sessionWrite.capacity === 10 && sessionWrite.reserved_capacity === 4 && sessionWrite.reserved_release_minutes_before === 120);
  c.ok('reserved plan write', JSON.stringify(saved.find((w) => w.table === 'reserved')?.body) === JSON.stringify([{ session_id: 'new1', plan_id: 'pl1' }]));
  c.ok('staff write: first ticked leads', JSON.stringify(saved.find((w) => w.table === 'staff')?.body) === JSON.stringify([{ session_id: 'new1', gym_id: GYM, user_id: ALEX, assignment_role: 'staff', is_lead: true }, { session_id: 'new1', gym_id: GYM, user_id: COACH, assignment_role: 'coach', is_lead: false }]));
  await c.has('timetable jumped to the new class week', page.getByRole('heading', { name: 'Next Week Mobility' }));
  c.ok('asked for the new class week', asked.some((b) => Math.abs(new Date(b.p_from).getTime() - (monday.getTime() + 7 * 86400000)) <= 3600000));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
