// Browser gate: Reporting overview, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Checks every figure on screen against the fake data, that
// changing the date range asks for the right start date, that nothing is written, and the same layout
// rules as audit.mjs.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const daysAgo = (n, h = 17) => { const x = new Date(); x.setDate(x.getDate() - n); x.setHours(h, 30, 0, 0); return x.toISOString(); };
const daysAhead = (n, h = 17) => daysAgo(-n, h);
const plans = [
  { id: 'p1', name: 'Hybrid Monthly with a long plan name', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true },
  { id: 'p2', name: 'Annual', price_pence: 48000, billing_interval: 'annual', access_type: 'hybrid', is_active: true },
  { id: 'p3', name: 'Unused', price_pence: 100, billing_interval: 'monthly', access_type: 'gym', is_active: false },
];
const sessions = [
  { id: 's1', name: 'Past A', starts_at: daysAgo(3), capacity: 10 },
  { id: 's2', name: 'Past B', starts_at: daysAgo(10), capacity: 10 },
  { id: 's3', name: 'Future', starts_at: daysAhead(2), capacity: 10 },
];
const bookings = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, session_id: 's1', status: 'attended' })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `n${i}`, session_id: 's1', status: 'no_show' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, session_id: 's3', status: 'booked' })),
  { id: 'x1', session_id: 's2', status: 'cancelled' },
];
const members = [
  { user_id: 'u1', joined_at: daysAgo(5, 9).slice(0, 19), attrition_on: null },
  { user_id: 'u2', joined_at: '2024-01-01T00:00:00', attrition_on: null },
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
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
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
  const sessionAsks = [];
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && !u.pathname.includes('/rpc/get_') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`); });
  await mockSupabase(page, async ({ route, url, path }) => {
    if (path.endsWith('/class_sessions')) {
      const gte = url.searchParams.get('starts_at'); sessionAsks.push(gte);
      return reply(route, gte ? sessions.filter((s) => s.starts_at >= gte.replace(/^gte\./, '')) : sessions);
    }
    if (path.endsWith('/class_bookings')) return reply(route, bookings);
    if (path.endsWith('/membership_plans')) return reply(route, plans);
    if (path.endsWith('/memberships')) return reply(route, [{ plan_id: 'p1' }, { plan_id: 'p1' }, { plan_id: 'p2' }, { plan_id: null }]);
    if (path.endsWith('/gym_members')) return reply(route, members);
    return false;
  });
  await page.goto(`${base}/next/#/reports`);
  const c = runChecks();
  const stat = (label) => page.locator('.stat', { hasText: label }).locator('.stat-num');
  await c.has('heading', page.getByRole('heading', { name: 'Reporting', level: 1 }));
  await c.has('stats loaded', page.getByText('Active memberships', { exact: true }));
  const text = async (label) => (await stat(label).first().textContent())?.trim();
  c.ok('active memberships (4, one has no plan)', (await text('Active memberships')) === '4');
  c.ok('MRR 45+45+40 pounds', (await text('Est. MRR')) === '£130');
  c.ok('average fill: 12 of 30 places', (await text('Average class fill')) === '40%');
  c.ok('attendance rate: 6 of 8 in past classes', (await text('Attendance rate')) === '75%');
  c.ok('new members in the last 30 days', (await text('New members')) === '1');
  c.ok('class attendances', (await text('Class attendances')) === '6');
  c.ok('no-shows', (await text('No-shows')) === '2');
  c.ok('sessions analysed', (await text('Sessions analysed')) === '3');
  await c.has('busiest days list', page.getByRole('list', { name: 'Busiest days' }));
  c.ok('seven days listed in order', (await page.getByRole('list', { name: 'Busiest days' }).locator('.bar-label').allTextContents()).join() === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun');
  c.ok('four times of day listed', (await page.getByRole('list', { name: 'Busiest times of day' }).locator('.bar-label').allTextContents()).join() === 'Morning,Daytime,Evening,Late');
  const mix = await page.getByRole('list', { name: 'Active memberships by plan' }).locator('.bar-row').allTextContents();
  c.ok('plan mix biggest first, unused plans included', mix.length === 3 && mix[0].includes('Hybrid Monthly') && mix[0].endsWith('2') && mix[1].startsWith('Annual'));
  c.ok('old detailed reports link', (await page.getByRole('link', { name: 'Open the detailed reports' }).getAttribute('href')).includes('reporting.html'));
  c.ok('layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/reports-${name}.png`, fullPage: true });

  // Changing the range asks for a different start date; All time asks for no start date.
  await page.getByLabel('Date range').selectOption('0');
  await page.waitForTimeout(400);
  c.ok('all time asks for no start date', sessionAsks[sessionAsks.length - 1] === null);
  c.ok('all time includes the 10-day-old class', (await text('Sessions analysed')) === '3');
  await page.getByLabel('Date range').selectOption('365');
  await page.waitForTimeout(400);
  const last = sessionAsks[sessionAsks.length - 1];
  c.ok('12 months asks for a start date about a year back', typeof last === 'string' && Math.abs(Date.now() - 365 * 86400000 - new Date(last.replace(/^gte\./, '')).getTime()) < 120000);
  await page.getByLabel('Date range').selectOption('30');
  await page.waitForTimeout(300);
  const before = sessionAsks.length;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.waitForTimeout(400);
  c.ok('Refresh asks again', sessionAsks.length > before);
  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
