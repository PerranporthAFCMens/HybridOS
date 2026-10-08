// Browser gate: Staff (the team list, add a login, edit, remove) and the Settings hub, signed in as an owner,
// at phone and desktop width. Supabase is mocked at the network layer. Checks what is on screen and the exact
// requests: only what changed is written, qualification dates are kept, removal is last and asks first.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const CAP = 'cap-spin';
const LEVEL = 'lvl-front';
const USER_A = '33333333-3333-4333-8333-333333333333';
const team = [
  { user_id: USER_A, display_name: 'Sam Coach', email: 'sam@example.com', role: 'coach', is_active: true, access_status: 'active' },
  { user_id: '44444444-4444-4444-8444-444444444444', display_name: 'Olly Owner', email: 'olly@example.com', role: 'owner', is_active: true, access_status: 'active' },
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const p = e.parentElement;
    if (p && cs.position !== 'fixed' && cs.position !== 'absolute' && !e.closest('.menu-btn')) {
      const pr = p.getBoundingClientRect();
      if (getComputedStyle(p).display !== 'contents' && (r.right > pr.right + 1 || r.left < pr.left - 1)) problems.push(`${name} sticks out of its parent`);
    }
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}


const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const fnCalls = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, path, method, body, url }) => {
    if (path.includes('/functions/v1/admin-create-staff-with-level')) {
      fnCalls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'new-user', temp_password: 'Temp-Pass-123' }) });
      return true;
    }
    const table = ['gym_members', 'staff_profiles', 'staff_working_hours', 'staff_capabilities'].find((t) => path.endsWith(`/${t}`));
    const rpc = ['assign_staff_access_level', 'remove_gym_staff_access'].find((t) => path.endsWith(`/rpc/${t}`));
    if ((table && ['POST', 'PATCH', 'DELETE'].includes(method)) || rpc) {
      writes.push({ what: table ?? rpc, method, query: Object.fromEntries(url.searchParams), body });
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/rpc/get_gym_team_accounts')) return reply(route, team);
    if (path.endsWith('/staff_profiles')) return reply(route, [{ user_id: USER_A, job_title: 'Head coach', gross_hourly_rate_pence: 1500, employment_type: 'hourly' }]);
    if (path.endsWith('/staff_working_hours')) return reply(route, [{ user_id: USER_A, weekday: 1, is_working: true, start_time: '09:00:00', end_time: '17:00:00' }]);
    if (path.endsWith('/capabilities')) return reply(route, [{ id: CAP, name: 'Spin instructor' }, { id: 'cap-pt', name: 'Personal trainer' }]);
    if (path.endsWith('/staff_capabilities')) return reply(route, [{ user_id: USER_A, capability_id: CAP, expires_on: '2099-01-01' }]);
    if (path.endsWith('/staff_access_levels')) return reply(route, [{ id: LEVEL, name: 'Front desk' }, { id: 'lvl-mgr', name: 'Manager' }]);
    if (path.endsWith('/staff_access')) return reply(route, [{ user_id: USER_A, access_level_id: LEVEL }]);
    return false;
  });

  // Settings hub
  await page.goto(`${base}/next/#/settings`);
  const c = runChecks();
  await c.has('settings heading', page.getByRole('heading', { name: 'Settings', level: 1 }));
  await c.has('hub lists staff', page.getByText('Logins, hours, qualifications and removing access.'));
  c.ok('layout (settings)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/settings-${name}.png`, fullPage: true });

  await page.goto(`${base}/next/#/staff`);
  await c.has('staff heading', page.getByRole('heading', { name: 'Staff', level: 1 }));
  await c.has('team member shown', page.getByText('Sam Coach').first());
  await c.has('hours summary and pay', page.getByText(/Head coach/));
  await c.has('qualification tag', page.getByText(/Spin instructor/).first());
  c.ok('owner is not editable here', (await page.getByRole('button', { name: 'Edit Olly Owner' }).count()) === 0);
  c.ok('owner links to the owners and admins screen', (await page.getByRole('link', { name: 'Manage access' }).getAttribute('href')) === '#/owners');
  c.ok('layout (staff)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/staff-${name}.png`, fullPage: true });

  // Edit Sam: change pay only; add a second qualification with a date
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Edit Sam Coach' }).click();
  await c.has('edit form', dialog.getByText('Edit Sam Coach').first());
  c.ok('prefilled', (await dialog.getByLabel('Job title').inputValue()) === 'Head coach' && (await dialog.getByLabel('Gross hourly pay (£)').inputValue()) === '15.00');
  c.ok('existing expiry kept', (await dialog.getByLabel('Spin instructor expires on').inputValue()) === '2099-01-01');
  { const lp = await page.evaluate(layoutProblems); if (lp.length) console.log(lp.slice(0,8)); c.ok('edit form layout', lp.length === 0); }
  if (shots) await page.screenshot({ path: `${shots}/staff-form-${name}.png` });
  await dialog.getByLabel('Gross hourly pay (£)').fill('-3');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  c.ok('bad pay refused, nothing written', writes.length === 0 && (await dialog.locator('.msg, [role=alert]').count()) > 0);
  await dialog.getByLabel('Gross hourly pay (£)').fill('16.50');
  await dialog.getByLabel('Personal trainer').check();
  await dialog.getByLabel('Personal trainer expires on').fill('2030-05-01');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  c.ok('form closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
  const prof = writes.find((w) => w.what === 'staff_profiles');
  c.ok('details upsert has the new pay', prof && JSON.stringify(prof.body).includes('"gross_hourly_rate_pence":1650') && JSON.stringify(prof.body).includes(`"gym_id":"${GYM}"`));
  const qual = writes.find((w) => w.what === 'staff_capabilities' && w.method === 'POST');
  c.ok('only the new qualification is written, with its date', qual && JSON.stringify(qual.body) === JSON.stringify([{ gym_id: GYM, user_id: USER_A, capability_id: 'cap-pt', qualified: true, expires_on: '2030-05-01' }]));
  c.ok('nothing removed, role and level untouched', !writes.some((w) => w.method === 'DELETE' || w.what === 'gym_members' || w.what === 'assign_staff_access_level'));

  // Add a login: temporary password shown
  await page.getByRole('button', { name: 'Add staff login' }).click();
  await dialog.getByRole('button', { name: 'Create login' }).click();
  c.ok('empty new login refused, no call made', fnCalls.length === 0);
  await dialog.getByLabel('Name').fill('Pat New');
  await dialog.getByLabel('Email').fill('pat@example.com');
  await dialog.getByLabel('Access level').selectOption(LEVEL);
  await dialog.getByRole('button', { name: 'Create login' }).click();
  await c.has('temporary password shown', page.getByLabel('Temporary password').getByText('Temp-Pass-123'));
  c.ok('create call exact', fnCalls.length === 1 && fnCalls[0].email === 'pat@example.com' && fnCalls[0].gym_id === GYM && fnCalls[0].access_level_id === LEVEL);
  await page.getByRole('button', { name: 'Done' }).click();

  // Remove asks first
  writes.length = 0;
  await page.getByRole('button', { name: 'Remove Sam Coach' }).click();
  c.ok('asked first, nothing written', writes.length === 0);
  await page.getByRole('button', { name: 'Keep' }).click();
  c.ok('keep writes nothing', writes.length === 0);
  await page.getByRole('button', { name: 'Remove Sam Coach' }).click();
  await page.getByRole('button', { name: 'Yes, remove' }).click();
  await page.waitForTimeout(300);
  const rem = writes.find((w) => w.what === 'remove_gym_staff_access');
  c.ok('removal call exact', rem && rem.body.target_gym_id === GYM && rem.body.target_user_id === USER_A);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
