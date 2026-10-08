// Browser gate: clicking into Reporting figures and bars, and downloading CSV, Excel and PDF files.
// Supabase is mocked at the network layer. Checks the rows behind each figure, the real downloaded files
// (a CSV with its byte-order mark and formula protection, an Excel file that really is a zip containing the
// rows, a PDF), and the same layout rules as audit.mjs with a table open.
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
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
  { id: 's1', name: 'Past A', starts_at: daysAgo(3), capacity: 10 },
  { id: 's2', name: 'Past B', starts_at: daysAgo(10), capacity: 10 },
];
const bookings = [
  ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, session_id: 's1', status: 'attended' })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `n${i}`, session_id: 's1', status: 'no_show' })),
];
const people = [
  { id: U1, display_name: 'Alex Joiner', first_name: null, last_name: null },
  { id: U2, display_name: '=HYPERLINK("http://evil.example")', first_name: null, last_name: null },
  { id: U3, display_name: null, first_name: 'Cara', last_name: 'Café, Jr' },
];

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
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname.endsWith('supabase.co') && !u.pathname.includes('/auth/') && !u.pathname.includes('/rpc/get_') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())) writes.push(`${r.method()} ${u.pathname}`); });
  await mockSupabase(page, async ({ route, path }) => {
    if (path.endsWith('/class_sessions')) return reply(route, sessions);
    if (path.endsWith('/class_bookings')) return reply(route, bookings);
    if (path.endsWith('/membership_plans')) return reply(route, plans);
    if (path.endsWith('/memberships')) return reply(route, [{ user_id: U1, plan_id: 'p1' }, { user_id: U2, plan_id: 'p1' }, { user_id: U3, plan_id: 'p2' }]);
    if (path.endsWith('/gym_members')) return reply(route, [{ user_id: U1, joined_at: daysAgo(5, 9).slice(0, 19), attrition_on: null }, { user_id: U3, joined_at: '2024-01-01T00:00:00', attrition_on: null }]);
    if (path.endsWith('/profiles')) return reply(route, people);
    return false;
  });
  await page.goto(`${base}/next/#/reports`);
  const c = runChecks();
  const dialog = page.getByRole('dialog');
  await c.has('stats loaded', page.getByRole('button', { name: /^Active memberships: 3/ }));

  // Click a figure: the rows behind it
  await page.getByRole('button', { name: /^Est\. MRR/ }).click();
  await c.has('income table opens', dialog.getByRole('heading', { name: 'Estimated monthly income by plan' }));
  c.ok('income rows: monthly plan twice, annual divided down', (await dialog.locator('tbody tr').allTextContents()).join('|').includes('£90') && (await dialog.locator('tbody tr').allTextContents()).join('|').includes('£40'));
  c.ok('subtitle names the gym and range', (await dialog.locator('.muted.small').first().textContent()).includes('Puffin Performance · Last 30 days'));
  c.ok('layout with a table open', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/reports-drill-${name}.png` });
  await page.keyboard.press('Escape');
  c.ok('Escape closes it', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));

  await page.getByRole('button', { name: /^New members: 1/ }).click();
  await c.has('new members table', dialog.getByRole('heading', { name: 'New members' }));
  c.ok('only the member who joined in range', (await dialog.locator('tbody tr').count()) === 1 && (await dialog.locator('tbody tr').first().textContent()).includes('Alex Joiner'));
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Click a bar: one plan's members
  await page.getByRole('button', { name: /^Annual: 1/ }).click();
  await c.has('plan members table', dialog.getByRole('heading', { name: 'Active members on Annual' }));
  c.ok('annual plan holder named', (await dialog.locator('tbody tr').first().textContent()).includes('Cara Café, Jr'));
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Click a bar for a day: only the classes on that day
  const dayWithClass = await page.evaluate((iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).format(new Date(iso)), sessions[0].starts_at);
  await page.getByRole('list', { name: 'Busiest days' }).getByRole('button', { name: new RegExp(`^${dayWithClass}:`) }).click();
  await c.has('classes on that day', dialog.getByRole('heading', { name: `Classes on ${dayWithClass}s` }));
  c.ok('class rows for that day', (await dialog.locator('tbody tr').allTextContents()).some((t) => t.includes('Past A')));
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Downloads from a table: active memberships (has the formula-looking name)
  await page.getByRole('button', { name: /^Active memberships: 3/ }).click();
  await c.has('active memberships table', dialog.getByRole('heading', { name: 'Active memberships' }));
  const csv = await saved(page, () => dialog.getByRole('button', { name: 'CSV' }).click());
  const csvText = csv.bytes.toString('utf8');
  c.ok('CSV file name', /^puffin-performance-active-memberships-\d{4}-\d{2}-\d{2}\.csv$/.test(csv.name));
  c.ok('CSV starts with a byte-order mark and the header', csvText.startsWith('﻿Member,Plan\r\n'));
  c.ok('CSV rows, quoting and formula protection', csvText.includes('"Cara Café, Jr",Annual') && csvText.includes(`"'=HYPERLINK(""http://evil.example"")"`) && csvText.includes('Alex Joiner,Hybrid Monthly with a long plan name'));
  const xlsx = await saved(page, () => dialog.getByRole('button', { name: 'Excel' }).click());
  const files = unzipSync(new Uint8Array(xlsx.bytes));
  const xml = Object.entries(files).filter(([k]) => k.endsWith('.xml')).map(([, v]) => strFromU8(v)).join('\n');
  c.ok('Excel file name', xlsx.name.endsWith('.xlsx'));
  c.ok('Excel is a real workbook holding the rows', 'xl/workbook.xml' in files && xml.includes('Alex Joiner') && xml.includes('Cara') && xml.includes('Member') && xml.includes(`'=HYPERLINK`));
  const pdf = await saved(page, () => dialog.getByRole('button', { name: 'PDF' }).click());
  c.ok('PDF is a real PDF', pdf.name.endsWith('.pdf') && pdf.bytes.subarray(0, 5).toString() === '%PDF-' && pdf.bytes.length > 1500);
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Whole-overview download
  const overviewCsv = await saved(page, () => page.getByRole('group', { name: 'Download' }).first().getByRole('button', { name: 'CSV' }).click());
  const oText = overviewCsv.bytes.toString('utf8');
  c.ok('overview CSV has every headline figure', oText.includes('Active memberships,3') && oText.includes('Est. MRR,£130') && oText.includes('Sessions analysed,2') && oText.includes('Membership mix: Annual,1'));

  c.ok(`read-only: no writes (${writes.join(', ') || 'none'})`, writes.length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
