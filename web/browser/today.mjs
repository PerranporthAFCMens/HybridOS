// Browser gate: the new shell and Today screen, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer (no real account or data), so this proves the screen,
// the typed data layer's requests and the layout, not live data.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173';
const shots = process.env.SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || undefined;
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

const GYM = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const session = {
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'owner@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
};
const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

function reply(route, body, extra = {}) {
  const single = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
  const payload = single ? (Array.isArray(body) ? body[0] ?? null : body) : body;
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-0/${extra.count ?? (Array.isArray(body) ? body.length : 1)}` }, body: JSON.stringify(payload) });
}

async function mock(page) {
  await page.route('**/*.supabase.co/**', (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname, sel = u.searchParams.get('select') ?? '';
    if (p.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
    if (p.endsWith('/gym_members') && sel.includes('gyms(')) return reply(route, [{ gym_id: GYM, role: 'owner', gyms: { name: 'Puffin Performance', logo_url: null } }]);
    if (p.endsWith('/gym_members')) return reply(route, [
      { user_id: 'a', joined_at: day(400), attrition_on: null }, { user_id: 'b', joined_at: day(200), attrition_on: null },
      { user_id: 'c', joined_at: day(100), attrition_on: day(20) }, { user_id: 'd', joined_at: day(3), attrition_on: null },
    ]);
    if (p.endsWith('/memberships') && sel.includes('membership_plans')) return reply(route, [
      { membership_plans: { price_pence: 4500, billing_interval: 'monthly' } }, { membership_plans: { price_pence: 12000, billing_interval: 'quarterly' } },
    ]);
    if (p.endsWith('/memberships') && route.request().method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/2' } });
    if (p.endsWith('/memberships')) return reply(route, []);
    if (p.endsWith('/membership_plans')) return reply(route, [
      { id: 'p1', name: 'Hybrid Monthly', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true },
      { id: 'p2', name: 'Old plan', price_pence: 3000, billing_interval: 'monthly', access_type: 'classes', is_active: false },
    ]);
    if (p.endsWith('/channels')) return reply(route, [{ id: 'c1', name: 'general', description: 'Everyone' }, { id: 'c2', name: 'pbs', description: null }]);
    if (p.endsWith('/profiles')) return reply(route, { display_name: 'Josh Owner', first_name: 'Josh' });
    if (p.endsWith('/rpc/get_class_calendar')) {
      const s = (id, name, start, booked, cap) => ({ session_id: id, name, starts_at: start, ends_at: start, booked_count: booked, capacity: cap, is_cancelled: false, spaces_left: cap - booked, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0 });
      return reply(route, [s('s1', 'Strength', at(7, 30), 9, 12), s('s2', 'Hybrid WOD', at(18, 0), 1, 12), s('s3', 'Yoga', at(19, 30), 6, 10)]);
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

const browser = await chromium.launch({ executablePath });
let failed = false;
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(([key, value, gym]) => { localStorage.setItem(key, value); sessionStorage.setItem('hybrid-gym-id', gym); }, ['sb-mzgnhmeydhhpzgxlgudh-auth-token', JSON.stringify(session), GYM]);
  const page = await ctx.newPage();
  await mock(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/next/#/today`);
  const checks = [];
  const has = async (label, locator) => { const ok = await locator.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false); checks.push([label, ok]); };
  await has('greeting', page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Josh\.$/ }));
  await has('summary', page.getByText(/need(s)? a look|Nothing needs you/));
  await has('needs: quiet class', page.getByText(/Hybrid WOD on .* has 1 of 12 places booked/));
  await has('kpi active members', page.getByText('Active members'));
  await has('kpi expected income', page.getByText('£85.00')); // 4500 + 12000/3
  await has('classes today row', page.getByText('Strength'));
  await has('plans', page.getByText('Hybrid Monthly'));
  await has('channels', page.getByText('# general'));
  await has('trend chart', page.getByRole('img', { name: /Active members over the last 12 months, now 3/ }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const menuOk = name === 'desktop' ? await page.getByRole('navigation', { name: 'Main' }).isVisible() : await page.getByRole('button', { name: 'Open menu' }).isVisible();
  checks.push(['navigation', menuOk], ['no horizontal overflow', !overflow], ['no page errors', errors.length === 0]);
  if (shots) await page.screenshot({ path: `${shots}/today-${name}.png`, fullPage: true });
  if (name === 'phone' && shots) { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/menu-phone.png` }); }
  const bad = checks.filter(([, ok]) => !ok);
  console.log(`${name}: ${bad.length ? 'FAIL ' + bad.map(([l]) => l).join(', ') : 'PASS (' + checks.length + ' checks)'}`);
  if (bad.length) failed = true;
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
