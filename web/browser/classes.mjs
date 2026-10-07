// Browser gate: the Classes timetable (read-only), signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Checks what is on screen, the exact date range asked for
// when moving between weeks, and the same layout rules as audit.mjs (no sideways scroll, nothing off
// screen, 40px tap targets).
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const COACH = '66666666-6666-4666-8666-666666666666';
const monday = (() => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
const at = (dayOffset, h, m = 0) => { const x = new Date(monday); x.setDate(x.getDate() + dayOffset); x.setHours(h, m, 0, 0); return x.toISOString(); };
const row = (over) => ({ session_id: 's', name: 'Class', starts_at: at(0, 9), ends_at: at(0, 10), booked_count: 3, capacity: 12, spaces_left: 9, is_cancelled: false, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0, ...over });
const thisWeek = [
  row({ session_id: 'a', name: 'Strength and conditioning with a rather long class name', starts_at: at(0, 7, 30), ends_at: at(0, 8, 30), description: 'Heavy lifting and finishers, all levels welcome', booked_count: 9, capacity: 12, spaces_left: 3 }),
  row({ session_id: 'b', name: 'Evening Hybrid', starts_at: at(0, 18), ends_at: at(0, 19), reserved_capacity: 4, reserved_plan_names: ['Premium', 'Hybrid Monthly'], availability_note: 'Premium only' }),
  row({ session_id: 'c', name: 'Cancelled Spin', starts_at: at(2, 12), ends_at: at(2, 13), is_cancelled: true }),
  row({ session_id: 'd', name: 'Sunday Long Run', starts_at: at(6, 10), ends_at: at(6, 11), spaces_left: 0, availability_note: 'Full' }),
];
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
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && !u.pathname.includes('/rpc/get_class_calendar') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`); });
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/get_class_calendar')) {
      asked.push(body);
      return reply(route, new Date(body.p_from).getTime() === monday.getTime() ? thisWeek : nextWeek);
    }
    if (path.endsWith('/class_session_staff')) return reply(route, [{ session_id: 'a', user_id: COACH, is_lead: true }]);
    if (path.endsWith('/profiles')) return reply(route, [{ id: COACH, display_name: 'Coach Carla', first_name: null, last_name: null }]);
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
  c.ok('old Add a class link kept', (await page.getByRole('link', { name: 'Add a class' }).getAttribute('href')).includes('class-setup.html'));
  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
