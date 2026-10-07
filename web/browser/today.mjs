// Browser gate: the new shell and Today screen, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer (no real account or data), so this proves the screen,
// the typed data layer's requests and the layout, not live data.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

const handle = async ({ route, path, select, method }) => {
  if (path.endsWith('/gym_members')) return reply(route, [
    { user_id: 'a', joined_at: day(400), attrition_on: null }, { user_id: 'b', joined_at: day(200), attrition_on: null },
    { user_id: 'c', joined_at: day(100), attrition_on: day(20) }, { user_id: 'd', joined_at: day(3), attrition_on: null },
  ]);
  if (path.endsWith('/memberships') && select.includes('membership_plans')) return reply(route, [
    { membership_plans: { price_pence: 4500, billing_interval: 'monthly' } }, { membership_plans: { price_pence: 12000, billing_interval: 'quarterly' } },
  ]);
  if (path.endsWith('/memberships') && method === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': '*/2' } }); return true; }
  if (path.endsWith('/membership_plans')) return reply(route, [
    { id: 'p1', name: 'Hybrid Monthly', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true },
    { id: 'p2', name: 'Old plan', price_pence: 3000, billing_interval: 'monthly', access_type: 'classes', is_active: false },
  ]);
  if (path.endsWith('/channels')) return reply(route, [{ id: 'c1', name: 'general', description: 'Everyone' }, { id: 'c2', name: 'pbs', description: null }]);
  if (path.endsWith('/profiles')) return reply(route, { display_name: 'Josh Owner', first_name: 'Josh' });
  if (path.endsWith('/rpc/get_class_calendar')) {
    const s = (id, name, start, booked, cap) => ({ session_id: id, name, starts_at: start, ends_at: start, booked_count: booked, capacity: cap, is_cancelled: false, spaces_left: cap - booked, description: '', availability_note: '', bookable_for_me: true, my_booking_status: '', reserved_capacity: 0, reserved_eligible: false, reserved_plan_names: [], reserved_release_minutes_before: 0 });
    return reply(route, [s('s1', 'Strength', at(7, 30), 9, 12), s('s2', 'Hybrid WOD', at(18, 0), 1, 12), s('s3', 'Yoga', at(19, 30), 6, 10)]);
  }
  return false;
};

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, handle);
  await page.goto(`${base}/next/#/today`);
  const c = runChecks();
  await c.has('greeting', page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Josh\.$/ }));
  await c.has('summary', page.getByText(/need(s)? a look|Nothing needs you/));
  await c.has('needs: quiet class', page.getByText(/Hybrid WOD on .* has 1 of 12 places booked/));
  await c.has('kpi active members', page.getByText('Active members'));
  await c.has('kpi expected income', page.getByText('£85.00')); // 4500 + 12000/3
  await c.has('classes today row', page.getByText('Strength'));
  await c.has('plans', page.getByText('Hybrid Monthly'));
  await c.has('channels', page.getByText('# general'));
  await c.has('trend chart', page.getByRole('img', { name: /Active members over the last 12 months, now 3/ }));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  c.ok('navigation', name === 'desktop' ? await page.getByRole('navigation', { name: 'Main' }).isVisible() : await page.getByRole('button', { name: 'Open menu' }).isVisible());
  c.ok('no horizontal overflow', !overflow);
  c.ok('no page errors', errors.length === 0);
  if (shots) await page.screenshot({ path: `${shots}/today-${name}.png`, fullPage: true });
  if (name === 'phone' && shots) { await page.getByRole('button', { name: 'Open menu' }).click(); await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/menu-phone.png` }); }
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
