// Browser gate: the new member app (/m/today, /m/classes, /m/me) as a member on a phone and a desktop, and the
// "previewing" banner for an owner. Supabase is mocked at the network layer; booking and cancelling are recorded.
import { base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const london = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
const ymd = (iso) => { const p = london(iso); return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)); };
const classes = [
  { session_id: 'c1', name: 'Strength and Conditioning', description: '', starts_at: hours(26), ends_at: hours(27), capacity: 12, booked_count: 8, available_spaces: 4, is_booked: true },
  { session_id: 'c2', name: 'HIIT with a rather long class name to wrap', description: '', starts_at: hours(30), ends_at: hours(31), capacity: 12, booked_count: 8, available_spaces: 4, is_booked: false },
  { session_id: 'c3', name: 'Yoga flow', description: '', starts_at: hours(52), ends_at: hours(53), capacity: 10, booked_count: 10, available_spaces: 0, is_booked: false },
  { session_id: 'c4', name: 'Pilates', description: '', starts_at: hours(76), ends_at: hours(77), capacity: 10, booked_count: 2, available_spaces: 8, is_booked: false },
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.mem-days')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const role of ['member', 'owner']) {
  for (const [name, viewport] of Object.entries(sizes)) {
    process.env.MOCK_ROLE = role;
    const calls = [];
    const writes = [];
    const birthday = { value: null };
    const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
    await mockSupabase(page, async ({ route, path, select, body }) => {
      if (path.endsWith('/rpc/member_class_schedule')) return reply(route, classes);
      if (path.endsWith('/rpc/get_class_booking_options')) {
        const inc = body?.p_session_id !== 'c4';
        return reply(route, inc ? { included_with_membership: true } : { included_with_membership: false, can_pay_drop_in: true, drop_in_price_pence: 1200, upgrade_plans: [{ name: 'All access', price_pence: 6500, billing_interval: 'monthly' }] });
      }
      if (path.endsWith('/rpc/member_book_class') || path.endsWith('/rpc/member_cancel_class')) { calls.push(`${path.split('/').pop()} ${body?.p_session_id}`); return reply(route, { ok: true }); }
      if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
        ? [{ status: 'active', membership_plans: { name: 'Classes Monthly', includes_classes: true, includes_open_gym: false, includes_pt: false } }]
        : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
      if (path.endsWith('/profiles')) return reply(route, [{ display_name: 'Jo Marsh', first_name: 'Jo', last_name: 'Marsh', date_of_birth: birthday.value }]);
      if (path.endsWith('/pt_appointments')) return reply(route, []);
      return false;
    });
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (['PATCH', 'PUT'].includes(r.method()) && (u.pathname.endsWith('/profiles') || u.pathname.endsWith('/auth/v1/user'))) writes.push(`${r.method()} ${u.pathname.split('/').pop()} ${r.postData() ?? ''}`);
    });
    const c = runChecks();
    await page.goto(`${base}/m/today`);
    if (role === 'owner') {
      await c.has('an owner sees the preview banner', page.getByText(/Previewing the new member app as owner/));
      c.ok('and a way back', (await page.getByRole('link', { name: 'Back to the admin' }).count()) === 1);
      c.ok('no page errors', errors.length === 0);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
      if (!c.report(`${role} ${name}`)) allOk = false;
      await ctx.close();
      continue;
    }
    await c.has('no birthday yet, so it asks for one', page.getByLabel('Your birthday').getByText('Tell us your birthday'));
    c.ok('and does not wish anyone happy birthday', (await page.getByRole('dialog', { name: 'Happy birthday' }).count()) === 0);
    await c.has('the first screen opens with the next class', page.getByRole('heading', { name: /^Your next class is / }));
    c.ok('the top card is the booked class', (await page.getByLabel('Next class').textContent()).includes('Strength and Conditioning'));
    c.ok('four tabs for a classes member', (await page.getByRole('navigation', { name: 'Member' }).getByRole('link').allInnerTexts()).join('|') === 'Today|Classes|Workouts|Me');
    c.ok('no preview banner for a member', (await page.getByText(/Previewing/).count()) === 0);
    c.ok('greets by first name', (await page.getByText(/^Good (morning|afternoon|evening), Jo$/).count()) === 1);
    c.ok('layout (today)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/member-today-${name}.png` });

    await page.getByRole('button', { name: 'Book HIIT with a rather long class name to wrap' }).click();
    await c.has('booking confirms', page.getByText(/^Booked: HIIT/));
    c.ok('it asked the database to book', calls.includes('member_book_class c2'));

    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await c.has('cancelling asks first', page.getByRole('dialog').getByText('Cancel Strength and Conditioning?'));
    c.ok('layout (cancel dialog)', (await page.evaluate(layoutProblems)).length === 0);
    await page.getByRole('dialog').getByRole('button', { name: 'Keep it' }).click();
    c.ok('keeping it cancels nothing', !calls.some((x) => x.startsWith('member_cancel_class')));
    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel booking' }).click();
    await c.has('cancelled message', page.getByText('Cancelled: Strength and Conditioning.'));
    c.ok('it asked the database to cancel', calls.includes('member_cancel_class c1'));

    await page.getByRole('navigation', { name: 'Member' }).getByRole('link', { name: 'Classes' }).click();
    await c.has('classes page', page.getByRole('heading', { name: 'Classes', exact: true }));
    const today = ymd(new Date().toISOString());
    const strip = page.getByRole('group', { name: 'Choose a day' }).getByRole('button');
    c.ok('fourteen days', (await strip.count()) === 14);
    const idx2 = (ymd(classes[1].starts_at) - today) / 864e5;
    await strip.nth(idx2).click();
    c.ok('the day shows its classes', (await page.getByRole('article').count()) >= 1 && (await page.getByRole('button', { name: /^Book HIIT/ }).count()) === 1);
    const idx3 = (ymd(classes[2].starts_at) - today) / 864e5;
    await strip.nth(idx3).click();
    c.ok('a full class cannot be booked', await page.getByRole('button', { name: 'Full Yoga flow' }).isDisabled());
    const idx4 = (ymd(classes[3].starts_at) - today) / 864e5;
    await strip.nth(idx4).click();
    await page.getByRole('button', { name: 'Book Pilates' }).click();
    await c.has('a class outside the plan says so', page.getByRole('dialog').getByText('Pilates is not included in your membership'));
    c.ok('with the drop-in price and no payment', (await page.getByRole('dialog').textContent()).includes('£12.00') && (await page.getByRole('dialog').textContent()).includes('not switched on'));
    c.ok('nothing was booked', !calls.includes('member_book_class c4'));
    c.ok('layout (not included dialog)', (await page.evaluate(layoutProblems)).length === 0);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    c.ok('layout (classes)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/member-classes-${name}.png` });

    await page.getByRole('navigation', { name: 'Member' }).getByRole('link', { name: 'Workouts' }).click();
    await c.has('a classes-only member can still log their own workout', page.getByRole('link', { name: 'Start my own workout' }));
    c.ok('layout (workouts)', (await page.evaluate(layoutProblems)).length === 0);
    await page.getByRole('navigation', { name: 'Member' }).getByRole('link', { name: 'Me' }).click();
    await c.has('me page shows the plan', page.getByLabel('Membership').getByText('Classes Monthly'));
    c.ok('and the classic app link', (await page.getByRole('link', { name: 'Open the classic app' }).getAttribute('href')).includes('member.html?gym_id='));
    c.ok('layout (me)', (await page.evaluate(layoutProblems)).length === 0);

    // Add a birthday: asked for, checked, saved, and shown
    await page.getByRole('button', { name: 'Add birthday' }).click();
    await page.getByRole('button', { name: 'Save birthday' }).click();
    await c.has('a birthday is needed', page.getByRole('alert').getByText('Choose your date of birth.'));
    await page.getByLabel('Date of birth').fill('1990-03-14');
    await page.getByRole('button', { name: 'Save birthday' }).click();
    await c.has('birthday saved', page.getByText('Your birthday has been saved.'));
    c.ok('the profile row got exactly that date', writes.some((w) => w.startsWith('PATCH profiles') && w.includes('"date_of_birth":"1990-03-14"')));
    c.ok('layout (birthday)', (await page.evaluate(layoutProblems)).length === 0);

    // Change name, email and password
    await page.getByRole('button', { name: 'Change name' }).click();
    await page.getByLabel('Name shown to others').fill('');
    await page.getByRole('button', { name: 'Save name' }).click();
    await c.has('a name is needed', page.getByRole('alert').getByText('Add the name you want to be shown as.'));
    await page.getByLabel('Name shown to others').fill('Joanna Marsh');
    await page.getByLabel('First name').fill('Joanna');
    await page.getByRole('button', { name: 'Save name' }).click();
    await c.has('name saved', page.getByText('Your name has been updated.'));
    c.ok('the profile and the sign-in account were both updated', writes.some((w) => w.startsWith('PATCH profiles') && w.includes('"display_name":"Joanna Marsh"') && w.includes('"first_name":"Joanna"')) && writes.some((w) => w.startsWith('PUT user') && w.includes('Joanna Marsh')));

    await page.getByRole('button', { name: 'Change email' }).click();
    await page.getByLabel('New email address').fill('nope');
    await page.getByRole('button', { name: 'Send confirmation' }).click();
    await c.has('a bad email is refused', page.getByRole('alert').getByText('Enter a valid email address.'));
    await page.getByLabel('New email address').fill('OWNER@example.test');
    await page.getByRole('button', { name: 'Send confirmation' }).click();
    await c.has('the same email is refused', page.getByRole('alert').getByText('That is already your email address.'));
    await page.getByLabel('New email address').fill('jo.new@example.test');
    await page.getByRole('button', { name: 'Send confirmation' }).click();
    await c.has('email change asks for confirmation', page.getByText(/Check jo\.new@example\.test/));
    c.ok('it says the old address is kept until confirmed', (await page.getByRole('status').first().textContent()).includes('you sign in with owner@example.test'));
    c.ok('the request carried the new address', writes.some((w) => w.startsWith('PUT user') && w.includes('"email":"jo.new@example.test"')));

    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('New password again').fill('short');
    await page.getByRole('button', { name: 'Save password' }).click();
    await c.has('a short password is refused', page.getByRole('alert').getByText(/at least 8 characters/));
    await page.getByLabel('New password', { exact: true }).fill('a-long-password-1');
    await page.getByLabel('New password again').fill('a-different-one-2');
    await page.getByRole('button', { name: 'Save password' }).click();
    await c.has('mismatched passwords are refused', page.getByRole('alert').getByText('The two passwords do not match.'));
    await page.getByLabel('New password again').fill('a-long-password-1');
    await page.getByRole('button', { name: 'Save password' }).click();
    await c.has('password saved', page.getByText('Your password has been changed.'));
    c.ok('the password request was sent', writes.some((w) => w.startsWith('PUT user') && w.includes('"password":"a-long-password-1"')));
    c.ok('layout (me after changes)', (await page.evaluate(layoutProblems)).length === 0);
    // On their birthday the app says so once, with confetti, and not again that year
    const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    birthday.value = `1990-${londonToday.slice(5)}`;
    await page.goto(`${base}/m/today`);
    await page.reload();
    await c.has('happy birthday appears on the day', page.getByRole('dialog', { name: 'Happy birthday' }));
    c.ok('with their first name and the gym', (await page.getByRole('dialog', { name: 'Happy birthday' }).textContent()).includes('Happy birthday, Jo!') && (await page.getByRole('dialog', { name: 'Happy birthday' }).textContent()).includes('Puffin Performance'));
    await page.waitForTimeout(900); // the card finishes growing in before it is measured
    c.ok('layout (happy birthday)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/member-birthday-${name}.png` });
    await page.getByRole('button', { name: 'Thank you' }).click();
    c.ok('it closes', (await page.getByRole('dialog', { name: 'Happy birthday' }).count()) === 0);
    await page.reload();
    await page.getByRole('heading', { name: /./ }).first().waitFor();
    await page.waitForTimeout(500);
    c.ok('and does not come back the same year', (await page.getByRole('dialog', { name: 'Happy birthday' }).count()) === 0);
    c.ok('no page errors', errors.length === 0);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
    if (!c.report(`${role} ${name}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
