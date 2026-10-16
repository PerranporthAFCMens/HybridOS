// Browser gate: the waitlist on a member's Classes and Today screens. Join a full class, see the place in line, leave,
// take an offered place, and find a class that filled up between loading and tapping Book. Supabase is mocked.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const london = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
const ymd = (iso) => { const p = london(iso); return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)); };
const row = (id, name, h, free) => ({ session_id: id, name, description: '', starts_at: hours(h), ends_at: hours(h + 1), capacity: 10, booked_count: 10 - free, available_spaces: free, is_booked: false });
const classes = [row('f1', 'Full Hyrox', 50, 0), row('f2', 'Offered Engine', 74, 0), row('f3', 'Racing Strength', 98, 3)];

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  process.env.MOCK_ROLE = 'member';
  const calls = [];
  const lines = { f1: null, f2: { session_id: 'f2', status: 'offered', queue_position: null, offer_expires_at: hours(0.2) } };
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/member_class_schedule')) return reply(route, classes);
    if (path.endsWith('/rpc/get_my_waitlists')) return reply(route, Object.values(lines).filter(Boolean));
    if (path.endsWith('/rpc/member_join_waitlist')) { calls.push(`join ${body?.p_session_id}`); lines.f1 = { session_id: 'f1', status: 'waiting', queue_position: 2, offer_expires_at: null }; return reply(route, { status: 'waiting', position: 2 }); }
    if (path.endsWith('/rpc/member_leave_waitlist')) { calls.push(`leave ${body?.p_session_id}`); lines[body?.p_session_id] = null; return reply(route, { status: 'left' }); }
    if (path.endsWith('/rpc/get_class_booking_options')) return reply(route, { included_with_membership: true });
    if (path.endsWith('/rpc/member_book_class')) {
      calls.push(`book ${body?.p_session_id}`);
      if (body?.p_session_id === 'f3') { await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'This class is full' }) }); return true; }
      lines[body?.p_session_id] = null;
      return reply(route, { status: 'booked' });
    }
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

  await day(0);
  await c.has('a full class says Full and offers the waitlist', page.getByRole('button', { name: 'Join the waitlist for Full Hyrox' }));
  await page.getByRole('button', { name: 'Join the waitlist for Full Hyrox' }).click();
  await c.has('joining says so', page.getByText(/You're on the waitlist for Full Hyrox/));
  await c.has('and shows the place in line', page.getByText("You're 2nd in line"));
  c.ok('it asked the database to join', calls.includes('join f1'));
  await page.getByRole('button', { name: 'Leave the waitlist for Full Hyrox' }).click();
  await c.has('leaving says so', page.getByText(/You've left the waitlist for Full Hyrox/));
  c.ok('it asked the database to leave', calls.includes('leave f1'));
  await c.has('and the join button is back', page.getByRole('button', { name: 'Join the waitlist for Full Hyrox' }));

  await day(1);
  await c.has('an offered place shows the time left', page.getByText(/A place is held for you: \d+ minutes? left/));
  c.ok('with Book it and No thanks', (await page.getByRole('button', { name: 'Book your held place in Offered Engine' }).count()) === 1 && (await page.getByRole('button', { name: 'Decline the place in Offered Engine' }).count()) === 1);
  const layout = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  c.ok('no sideways scroll with the offer buttons', layout);
  await page.getByRole('button', { name: 'Book your held place in Offered Engine' }).click();
  await c.has('taking the offer books the class', page.getByText(/^Booked: Offered Engine/));
  c.ok('it asked the database to book', calls.includes('book f2'));

  await day(2);
  await page.getByRole('button', { name: 'Book Racing Strength' }).click();
  await c.has('a class that filled up meanwhile says so', page.getByText('That class is full now. You can join the waitlist.'));
  await c.has('and now offers the waitlist', page.getByRole('button', { name: 'Join the waitlist for Racing Strength' }));

  c.ok('no page errors', errors.length === 0);
  if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
  if (!c.report(`waitlist ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
