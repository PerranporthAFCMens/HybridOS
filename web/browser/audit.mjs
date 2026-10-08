// Browser gate: a generic layout audit for EVERY screen and pop-up (UI_RULES.md rule 6).
// At 320, 390 and 1280px, with the wide iPhone date-box width faked, it fails if:
//   - the page scrolls sideways,
//   - anything sticks out past its parent's edge or off the screen,
//   - a button, link-button or form box is shorter than 40px (the tap-target rule).
// Add a new screen or pop-up to STATES below; no per-screen layout check needs writing.
import { USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage } from './mock.mjs';

const ADA = '33333333-3333-4333-8333-333333333333';
const at = (h, m = 0, d = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const SIZES = { phone320: { width: 320, height: 640 }, phone390: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

const handle = async ({ route, url, path, select }) => {
  if (path.endsWith('/gym_members')) return reply(route, [{ user_id: ADA, joined_at: '2026-03-01T00:00:00', attrition_on: null }, { user_id: 'b', joined_at: '2026-05-01T00:00:00', attrition_on: null }]);
  if (path.endsWith('/profiles')) {
    // Like the real database: a request for one person (id=eq.X) gets only that person.
    const rows = [
      { id: USER, display_name: null, first_name: 'Alexandra', last_name: 'Montgomery-Featherstonehaugh' },
      { id: ADA, display_name: null, first_name: 'Adam', last_name: 'Turner-With-A-Very-Long-Surname' },
      { id: 'b', display_name: 'Bob Adams', first_name: null, last_name: null },
    ];
    const eq = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
    return reply(route, url.searchParams.get('id')?.startsWith('eq.') ? rows.filter((r) => r.id === eq) : rows);
  }
  if (path.endsWith('/memberships') && select.includes('starts_on')) return reply(route, [{ id: 'm1', status: 'active', starts_on: '2026-03-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', membership_plans: { name: 'Hybrid Monthly with a long plan name', price_pence: 4500, billing_interval: 'monthly' } }]);
  if (path.endsWith('/memberships') && select.includes('membership_plans')) return reply(route, [{ user_id: ADA, status: 'active', membership_plans: { name: 'Hybrid Monthly' } }]);
  if (path.endsWith('/membership_plans')) return reply(route, [{ id: 'p1', name: 'Hybrid Monthly with a long plan name', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true, description: 'Everything included, with a longer description to wrap over a few lines on a narrow phone screen', joining_fee_pence: 1000, classes_per_week: null, includes_open_gym: true, includes_classes: true, includes_pt: false, is_public: true }]);
  if (path.endsWith('/channels')) return reply(route, [{ id: 'c1', name: 'general', description: 'Everyone' }]);
  if (path.endsWith('/rpc/get_class_calendar')) return reply(route, [{ session_id: 's1', name: 'Strength and conditioning with a long name', starts_at: at(7, 30), ends_at: at(8, 30), booked_count: 9, capacity: 12, is_cancelled: false, spaces_left: 3, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0 }]);
  return false;
};

// Each state: how to get to it. Add new screens and pop-ups here.
const STATES = {
  today: async (page) => { await page.goto(`${base}/next/#/today`); await page.getByText('Active members', { exact: true }).waitFor(); await page.getByText('Strength and conditioning').first().waitFor(); },
  members: async (page) => { await page.goto(`${base}/next/#/members`); await page.locator('.member-row').first().waitFor(); },
  plans: async (page) => { await page.goto(`${base}/next/#/plans`); await page.getByRole('heading', { name: /Hybrid Monthly/ }).waitFor(); },
  'plan form': async (page) => { await page.goto(`${base}/next/#/plans`); await page.getByRole('button', { name: 'New plan' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  classes: async (page) => { await page.goto(`${base}/next/#/classes`); await page.getByRole('button', { name: 'List', exact: true }).click(); await page.getByRole('heading', { name: /Strength and conditioning/ }).waitFor(); },
  'class calendar': async (page) => { await page.goto(`${base}/next/#/classes`); await page.getByRole('button', { name: 'Day', exact: true }).click(); await page.getByRole('button', { name: /^Add a class on .* at 09:00$/ }).waitFor(); },
  'class form': async (page) => { await page.goto(`${base}/next/#/classes`); await page.getByRole('button', { name: 'Add class' }).click(); await page.getByRole('dialog').getByLabel('Class name').waitFor(); },
  'member record': async (page) => { await page.goto(`${base}/next/#/members`); await page.locator('.member-row').first().click(); await page.getByRole('dialog').getByText('Customer lifecycle').waitFor(); await page.getByRole('dialog').getByRole('heading', { name: /Hybrid Monthly/ }).waitFor(); },
  settings: async (page) => { await page.goto(`${base}/next/#/settings`); await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor(); },
  staff: async (page) => { await page.goto(`${base}/next/#/staff`); await page.getByText('No team accounts yet.').waitFor(); },
  'staff form': async (page) => { await page.goto(`${base}/next/#/staff`); await page.getByRole('button', { name: 'Add staff login' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  rooms: async (page) => { await page.goto(`${base}/next/#/rooms`); await page.getByText('Nothing set up yet. Add your first room.').waitFor(); },
  'rooms form': async (page) => { await page.goto(`${base}/next/#/rooms`); await page.getByRole('button', { name: 'Add room or equipment' }).click(); await page.getByRole('dialog').getByLabel('Name').waitFor(); },
  access: async (page) => { await page.goto(`${base}/next/#/access`); await page.getByText('No access levels yet.').first().waitFor(); },
  'access form': async (page) => { await page.goto(`${base}/next/#/access`); await page.getByRole('button', { name: 'New access level' }).click(); await page.getByRole('dialog').getByLabel('Level name').waitFor(); },
  door: async (page) => { await page.goto(`${base}/next/#/door`); await page.getByRole('button', { name: 'Save door access' }).waitFor(); },
  'member view': async (page) => { await page.goto(`${base}/next/#/member-view`); await page.getByRole('button', { name: 'Save member view' }).waitFor(); },
  community: async (page) => { await page.goto(`${base}/next/#/community`); await page.getByText('No community posts yet.').waitFor(); },
  communications: async (page) => { await page.goto(`${base}/next/#/communications`); await page.getByRole('button', { name: 'Save template' }).waitFor(); },
  owners: async (page) => { await page.goto(`${base}/next/#/owners`); await page.getByText('No access invitations yet.').waitFor(); },
  menu: async (page, size) => { await page.goto(`${base}/next/#/today`); await page.getByText('Active members', { exact: true }).waitFor(); if (size.width < 900) { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(350); } },
};

// Runs inside the page. Returns a list of problems in plain words.
function audit() {
  const problems = [];
  const vw = window.innerWidth;
  const label = (e) => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + (e.textContent ? ` "${e.textContent.trim().slice(0, 24)}"` : ''));
  if (document.documentElement.scrollWidth > vw + 1) problems.push('the page scrolls sideways');
  const drawerClosed = vw < 900 && !document.querySelector('.shell.open');
  const root = document.querySelector('#root');
  for (const e of root.querySelectorAll('*')) {
    if (e instanceof SVGElement && e.tagName.toLowerCase() !== 'svg') continue;
    if (drawerClosed && e.closest('.side')) continue;
    if (e.closest('.backdrop, .menu-btn') && !e.matches('.menu-btn')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const fixedish = cs.position === 'fixed' || cs.position === 'absolute';
    // 1. off the screen sideways (modal and page ancestors may clip it, but it is still wrong)
    if (!fixedish && (r.right > vw + 1 || r.left < -1)) problems.push(`${label(e)} runs off the screen (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
    // 2. sticks out past its parent's edge
    const p = e.parentElement;
    if (p && !fixedish) {
      const pcs = getComputedStyle(p);
      if (pcs.display !== 'contents' && !/(auto|scroll|hidden|clip)/.test(pcs.overflowX)) {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1 || r.left < pr.left - 1) problems.push(`${label(e)} sticks out of ${label(p)} by ${Math.round(Math.max(r.right - pr.right, pr.left - r.left))}px`);
      }
    }
    // 3. tap targets
    const tag = e.tagName.toLowerCase();
    const interactive = tag === 'button' || tag === 'select' || tag === 'input' || tag === 'textarea' || e.matches('.btn') || (tag === 'a' && cs.display !== 'inline' && !e.closest('nav'));
    if (interactive && !e.closest('[data-dense]') && r.height < 40) problems.push(`${label(e)} is only ${Math.round(r.height)}px tall (tap targets must be 40px or more)`);
  }
  return [...new Set(problems)];
}

const browser = await launch();
let allOk = true;
const c = runChecks();
for (const [sizeName, viewport] of Object.entries(SIZES)) {
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, handle);
  await page.addInitScript(() => {
    // iPhone Safari gives date boxes a wide built-in width; fake that everywhere.
    const s = document.createElement('style');
    s.textContent = 'input[type=date]::-webkit-datetime-edit{display:inline-block;min-width:330px}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
  });
  for (const [stateName, go] of Object.entries(STATES)) {
    try { await go(page, viewport); } catch (e) { c.ok(`${sizeName} / ${stateName}: could not open (${String(e).split('\n')[0].slice(0, 80)})`, false); continue; }
    // the menu's name loads separately; audit with it in place (the test person has a very long surname)
    await page.locator('.account .who-name').waitFor({ state: 'attached', timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(150);
    const problems = await page.evaluate(audit);
    if (shots) await page.screenshot({ path: `${shots}/audit-${sizeName}-${stateName.replace(/ /g, '-')}.png`, fullPage: false });
    if (problems.length) { for (const p of problems.slice(0, 8)) console.log(`  ${sizeName} / ${stateName}: ${p}`); if (problems.length > 8) console.log(`  ...and ${problems.length - 8} more`); }
    c.ok(`${sizeName} / ${stateName}`, problems.length === 0);
  }
  c.ok(`${sizeName}: no page errors`, errors.length === 0);
  await ctx.close();
}
await browser.close();
if (!c.report('layout audit')) allOk = false;
process.exit(allOk ? 0 : 1);
