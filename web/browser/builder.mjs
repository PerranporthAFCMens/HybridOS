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
    if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`);
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
    if (path.endsWith('/workout_assignments') || path.endsWith('/workout_sessions') || path.endsWith('/pt_appointments')) return reply(route, []);
    return false;
  });
  await page.goto(`${base}/next/#/reports`);
  const c = runChecks();
  await page.getByRole('tab', { name: 'Report builder', exact: true }).click();
  const paper = page.getByLabel('What you will download');
  const dataset = page.getByLabel('What do you want to look at?');
  await c.has('builder opens', dataset);
  c.ok('eight tabs now', (await page.getByRole('tab').count()) === 8);
  c.ok('five datasets to choose from', (await dataset.locator('option').allInnerTexts()).join('|') === 'Members|Memberships|Payments|Classes|Bookings and attendance');
  c.ok('starts as a list of members on paper', (await paper.getByRole('heading', { name: 'Members' }).count()) === 1 && (await paper.locator('thead th').count()) === 5);
  await c.has('the paper counts the rows', paper.getByText('2 rows'));
  c.ok('layout (builder, list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/builder-list-${name}.png`, fullPage: true });

  // Columns: add personal ones, move, remove
  await page.getByLabel('Add a column').selectOption({ label: 'Gender (personal)' });
  c.ok('a personal column is marked', (await page.getByText('personal', { exact: true }).count()) >= 1 && (await paper.locator('thead th').allInnerTexts()).includes('Gender'));
  await page.getByRole('button', { name: 'Move Gender up' }).click();
  c.ok('moving a column changes the paper', (await paper.locator('thead th').allInnerTexts()).join('|').includes('Gender|'));
  await page.getByRole('button', { name: 'Remove column Gender' }).click();
  c.ok('removing a column changes the paper', !(await paper.locator('thead th').allInnerTexts()).includes('Gender'));

  // Summary of payments by month, as columns
  await dataset.selectOption({ label: 'Payments' });
  await c.has('paper switches to payments', paper.getByRole('heading', { name: 'Payments' }));
  c.ok('130 payments listed', (await paper.getByText('130 rows', { exact: true }).count()) === 1 && (await paper.getByText('Showing the first 25 of 130 rows. The download has every row.').count()) === 1);
  await page.getByRole('radio', { name: /Summarise/ }).click();
  await page.getByLabel('Group by').selectOption({ label: 'Charge date' });
  await c.has('dates can be grouped', page.getByLabel('Group dates by'));
  await page.getByLabel('Figure 1: what to work out').selectOption({ label: 'Total' });
  await page.getByLabel('Figure 1: of which field').selectOption({ label: 'Amount' });
  await c.has('the summary is on paper', paper.getByRole('heading', { name: 'Payments: summary' }));
  c.ok('headers are the group and the figure', (await paper.locator('thead th').allInnerTexts()).join('|') === 'Charge date|Total of Amount');
  const chartRadio = page.getByRole('radiogroup', { name: 'Chart' });
  c.ok('charts on offer', (await chartRadio.getByRole('radio').allInnerTexts()).join('|') === 'Table|Columns|Bars|Line|Ring');
  await chartRadio.getByRole('radio', { name: 'Columns' }).click();
  const fig = page.getByRole('figure', { name: 'Payments: summary' });
  await c.has('a column chart is drawn', fig);
  c.ok('with coloured marks that have height', ((await fig.locator('.chart-mark').first().boundingBox())?.height ?? 0) > 2);
  c.ok('layout (summary + chart)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/builder-chart-${name}.png`, fullPage: true });
  for (const k of ['Line', 'Bars', 'Ring']) {
    await chartRadio.getByRole('radio', { name: k }).click();
    c.ok(`${k} chart shows`, (await page.locator('main .card, .card').filter({ hasText: 'Chart' }).first().isVisible()));
  }
  await chartRadio.getByRole('radio', { name: 'Table' }).click();
  c.ok('Table hides the chart card', (await page.getByRole('heading', { name: 'Chart', exact: true }).count()) === 0);

  // A filter: only failed payments
  await page.getByRole('radio', { name: /List the rows/ }).click();
  await page.getByRole('button', { name: 'Add a filter' }).click();
  await page.getByLabel('Filter 1: field').selectOption({ label: 'State' });
  await page.getByLabel('Filter 1: condition').selectOption({ label: 'is' });
  await page.getByLabel('Filter 1: value').fill('failed');
  await c.has('the filter narrows the paper', paper.getByText('1 row'));
  c.ok('the subtitle counts the filter', (await paper.textContent()).includes('1 filter'));
  await page.getByLabel('Filter 1: field').selectOption({ label: 'Amount' });
  await page.getByLabel('Filter 1: condition').selectOption({ label: 'is more than' });
  await page.getByLabel('Filter 1: value').fill('50');
  await c.has('money filters are in pounds', paper.getByText('1 row'));

  // Real downloads: everything, not just the paper
  await page.getByRole('button', { name: 'Remove filter 1' }).click();
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
  await page.getByRole('radio', { name: /Summarise/ }).click();
  await page.getByLabel('Group by').selectOption({ label: 'State' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await c.has('a name is needed', page.getByText('Give the report a name to save it.'));
  await page.getByLabel('Save this report').fill('Payments by state');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await c.has('saved message', page.getByText('Saved "Payments by state" on this device.'));
  await page.reload();
  await page.getByRole('tab', { name: 'Report builder', exact: true }).click();
  await c.has('the saved report is listed after a reload', page.getByLabel('My saved reports'));
  await page.getByLabel('My saved reports').selectOption('Payments by state');
  c.ok('loading it restores the choices', (await dataset.inputValue()) === 'payments' && (await page.getByLabel('Group by').inputValue()) === 'state');
  await c.has('and the paper', paper.getByRole('heading', { name: 'Payments: summary' }));
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  c.ok('it can be removed', (await page.getByLabel('My saved reports').count()) === 0);

  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
