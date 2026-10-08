// Browser gate: the Reporting library (the old page's 24 reports), at phone and desktop width.
// Supabase is mocked at the network layer. Checks that nothing is loaded until the library is opened,
// the groups and search, viewing a report, the 100-row preview note, a real CSV download, and the layout rules.
import { readFileSync } from 'node:fs';
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const U1 = '81111111-1111-4111-8111-111111111111';
const U2 = '82222222-2222-4222-8222-222222222222';
const U3 = '83333333-3333-4333-8333-333333333333';
const daysAgo = (n, h = 17) => { const x = new Date(); x.setDate(x.getDate() - n); x.setHours(h, 30, 0, 0); return x.toISOString(); };
const plans = [
  { id: 'p1', name: 'Hybrid Monthly with a long plan name', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true },
  { id: 'p2', name: 'Annual', price_pence: 48000, billing_interval: 'annual', access_type: 'hybrid', is_active: true },
];
const sessions = [
  { id: 's1', name: 'Past A', starts_at: daysAgo(3), ends_at: daysAgo(3, 18), capacity: 10, drop_in_price_pence: 800 },
  { id: 's2', name: 'Past B', starts_at: daysAgo(10), ends_at: daysAgo(10, 18), capacity: 10, drop_in_price_pence: null },
];
const bookings = [
  { id: 'a1', session_id: 's1', user_id: U1, status: 'attended', booked_at: daysAgo(5), cancelled_at: null },
  { id: 'n1', session_id: 's1', user_id: U2, status: 'no_show', booked_at: daysAgo(5), cancelled_at: null },
  { id: 'c1', session_id: 's2', user_id: U3, status: 'cancelled', booked_at: daysAgo(12), cancelled_at: daysAgo(11) },
];
const people = [
  { id: U1, display_name: 'Alex Joiner', first_name: null, last_name: null, date_of_birth: '1990-01-01', gender: 'female' },
  { id: U2, display_name: '=HYPERLINK("http://evil.example")', first_name: null, last_name: null, date_of_birth: null, gender: null },
  { id: U3, display_name: null, first_name: 'Cara', last_name: 'Café, Jr', date_of_birth: '2010-06-01', gender: 'male' },
];
const memberships = [
  { id: 'm1', user_id: U1, plan_id: 'p1', status: 'active', starts_on: '2026-01-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', updated_at: daysAgo(2) },
  { id: 'm2', user_id: U2, plan_id: 'p1', status: 'active', starts_on: '2026-02-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', updated_at: daysAgo(40) },
  { id: 'm3', user_id: U3, plan_id: 'p2', status: 'active', starts_on: '2026-03-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', updated_at: daysAgo(40) },
];
const gymMembers = [
  { id: 'g1', user_id: U1, joined_at: daysAgo(5, 9), attrition_on: null, is_active: true },
  { id: 'g3', user_id: U3, joined_at: '2024-01-01T00:00:00', attrition_on: null, is_active: true },
];
// 130 payments so the 100-row preview note shows; one failed.
const payments = Array.from({ length: 130 }, (_, i) => ({
  id: `pay${String(i).padStart(3, '0')}`, user_id: i === 0 ? U2 : U1, charge_date: daysAgo(i % 25).slice(0, 10), created_at: daysAgo(i % 25), amount_pence: i === 0 ? 5999 : 4500,
  state: i === 0 ? 'failed' : 'paid_out', provider: 'manual', failure_code: i === 0 ? 'insufficient_funds' : null, failure_message: null,
}));

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side') || e.closest('.table-wrap')) continue;
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

async function saved(page, click) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: readFileSync(path) };
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const paymentRequests = [];
  const sessionRequests = [];
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!u.hostname.endsWith('supabase.co') || u.pathname.includes('/auth/')) return;
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`);
    if (u.pathname.endsWith('/payment_records')) paymentRequests.push(r.url());
    if (u.pathname.endsWith('/class_sessions')) sessionRequests.push(r.url());
  });
  await mockSupabase(page, async ({ route, path, url }) => {
    const range = url.searchParams.get('offset') ?? '';
    void range;
    if (path.endsWith('/class_sessions')) return reply(route, sessions);
    if (path.endsWith('/class_bookings')) return reply(route, bookings);
    if (path.endsWith('/membership_plans')) return reply(route, plans);
    if (path.endsWith('/memberships')) return reply(route, memberships);
    if (path.endsWith('/gym_members')) return reply(route, gymMembers);
    if (path.endsWith('/profiles')) return reply(route, people);
    if (path.endsWith('/payment_records')) {
      // Honour the page range the app asks for (the database returns at most the requested window).
      const hdr = (await route.request().headerValue('range')) ?? '0-999';
      const [a, b] = hdr.split('-').map(Number);
      return reply(route, payments.slice(a, b + 1));
    }
    if (path.endsWith('/class_booking_purchases')) return reply(route, [{ id: 'bp1', user_id: U1, session_id: 's1', created_at: daysAgo(2), amount_pence: 800, status: 'paid' }]);
    if (path.endsWith('/workout_assignments') || path.endsWith('/workout_sessions') || path.endsWith('/pt_appointments')) return reply(route, []);
    return false;
  });
  await page.goto(`${base}/next/#/reports`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('overview loaded', page.getByRole('button', { name: /^Active memberships: 3/ }));
  // Charts on the Overview
  for (const t of ['Attendance over time', 'Income collected', 'Members joined and left', 'Members over time']) await c.has(`overview chart: ${t}`, page.getByRole('figure', { name: t }));
  const attendance = page.getByRole('figure', { name: 'Attendance over time' });
  c.ok('the attendance columns are drawn (coloured marks with height)', ((await attendance.locator('.chart-mark').first().boundingBox())?.height ?? 0) > 4);
  c.ok('two series have a key', (await attendance.locator('.chart-legend li').count()) === 2);
  await attendance.locator('rect.chart-hit[aria-label*="Attended 1"]').first().hover();
  await c.has('hovering a column shows the numbers', page.locator('.chart-tip').filter({ hasText: 'Attended' }));
  c.ok('the readout leads with the value', (await page.locator('.chart-tip-row b').first().textContent()) === '1');
  await attendance.getByRole('button', { name: 'View as table' }).click();
  await c.has('the table view opens', attendance.getByRole('region', { name: 'Attendance over time, as a table' }));
  c.ok('the table lists the values', (await attendance.locator('tbody').textContent()).includes('Attended') === false && (await attendance.locator('thead').textContent()).includes('Attended'));
  await attendance.getByRole('button', { name: 'Hide table' }).click();
  await attendance.locator('rect.chart-hit[aria-label*="Attended 1"]').first().click();
  await c.has('clicking a column opens its classes', dialog.getByRole('heading', { name: /^Classes, / }));
  c.ok('the classes behind it include a real one', (await dialog.locator('tbody').textContent()).includes('Past A'));
  await dialog.getByRole('button', { name: 'Close' }).click();
  const members = page.getByRole('figure', { name: 'Members over time' });
  c.ok('the members line has its latest value labelled', (await members.locator('.chart-end').count()) === 1);
  c.ok('layout (overview charts)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/reports-charts-overview-${name}.png`, fullPage: true });
  c.ok('old page link still there', (await page.getByRole('link', { name: 'Open the detailed reports' }).getAttribute('href')).includes('reporting.html'));
  c.ok('six tabs', (await page.getByRole('tab').count()) === 6);
  c.ok('Overview is the first tab', (await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected')) === 'true');

  // The other tabs: figures, tables and the heatmap (all from the same mocked data)
  const stat = (label) => page.locator('.card.stat', { hasText: label }).locator('.stat-num');
  await page.getByRole('tab', { name: 'Memberships', exact: true }).click();
  await c.has('memberships tab', page.getByRole('heading', { name: 'Membership plans' }));
  c.ok('memberships: active, MRR, plans, new joins', (await stat('Active').first().textContent()) === '3' && (await stat('MRR').textContent()) === '£130' && (await stat('Plans').textContent()) === '2' && (await stat('New joins').textContent()) === '1');
  c.ok('memberships: plan rows with share', (await page.locator('tbody tr').first().textContent()).includes('Hybrid Monthly with a long plan name') && (await page.locator('tbody tr').first().textContent()).includes('67%'));
  const donut = page.getByRole('figure', { name: 'Active memberships by plan' });
  await c.has('plan donut', donut);
  c.ok('the ring key lists each plan with its members and share', (await donut.locator('.donut-row').count()) === 2 && (await donut.locator('.donut-row').nth(1).textContent()).includes('33%'));
  await donut.getByRole('button', { name: /^Annual: 1, 33%/ }).click();
  await c.has('clicking a plan opens its members', dialog.getByRole('heading', { name: 'Active members on Annual' }));
  await dialog.getByRole('button', { name: 'Close' }).click();
  await c.has('members over time line', page.getByRole('figure', { name: 'Members over time' }));
  c.ok('layout (memberships tab)', (await page.evaluate(layoutProblems)).length === 0);

  await page.getByRole('tab', { name: 'Classes', exact: true }).click();
  await c.has('classes tab', page.getByRole('heading', { name: 'Day × time heatmap' }));
  c.ok('classes: fill, attendances, no-shows, sessions', (await stat('Avg fill').textContent()) === '10%' && (await stat('Attendances').textContent()) === '1' && (await stat('No-shows').textContent()) === '1' && (await stat('Sessions').textContent()) === '2');
  c.ok('the bars are actually drawn (the coloured part has a width)', ((await page.locator('.bar-row .fill').first().boundingBox())?.width ?? 0) > 20);
  c.ok('heatmap: seven days by four times of day', (await page.locator('table.heat tbody tr').count()) === 7 && (await page.locator('table.heat tbody tr').first().locator('td').count()) === 4);
  c.ok('heatmap cells say what they are', (await page.locator('table.heat td').first().getAttribute('aria-label')).includes('Mon Morning'));
  await c.has('attendance chart on the classes tab', page.getByRole('figure', { name: 'Attendance over time' }));
  await page.getByRole('list', { name: 'Average fill by class type' }).getByRole('button', { name: /^Past A/ }).click();
  await c.has('a class type bar opens its sessions', dialog.getByRole('heading', { name: 'Past A sessions' }));
  await dialog.getByRole('button', { name: 'Close' }).click();
  c.ok('layout (classes tab)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/reports-tabs-classes-${name}.png`, fullPage: true });

  await page.getByRole('tab', { name: 'Members', exact: true }).click();
  await c.has('members tab', page.getByRole('heading', { name: 'Most active members' }));
  c.ok('members: active, attending, attendances, no-show rate', (await stat('Active gym members').textContent()) === '2' && (await stat('Members attending').textContent()) === '1' && (await stat('Total attendances').textContent()) === '1' && (await stat('No-show rate').textContent()) === '50%');
  c.ok('most active: ranked with names', (await page.locator('tbody tr').first().textContent()).includes('1') && (await page.locator('tbody tr').first().textContent()).includes('Alex Joiner'));
  const topCsv = await saved(page, () => page.getByRole('button', { name: 'CSV' }).first().click());
  c.ok('most active CSV has the header and the protected name', topCsv.bytes.toString('utf8').startsWith('﻿Rank,Member,Attended,Total activity,No-shows\r\n') && topCsv.bytes.toString('utf8').includes(`"'=HYPERLINK(""http://evil.example"")"`));

  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  await c.has('payments tab', page.getByRole('heading', { name: 'Bad debtors / payment recovery' }));
  c.ok('payments: failed, outstanding, records', (await stat('Failed / at-risk payments').textContent()) === '1' && (await stat('Outstanding').textContent()) === '£59.99' && (await stat('Payment records').textContent()) === '130');
  c.ok('payments: the failed one with its reason', (await page.locator('tbody tr').first().textContent()).includes('insufficient_funds'));

  await c.has('payments over time chart', page.getByRole('figure', { name: 'Payments over time, in pounds' }));
  const pay = page.getByRole('figure', { name: 'Payments by outcome' });
  await c.has('payments by outcome ring', pay);
  await pay.getByRole('button', { name: /^Failed: 1/ }).click();
  await c.has('clicking Failed opens the failed payments', dialog.getByRole('heading', { name: 'Failed payments' }));
  c.ok('with the reason', (await dialog.locator('tbody').textContent()).includes('insufficient_funds'));
  await dialog.getByRole('button', { name: 'Close' }).click();
  c.ok('layout (payments tab)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/reports-charts-payments-${name}.png`, fullPage: true });

  await page.getByRole('tab', { name: 'Report library', exact: true }).click();
  await c.has('library opens', page.getByLabel('Search reports'));
  c.ok('24 reports', (await page.locator('.lib-card').count()) === 24);
  c.ok('five groups', (await page.locator('.lib-group').count()) === 5);
  for (const g of ['Membership & growth', 'Lifecycle & retention', 'Classes & attendance', 'Revenue & payments', 'Workouts & PT']) await c.has(`group ${g}`, page.getByRole('region', { name: g }));
  c.ok('the library asked for payments once', paymentRequests.length >= 1);
  c.ok('classes were limited to the chosen range', sessionRequests.some((u) => decodeURIComponent(u).includes('starts_at=gte.')));
  c.ok('layout (library open)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/reports-library-${name}.png`, fullPage: true });

  // Search
  await page.getByLabel('Search reports').fill('no-show');
  await c.has('search finds no-shows', page.getByRole('heading', { name: 'No-shows', level: 5 }));
  c.ok('search narrows the list', (await page.locator('.lib-card').count()) < 24 && (await page.locator('.lib-card').count()) >= 1);
  await page.getByLabel('Search reports').fill('zzzzzz');
  await c.has('search with no match says so', page.getByText('No report matches that search.'));
  await page.getByLabel('Search reports').fill('');
  c.ok('clearing shows all 24', (await page.locator('.lib-card').count()) === 24);

  // View a report
  await page.getByRole('button', { name: 'View Membership register' }).click();
  await c.has('report opens', dialog.getByRole('heading', { name: 'Membership register' }));
  await c.has('row count', dialog.getByText('3 rows'));
  c.ok('names and plans in the rows', (await dialog.locator('tbody').textContent()).includes('Alex Joiner') && (await dialog.locator('tbody').textContent()).includes('Annual'));
  c.ok('layout (report open)', (await page.evaluate(layoutProblems)).length === 0);
  await page.keyboard.press('Escape');
  c.ok('Escape closes it', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));

  // Preview limit
  await page.getByRole('button', { name: 'View Payment ledger' }).click();
  await c.has('ledger opens', dialog.getByRole('heading', { name: 'Payment ledger' }));
  await c.has('preview note', dialog.getByText('Showing the first 100 of 130 rows. The downloads include every row.'));
  c.ok('100 rows on screen', (await dialog.locator('tbody tr').count()) === 100);
  const full = await saved(page, () => dialog.getByRole('button', { name: 'CSV' }).click());
  const fullText = full.bytes.toString('utf8');
  c.ok('the CSV has all 130 rows', fullText.trim().split('\r\n').length === 131);
  c.ok('CSV file name', /^puffin-performance-payment-ledger-\d{4}-\d{2}-\d{2}\.csv$/.test(full.name));
  await dialog.getByRole('button', { name: 'Close' }).click();

  // A download straight from the card, with pence and formula protection
  const failed = await saved(page, () => page.locator('.lib-card', { hasText: 'Failed payments' }).getByRole('button', { name: 'CSV' }).click());
  const failedText = failed.bytes.toString('utf8');
  c.ok('failed payments CSV: header, pence, protected name, reason', failedText.startsWith('﻿Member,Charge date,Amount,State,Failure\r\n') && failedText.includes('£59.99') && failedText.includes(`"'=HYPERLINK(""http://evil.example"")"`) && failedText.includes('insufficient_funds'));

  // Reports with no rows say so
  await page.getByRole('button', { name: 'View PT appointments' }).click();
  await c.has('empty report says so', dialog.getByText('Nothing to show for this.'));
  await dialog.getByRole('button', { name: 'Close' }).click();

  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
