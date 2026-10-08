// Browser gate: Access levels (levels and who has which), as an owner and as an admin, at phone and desktop
// width. Supabase is mocked at the network layer. Checks what is on screen and the exact requests: the owner's
// writes keep permissions the screen does not list, an admin gets a read-only view and can still assign, and
// nothing is written when a form is refused.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const levels = [
  { id: 'lvl-front', name: 'Front desk', description: 'Reception', permissions: { view_timetable: true, mark_attendance: true, future_flag: true } },
  { id: 'lvl-mgr', name: 'Manager', description: null, permissions: { full_access: true } },
];
const team = [
  { user_id: 'u-sam', display_name: 'Sam Coach', email: 'sam@example.com', role: 'coach', is_active: true, access_status: 'active' },
  { user_id: 'u-kim', display_name: 'Kim Desk', email: 'kim@example.com', role: 'staff', is_active: true, access_status: 'active' },
  { user_id: 'u-old', display_name: 'Gone Staff', email: 'gone@example.com', role: 'staff', is_active: false, access_status: 'revoked' },
  { user_id: 'u-own', display_name: 'Olly Owner', email: 'olly@example.com', role: 'owner', is_active: true, access_status: 'active' },
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



async function run(role) {
  process.env.MOCK_ROLE = role;
  const browser = await launch();
  let ok = true;
  for (const [name, viewport] of Object.entries(sizes)) {
    const writes = [];
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, url, path, method, body }) => {
      const table = ['staff_access_levels'].find((t) => path.endsWith(`/${t}`));
      const rpc = path.endsWith('/rpc/assign_staff_access_level');
      if ((table && ['POST', 'PATCH', 'DELETE'].includes(method)) || rpc) {
        writes.push({ what: table ?? 'assign', method, query: Object.fromEntries(url.searchParams), body });
        if (method === 'POST' && table) return reply(route, [{ id: 'lvl-new' }]);
        await route.fulfill({ status: 204, body: '' });
        return true;
      }
      if (path.endsWith('/staff_access_levels')) return reply(route, levels);
      if (path.endsWith('/rpc/get_gym_team_accounts')) return reply(route, team);
      if (path.endsWith('/staff_access')) return reply(route, [{ user_id: 'u-sam', access_level_id: 'lvl-front' }]);
      return false;
    });
    await page.goto(`${base}/next/#/access`);
    const c = runChecks();
    const dialog = page.getByRole('dialog');
    await c.has('heading', page.getByRole('heading', { name: 'Access levels', level: 1 }));
    await c.has('level shown with count', page.getByText('2 of 15 permissions'));
    await c.has('assigned names', page.getByText('Sam Coach').first());
    c.ok('revoked staff and owners are not listed for a level', (await page.getByText('Gone Staff').count()) === 0 && (await page.getByLabel('Access level for Olly Owner').count()) === 0);
    c.ok('Sam has Front desk selected', (await page.getByLabel('Access level for Sam Coach').inputValue()) === 'lvl-front');
    c.ok('layout (list)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/access-${role}-${name}.png`, fullPage: true });

    // Assign: allowed for owner and admin
    await page.getByLabel('Access level for Kim Desk').selectOption('lvl-mgr');
    await page.waitForTimeout(300);
    const as = writes.find((w) => w.what === 'assign');
    c.ok('assign exact call', as && as.body.target_gym_id === GYM && as.body.target_user_id === 'u-kim' && as.body.target_level_id === 'lvl-mgr');

    if (role === 'owner') {
      writes.length = 0;
      await page.getByRole('button', { name: 'Edit Front desk' }).click();
      c.ok('prefilled', (await dialog.getByLabel('Level name').inputValue()) === 'Front desk' && (await dialog.getByLabel('View full timetable').isChecked()) && !(await dialog.getByLabel('Create classes').isChecked()));
      c.ok('form layout', (await page.evaluate(layoutProblems)).length === 0);
      if (shots) await page.screenshot({ path: `${shots}/access-form-${name}.png` });
      await dialog.getByLabel('Level name').fill('manager');
      await dialog.getByRole('button', { name: 'Save level' }).click();
      await c.has('duplicate name refused', dialog.getByText(/already an access level called/));
      c.ok('nothing written yet', writes.length === 0);
      await dialog.getByLabel('Level name').fill('Front desk');
      await dialog.getByLabel('Create classes').check();
      await dialog.getByLabel('View full timetable').uncheck();
      await dialog.getByRole('button', { name: 'Save level' }).click();
      c.ok('closes after saving', await dialog.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false));
      const ed = writes.find((w) => w.what === 'staff_access_levels' && w.method === 'PATCH');
      const perms = ed?.body?.permissions ?? {};
      c.ok('edit scoped to this level and gym', ed && ed.query.id === 'eq.lvl-front' && ed.query.gym_id === `eq.${GYM}`);
      c.ok('edit keeps the unlisted key and sets the ticks', perms.future_flag === true && perms.create_classes === true && perms.view_timetable === false && perms.mark_attendance === true && Object.keys(perms).length === 16);

      writes.length = 0;
      await page.getByRole('button', { name: 'New access level' }).click();
      await dialog.getByLabel('Level name').fill('Cover');
      await dialog.getByLabel('View reporting').check();
      await dialog.getByRole('button', { name: 'Save level' }).click();
      await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
      const cr = writes.find((w) => w.method === 'POST');
      c.ok('create exact (with creator)', cr && cr.body.gym_id === GYM && cr.body.name === 'Cover' && cr.body.description === null && cr.body.created_by === USER && cr.body.permissions.view_reporting === true && cr.body.permissions.full_access === false);

      writes.length = 0;
      await page.getByRole('button', { name: 'Delete Front desk' }).click();
      await c.has('in-use level cannot be deleted', page.getByText('Move 1 staff member to another level before deleting this one.'));
      c.ok('no delete sent', writes.length === 0);
      await page.getByRole('button', { name: 'Delete Manager' }).click();
      c.ok('asks first', writes.length === 0 && (await page.getByRole('button', { name: 'Yes, delete' }).count()) === 1);
      await page.getByRole('button', { name: 'Keep' }).click();
      c.ok('keep writes nothing', writes.length === 0);
      await page.getByRole('button', { name: 'Delete Manager' }).click();
      await page.getByRole('button', { name: 'Yes, delete' }).click();
      await page.waitForTimeout(300);
      const del = writes.find((w) => w.method === 'DELETE');
      c.ok('delete scoped', del && del.query.id === 'eq.lvl-mgr' && del.query.gym_id === `eq.${GYM}`);
    } else {
      await c.has('owner controlled notice', page.getByText('Owner controlled:'));
      c.ok('no create button', (await page.getByRole('button', { name: 'New access level' }).count()) === 0);
      c.ok('no delete buttons', (await page.getByRole('button', { name: /^Delete / }).count()) === 0);
      writes.length = 0;
      await page.getByRole('button', { name: 'View Front desk' }).click();
      c.ok('read-only form', (await dialog.getByLabel('Level name').isDisabled()) && (await dialog.getByLabel('Create classes').isDisabled()) && (await dialog.getByRole('button', { name: 'Save level' }).count()) === 0);
      c.ok('read-only layout', (await page.evaluate(layoutProblems)).length === 0);
      c.ok('admin wrote nothing', writes.length === 0);
    }
    c.ok('no page errors', errors.length === 0);
    if (!c.report(`${role} ${name}`)) ok = false;
    await ctx.close();
  }
  await browser.close();
  return ok;
}
const owner = await run('owner');
const admin = await run('admin');
process.exit(owner && admin ? 0 : 1);
