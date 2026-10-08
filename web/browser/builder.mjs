// Browser gate: the Report builder (Reports > Report builder), at phone and desktop width. Supabase is mocked at the
// network layer with the same gym data as the library check. Checks the choices (dataset, columns, summary, filters,
// charts), the sheet of paper, real downloads, saved reports on the device, and that nothing is ever written.
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
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && !u.pathname.includes('/rpc/get_') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`);
  });
  await mockSupabase(page, async ({ route, path }) => {
    if (path.endsWith('/class_sessions')) return reply(route, sessions);
    if (path.endsWith('/class_bookings')) return reply(route, bookings);
    if (path.endsWith('/membership_plans')) return reply(route, plans);
    if (path.endsWith('/memberships')) return reply(route, memberships);
    if (path.endsWith('/gym_members')) return reply(route, gymMembers);
    if (path.endsWith('/profiles')) return reply(route, people);
    if (path.endsWith('/payment_records')) {
      const hdr = (await route.request().headerValue('range')) ?? '0-999';
      const [a, b] = hdr.split('-').map(Number);
      return reply(route, payments.slice(a, b + 1));
    }
    if (path.endsWith('/class_booking_purchases')) return reply(route, []);
    if (path.endsWith('/rpc/get_gym_team_accounts')) return reply(route, [{ user_id: 'c1', display_name: 'Coach Cara', email: 'cara@example.com', role: 'coach', is_active: true, access_status: 'active', joined_at: '2026-01-01T00:00:00Z' }, { user_id: 'c2', display_name: 'Sam Staff', email: 'sam@example.com', role: 'staff', is_active: true, access_status: 'active', joined_at: '2026-01-01T00:00:00Z' }]);
    if (path.endsWith('/staff_profiles')) return reply(route, [{ user_id: 'c1', job_title: 'Head coach', gross_hourly_rate_pence: 1500 }]);
    if (path.endsWith('/staff_working_hours')) return reply(route, [{ id: 'h1', user_id: 'c1', weekday: 1, is_working: true, start_time: '09:00:00', end_time: '17:00:00' }]);
    if (path.endsWith('/class_session_staff')) return reply(route, [{ id: 'cs1', session_id: 's1', user_id: 'c1', is_lead: true }, { id: 'cs2', session_id: 's2', user_id: 'c1', is_lead: true }]);
    if (path.endsWith('/pt_appointments')) return reply(route, [{ id: 'pt1', member_user_id: U2, staff_user_id: 'c1', starts_at: daysAgo(4), ends_at: daysAgo(4, 18), status: 'completed', notes: null }]);
    if (path.endsWith('/workout_assignments') || path.endsWith('/workout_sessions')) return reply(route, []);
    return false;
  });
  await page.goto(`${base}/next/#/reports`);
  const c = runChecks();
  await page.getByRole('tab', { name: 'Report builder', exact: true }).click();
  const paper = page.getByLabel('What you will download');
  const dataset = page.getByLabel('Look at');
  const dialog = page.getByRole('dialog');
  await c.has('builder opens', dataset);
  c.ok('eight tabs', (await page.getByRole('tab').count()) === 8);
  c.ok('eight datasets, staff included', (await dataset.locator('option').allInnerTexts()).join('|') === 'Members|Memberships|Payments|Classes|Bookings and attendance|Staff|Classes delivered|Clients seen');
  await page.getByRole('button', { name: /Start from a ready-made report/ }).click();
  c.ok('twelve ready-made reports', (await page.locator('.bld-starter').count()) === 12);
  c.ok('starts as a list of members on paper', (await paper.getByRole('heading', { name: 'Members' }).count()) === 1);
  c.ok('layout (builder, first view)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/builder-start-${name}.png`, fullPage: true });

  // A ready-made report: one click gives a chart, headline figures and the paper
  await page.getByRole('button', { name: /Money in, by month/ }).click();
  await c.has('the chart is drawn', page.getByRole('figure', { name: 'Payments: summary' }));
  c.ok('the starters fold away', (await page.locator('.bld-starter').count()) === 0);
  c.ok('headline figure is the total in pounds', (await page.getByRole('list', { name: 'Headline figures' }).textContent()).includes('£5,805.00'));
  c.ok('the boxes show what was chosen', (await page.getByLabel('Group by box').textContent()).includes('Charge date') && (await page.getByLabel('Filters box').getByLabel('Filter 1: value').inputValue()) === 'failed');
  c.ok('paper shows the months', (await paper.locator('tbody th').allInnerTexts()).join('|') === 'Sep 2026|Oct 2026');
  c.ok('chart marks have height', ((await page.getByRole('figure', { name: 'Payments: summary' }).locator('.chart-mark').first().boundingBox())?.height ?? 0) > 2);
  c.ok('layout (starter chart)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/builder-chart-${name}.png`, fullPage: true });

  // Click a bar to dig in, then narrow the report to it
  await page.getByRole('figure', { name: 'Payments: summary' }).locator('rect.chart-hit').first().click();
  await c.has('the rows behind the bar open', dialog.getByRole('heading', { name: /^Rows behind / }));
  c.ok('they are real payments', (await dialog.locator('tbody').textContent()).includes('Alex Joiner'));
  c.ok('layout (rows dialog)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Filter the report to this' }).click();
  await c.has('the report is narrowed and becomes a list', page.getByText(/^Narrowed the report to /));
  c.ok('with date filters added for that month', (await page.getByLabel('Filters box').getByLabel(/^Filter \d: condition$/).count()) === 3);

  // Drag a field into a box (and the tap way)
  await page.getByRole('button', { name: /Start from a ready-made report/ }).click();
  await page.getByRole('button', { name: /^Members by plan/ }).click();
  c.ok('a ring is drawn', (await page.getByRole('figure', { name: 'Memberships: summary' }).count()) === 1);
  await dataset.selectOption({ label: 'Payments' });
  await page.getByRole('radio', { name: 'Summarise' }).click();
  if (name === 'phone') await page.getByRole('button', { name: /^Amount\./ }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  if (name !== 'phone') await page.getByLabel('Values box').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.getByRole('button', { name: /^Amount\./ }).dragTo(page.getByLabel('Values box'));
  c.ok('dragging Amount into Values adds a total', (await page.getByLabel('Figure 2: what to work out').count()) === 1 && (await page.getByLabel('Figure 2: what to work out').inputValue()) === 'sum');
  if (name !== 'phone') await page.getByLabel('Group by box').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.getByRole('button', { name: /^State\./ }).dragTo(page.getByLabel('Group by box'));
  c.ok('dragging State into Group by groups by it', (await page.getByLabel('Group by box').textContent()).includes('State'));
  await page.getByRole('button', { name: /^Member\./ }).click();
  await page.getByRole('group', { name: 'Where should Member go?' }).getByRole('button', { name: 'Filter by' }).click();
  c.ok('tapping a field and choosing Filter by adds a filter', (await page.getByLabel('Filters box').getByLabel('Filter 1: field').inputValue()) === 'member');
  await page.getByRole('button', { name: 'Remove filter 1' }).click();
  await page.getByRole('button', { name: /^Member\./ }).click();
  await page.getByRole('group', { name: 'Where should Member go?' }).getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('button', { name: /^Member\./ }).click();
  await page.getByRole('group', { name: 'Where should Member go?' }).getByRole('button', { name: 'Add to Values' }).count().then((n) => c.ok('a text field cannot be added to Values', n === 0));
  await page.getByRole('button', { name: 'Number of rows. Drag it into a box, or tap to choose where it goes.' }).click();
  await page.getByRole('group', { name: 'Where should Number of rows go?' }).getByRole('button', { name: 'Add to Values' }).click();
  c.ok('Number of rows can be a value', (await page.getByLabel('Figure 2: what to work out').inputValue()) === 'count');

  // Staff metrics
  await dataset.selectOption({ label: 'Clients seen' });
  await page.getByRole('radio', { name: 'Summarise' }).click();
  await page.getByRole('button', { name: /^Coach\./ }).click();
  await page.getByRole('group', { name: 'Where should Coach go?' }).getByRole('button', { name: 'Group by' }).click();
  await page.getByLabel('Figure 1: what to work out').selectOption({ label: 'Different values' });
  await page.getByLabel('Figure 1: of which field').selectOption({ label: 'Client' });
  await c.has('clients seen by coach', paper.getByRole('heading', { name: 'Clients seen: summary' }));
  c.ok('the figure is named and counts people, not visits', (await paper.locator('thead th').allInnerTexts()).join('|') === 'Coach|Different values of Client' && (await paper.locator('tbody tr').first().textContent()).includes('Coach Cara'));
  await dataset.selectOption({ label: 'Staff' });
  c.ok('staff: the team with scheduled hours', (await paper.getByRole('heading', { name: 'Staff' }).count()) === 1 && (await paper.getByText('2 rows', { exact: true }).count()) === 1);
  await page.getByRole('button', { name: /^Scheduled hours a week\./ }).click();
  await page.getByRole('group', { name: 'Where should Scheduled hours a week go?' }).getByRole('button', { name: 'Add as a column' }).click();
  c.ok('working hours per week: 8 for Cara (Monday 09:00 to 17:00)', (await paper.locator('tbody tr').first().textContent()).includes('8'));
  c.ok('hourly pay is marked personal', (await page.getByRole('button', { name: /^Hourly pay\./ }).locator('.tag').count()) === 1);

  // Downloads
  await dataset.selectOption({ label: 'Payments' });
  await page.getByRole('radio', { name: 'List the rows' }).click();
  await page.getByRole('radio', { name: 'CSV' }).click();
  const csv = await saved(page, () => page.getByRole('button', { name: 'Download CSV' }).click());
  const text = csv.bytes.toString('utf8');
  c.ok('the CSV has every row and the chosen columns', text.trim().split('\r\n').length === 131 && text.startsWith('﻿Member,Charge date,Amount,State,Provider\r\n'));
  c.ok('money is in pounds and names are protected', text.includes('£59.99') && text.includes(`"'=HYPERLINK(""http://evil.example"")"`));
  c.ok('file name', /^puffin-performance-payments-\d{4}-\d{2}-\d{2}\.csv$/.test(csv.name));
  await page.getByRole('radio', { name: 'Excel' }).click();
  const xl = await saved(page, () => page.getByRole('button', { name: 'Download Excel' }).click());
  c.ok('Excel is a real workbook', xl.name.endsWith('.xlsx') && xl.bytes.subarray(0, 2).toString() === 'PK');
  await page.getByRole('radio', { name: 'PDF' }).click();
  const pdf = await saved(page, () => page.getByRole('button', { name: 'Download PDF' }).click());
  c.ok('PDF is a real PDF', pdf.name.endsWith('.pdf') && pdf.bytes.subarray(0, 4).toString() === '%PDF');

  // Save on this device, reload, bring it back
  await page.getByRole('radio', { name: 'Summarise' }).click();
  await page.getByRole('button', { name: /^State\./ }).click();
  await page.getByRole('group', { name: 'Where should State go?' }).getByRole('button', { name: 'Group by' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await c.has('a name is needed', page.getByText('Give the report a name to save it.'));
  await page.getByLabel('Save this report').fill('Payments by state');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await c.has('saved message', page.getByText('Saved "Payments by state" on this device.'));
  await page.reload();
  await page.getByRole('tab', { name: 'Report builder', exact: true }).click();
  await c.has('the saved report is listed after a reload', page.getByLabel('My saved reports'));
  await page.getByLabel('My saved reports').selectOption('Payments by state');
  c.ok('loading it restores the choices', (await dataset.inputValue()) === 'payments' && (await page.getByLabel('Group by box').textContent()).includes('State'));
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  c.ok('it can be removed', (await page.getByLabel('My saved reports').count()) === 0);

  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
