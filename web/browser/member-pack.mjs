// Browser gate: class packs on a member's Classes screen. A member whose plan does not cover a class but who holds a pack
// books straight through, is told a pack class was used, and is told when a cancel gave the class back. Supabase is mocked.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const london = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
const ymd = (iso) => { const p = london(iso); return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)); };
const row = (id, name, h, booked = false) => ({ session_id: id, name, description: '', starts_at: hours(h), ends_at: hours(h + 1), capacity: 10, booked_count: 3, available_spaces: 7, is_booked: booked });
const classes = [row('p1', 'Pack Hyrox', 50), row('p2', 'Pack Engine', 74, true)];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  process.env.MOCK_ROLE = 'member';
  for (const withPack of [true, false]) {
    const calls = [];
    const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
    await mockSupabase(page, async ({ route, path, body }) => {
      if (path.endsWith('/rpc/member_class_schedule')) return reply(route, classes);
      if (path.endsWith('/rpc/get_my_waitlists')) return reply(route, []);
      if (path.endsWith('/rpc/get_class_booking_options')) return reply(route, { included_with_membership: false, can_pay_drop_in: false, drop_in_price_pence: 0, upgrade_plans: [] });
      if (path.endsWith('/class_packs')) return reply(route, withPack ? [{ credits_left: 3, expires_at: null, voided_at: null }, { credits_left: 4, expires_at: null, voided_at: hours(-5) }] : []);
      if (path.endsWith('/rpc/member_book_class')) { calls.push(`book ${body?.p_session_id}`); return reply(route, { status: 'booked', used_pack: true }); }
      if (path.endsWith('/rpc/member_cancel_class')) { calls.push(`cancel ${body?.p_session_id}`); return reply(route, { status: 'cancelled', class_returned: true }); }
      if (path.endsWith('/memberships')) return reply(route, []);
      if (path.endsWith('/pt_appointments')) return reply(route, []);
      return false;
    });
    const c = runChecks();
    await page.goto(`${base}/m/classes`);
    await c.has('classes page', page.getByRole('heading', { name: 'Classes', exact: true }));
    const today = ymd(new Date().toISOString());
    const strip = page.getByRole('group', { name: 'Choose a day' }).getByRole('button');
    const day = (i) => strip.nth((ymd(classes[i].starts_at) - today) / 864e5).click();
    const label = withPack ? 'with a pack' : 'no pack';

    if (withPack) {
      await c.has('the screen says how many pack classes are left', page.getByTestId('pack-left').getByText(/You have 3 pack classes left/));
      await day(0);
      await page.getByRole('button', { name: 'Book Pack Hyrox' }).click();
      await c.has('booking says a pack class was used', page.getByText(/^Booked: Pack Hyrox.*One pack class used, 2 pack classes left\./));
      c.ok('it asked the database to book', calls.includes('book p1'));
      c.ok('no "not included" box', (await page.getByRole('dialog').count()) === 0);
      await day(1);
      await page.getByRole('button', { name: 'Cancel Pack Engine' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click();
      await c.has('cancelling says the class went back', page.getByText('Cancelled: Pack Engine. The class went back on your pack.'));
      c.ok('it asked the database to cancel', calls.includes('cancel p2'));
    } else {
      c.ok('no pack line without a pack', (await page.getByTestId('pack-left').count()) === 0);
      await day(0);
      await page.getByRole('button', { name: 'Book Pack Hyrox' }).click();
      await c.has('without a pack it still says not included', page.getByRole('dialog').getByText('Pack Hyrox is not included in your membership'));
      c.ok('and nothing was booked', calls.length === 0);
    }
    c.ok('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    c.ok('no page errors', errors.length === 0);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
    if (!c.report(`member pack ${label} ${name}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
