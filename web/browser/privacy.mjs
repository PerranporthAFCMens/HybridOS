// Browser gate: "Who sees member details" (Settings). The owner can change it; an admin can read it but not change it.
import { GYM, base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const browser = await launch();
let allOk = true;
for (const [role, label] of [['owner', 'owner'], ['admin', 'admin']]) {
  for (const [name, viewport] of Object.entries(sizes)) {
    process.env.MOCK_ROLE = role;
    const calls = [];
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, path, body }) => {
      if (path.endsWith('/rpc/get_member_contact_visibility')) return reply(route, { team_sees_phone: true, team_sees_address: true }, 1);
      if (path.endsWith('/rpc/set_member_contact_visibility')) {
        calls.push(body);
        return reply(route, { team_sees_phone: body.p_team_sees_phone, team_sees_address: body.p_team_sees_address }, 1);
      }
      return false;
    });
    await page.goto(`${base}/member-privacy`);
    const c = runChecks();
    await c.has('heading', page.getByRole('heading', { name: 'Who sees member details' }));
    const phone = page.getByLabel("The team can see members' mobile numbers");
    const address = page.getByLabel("The team can see members' addresses");
    await c.has('both start ticked (nothing chosen yet means visible)', phone);
    c.ok('both ticked', (await phone.isChecked()) && (await address.isChecked()));
    c.ok('it says emergency contacts stay visible', (await page.getByText(/Emergency contacts, and a parent or guardian/).count()) === 1);
    if (role === 'owner') {
      await phone.uncheck();
      await page.getByRole('button', { name: 'Save' }).click();
      await c.has('saved', page.getByText('Saved.'));
      c.ok('sent for this gym with the phone hidden and the address still visible', calls.length === 1 && calls[0].p_gym_id === GYM && calls[0].p_team_sees_phone === false && calls[0].p_team_sees_address === true);
    } else {
      c.ok('an admin cannot change it', (await phone.isDisabled()) && (await address.isDisabled()) && (await page.getByRole('button', { name: 'Save' }).count()) === 0);
      await c.has('and is told why', page.getByText("Only the gym's owner can change this."));
    }
    c.ok('no horizontal overflow', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    c.ok('no page errors', errors.length === 0);
    if (!c.report(`${label} ${name}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
