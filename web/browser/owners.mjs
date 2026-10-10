// Browser gate: Owners and admins (invites, people, ownership decisions), as an owner and as an admin, at phone
// and desktop width. Supabase is mocked at the network layer. Checks what is on screen, which buttons each row
// offers, that every risky action asks first, and the exact request of every action.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const future = '2099-01-01T10:00:00Z';
const team = [
  { user_id: USER, display_name: 'Olly Owner', email: 'olly@example.com', role: 'owner', is_active: true, access_status: 'active' },
  { user_id: 'u-ann', display_name: 'Ann Owner', email: 'ann@example.com', role: 'owner', is_active: true, access_status: 'active' },
  { user_id: 'u-bob', display_name: 'Bob Admin', email: 'bob@example.com', role: 'admin', is_active: true, access_status: 'active' },
  { user_id: 'u-cal', display_name: 'Cal Pending', email: 'cal@example.com', role: 'admin', is_active: true, access_status: 'pending' },
  { user_id: 'u-sam', display_name: 'Sam Coach', email: 'sam@example.com', role: 'coach', is_active: true, access_status: 'active' },
  { user_id: 'u-gone', display_name: 'Gone Admin', email: 'gone@example.com', role: 'admin', is_active: false, access_status: 'revoked' },
];
const base_ = { created_at: '2026-10-01T10:00:00Z', expires_at: future, claimed_by: null, email_sent_at: null, delivery_method: 'email' };
const invites = [
  { ...base_, id: 'inv-own', email: 'dan@example.com', invitee_name: 'Dan New', status: 'awaiting_approval', invite_role: 'owner' },
  { ...base_, id: 'inv-adm', email: 'eve@example.com', invitee_name: null, status: 'open', invite_role: 'admin' },
  { ...base_, id: 'inv-link', email: 'fay@example.com', invitee_name: 'Fay Link', status: 'open', invite_role: 'admin', delivery_method: 'link', email_sent_at: '2026-10-02T10:00:00Z' },
  { ...base_, id: 'inv-old', email: 'old@example.com', invitee_name: 'Old Invite', status: 'open', invite_role: 'admin', expires_at: '2020-01-01T00:00:00Z' },
  { ...base_, id: 'inv-done', email: 'done@example.com', invitee_name: 'Done Person', status: 'approved', invite_role: 'admin', claimed_by: 'u-bob' },
];
const actions = [{ id: 'act-1', action_type: 'promote_owner', target_user_id: 'u-bob' }];

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
    const calls = [];
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, path, body }) => {
      if (path.includes('/functions/v1/send-access-invite')) { calls.push({ fn: 'send-access-invite', body }); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'sent@example.com' }) }); return true; }
      const rpc = ['create_email_access_invite', 'create_shareable_access_invite', 'approve_shareable_owner_invite', 'approve_email_owner_invite', 'approve_pending_access', 'propose_owner_promotion', 'propose_owner_removal', 'approve_ownership_action', 'remove_admin_access', 'revoke_admin_invite', 'delete_admin_invite'].find((r) => path.endsWith(`/rpc/${r}`));
      if (rpc) {
        writes.push({ rpc, body });
        if (rpc === 'create_email_access_invite') return reply(route, [{ invite_id: 'inv-new', status: body.requested_role === 'owner' ? 'awaiting_approval' : 'open', owner_approvals: 1, owner_approvals_required: 2 }]);
        if (rpc === 'create_shareable_access_invite') return reply(route, [{ invite_id: 'inv-new', status: 'open', owner_approvals: 0, owner_approvals_required: 1, token: 'secret-token' }]);
        if (rpc === 'approve_email_owner_invite') return reply(route, [{ owner_approvals: 2, owner_approvals_required: 2, ready_to_send: true, status: 'open' }]);
        if (rpc === 'approve_pending_access' || rpc === 'propose_owner_promotion') return reply(route, { executed: false });
        return reply(route, true);
      }
      if (path.endsWith('/rpc/get_gym_team_accounts')) return reply(route, team);
      if (path.endsWith('/gym_admin_invites')) return reply(route, invites);
      if (path.endsWith('/gym_ownership_actions')) return reply(route, actions);
      if (path.endsWith('/gym_access_invite_approvals')) return reply(route, [{ invite_id: 'inv-own', owner_user_id: 'u-ann' }]);
      if (path.endsWith('/gym_ownership_action_approvals')) return reply(route, [{ action_id: 'act-1', owner_user_id: 'u-ann' }]);
      return false;
    });
    await page.goto(`${base}/owners`);
    const c = runChecks();
    await c.has('heading', page.getByRole('heading', { name: 'Owners and admins', level: 1 }));
    if (role === 'admin') {
      await c.has('owner-only message', page.getByText('Only an active owner can manage admin and owner access.'));
      c.ok('no invite form for an admin', (await page.getByRole('button', { name: 'Send invitation email' }).count()) === 0);
      c.ok('layout (admin)', (await page.evaluate(layoutProblems)).length === 0);
      c.ok('no page errors', errors.length === 0);
      if (!c.report(`${role} ${name}`)) ok = false;
      await ctx.close();
      continue;
    }
    await c.has('people listed', page.getByText('Bob Admin').first());
    c.ok('removed and non-admin people hidden', (await page.getByText('Gone Admin').count()) === 0 && (await page.getByText('Sam Coach').count()) === 0);
    await c.has('owner approvals count', page.getByText('1 of 2 owner approvals recorded'));
    await c.has('owner invite approvals', page.getByText(/1 of 2 owner approvals/).first());
    await c.has('expired shown', page.getByText('expired').first());
    c.ok('layout (owner)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/owners-${name}.png`, fullPage: true });

    // Which buttons each row offers
    c.ok('owners: removal request only (another owner exists), never a direct remove', (await page.getByRole('button', { name: 'Request Owner removal for Ann Owner' }).count()) === 1 && (await page.getByRole('button', { name: 'Remove access for Ann Owner' }).count()) === 0);
    c.ok('active admin can be promoted and removed', (await page.getByRole('button', { name: 'Promote Bob Admin to Owner' }).count()) === 1 && (await page.getByRole('button', { name: 'Remove access for Bob Admin' }).count()) === 1);
    c.ok('pending admin has Approve, not Promote', (await page.getByRole('button', { name: 'Approve Admin Cal Pending' }).count()) === 1 && (await page.getByRole('button', { name: 'Promote Cal Pending to Owner' }).count()) === 0);
    c.ok('owner invite needs my approval', (await page.getByRole('button', { name: 'Approve Owner invite for Dan New' }).count()) === 1);
    c.ok('email invite can be sent, link invite cannot', (await page.getByRole('button', { name: 'Send email to eve@example.com' }).count()) === 1 && (await page.getByRole('button', { name: /email to Fay Link/ }).count()) === 0);
    c.ok('approved invite cannot be revoked or deleted', (await page.getByRole('button', { name: 'Revoke invite for Done Person' }).count()) === 0 && (await page.getByRole('button', { name: 'Delete invite for Done Person' }).count()) === 0);
    c.ok('ownership decision I have not approved', (await page.getByRole('button', { name: 'Approve decision: Promote Admin to Owner' }).count()) === 1);

    // Risky actions ask first, and Cancel sends nothing
    await page.getByRole('button', { name: 'Remove access for Bob Admin' }).click();
    await c.has('asks first', page.getByRole('alertdialog').getByText(/Remove Bob Admin\?/));
    c.ok('nothing sent while asking', writes.length === 0);
    await page.getByRole('button', { name: 'Cancel' }).click();
    c.ok('cancel sends nothing', writes.length === 0);
    await page.getByRole('button', { name: 'Remove access for Bob Admin' }).click();
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await page.waitForTimeout(300);
    const rm = writes.find((w) => w.rpc === 'remove_admin_access');
    c.ok('remove admin exact call', rm && rm.body.target_gym_id === GYM && rm.body.target_user_id === 'u-bob');

    writes.length = 0;
    await page.getByRole('button', { name: 'Promote Bob Admin to Owner' }).click();
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await c.has('waiting message after promote', page.getByText('Your approval is recorded. Waiting for the other owner approval(s).'));
    c.ok('promote exact call', writes.some((w) => w.rpc === 'propose_owner_promotion' && w.body.target_user_id === 'u-bob' && w.body.target_gym_id === GYM));

    writes.length = 0;
    await page.getByRole('button', { name: 'Request Owner removal for Ann Owner' }).click();
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await page.waitForTimeout(300);
    c.ok('owner removal is only a request', writes.length === 1 && writes[0].rpc === 'propose_owner_removal' && writes[0].body.target_user_id === 'u-ann');

    writes.length = 0;
    await page.getByRole('button', { name: 'Approve Admin Cal Pending' }).click();
    c.ok('approve access asks first', writes.length === 0);
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await page.waitForTimeout(300);
    c.ok('approve access exact call', writes.some((w) => w.rpc === 'approve_pending_access' && w.body.target_user_id === 'u-cal'));

    writes.length = 0;
    await page.getByRole('button', { name: 'Approve decision: Promote Admin to Owner' }).click();
    await page.waitForTimeout(300);
    c.ok('approve ownership decision exact call', writes.some((w) => w.rpc === 'approve_ownership_action' && w.body.target_action_id === 'act-1'));

    // Invites
    writes.length = 0;
    await page.getByRole('button', { name: 'Revoke invite for Eve' }).or(page.getByRole('button', { name: 'Revoke invite for eve@example.com' })).click();
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await page.waitForTimeout(300);
    c.ok('revoke exact call', writes.some((w) => w.rpc === 'revoke_admin_invite' && w.body.target_invite_id === 'inv-adm'));
    writes.length = 0;
    await page.getByRole('button', { name: 'Delete invite for Old Invite' }).click();
    await page.getByRole('button', { name: 'Yes, continue' }).click();
    await page.waitForTimeout(300);
    c.ok('delete exact call', writes.some((w) => w.rpc === 'delete_admin_invite' && w.body.target_invite_id === 'inv-old'));

    writes.length = 0;
    await page.getByRole('button', { name: 'Approve Owner invite for Dan New' }).click();
    await page.waitForTimeout(500);
    c.ok('approve owner invite exact call, then the email is sent', writes.some((w) => w.rpc === 'approve_email_owner_invite' && w.body.target_invite_id === 'inv-own') && calls.some((x) => x.body.invite_id === 'inv-own'));

    writes.length = 0;
    calls.length = 0;
    await page.getByRole('button', { name: 'Send email to eve@example.com' }).click();
    await page.waitForTimeout(300);
    c.ok('send email exact call', calls.length === 1 && calls[0].body.invite_id === 'inv-adm');

    // New invites: refused first, then email, then link
    writes.length = 0;
    calls.length = 0;
    await page.getByRole('button', { name: 'Send invitation email' }).click();
    await c.has('name needed', page.getByText('Enter their name first.'));
    await page.getByLabel('Their name').fill('Gus Guest');
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByRole('button', { name: 'Send invitation email' }).click();
    await c.has('bad email refused', page.getByText('Enter a valid email address.'));
    c.ok('nothing sent for refused forms', writes.length === 0 && calls.length === 0);
    await page.getByLabel('Email address').fill('gus@example.com');
    await page.getByLabel('Invitation expires').selectOption('14');
    await page.getByRole('button', { name: 'Send invitation email' }).click();
    await c.has('emailed message', page.getByText('Admin invitation emailed to gus@example.com.'));
    const mk = writes.find((w) => w.rpc === 'create_email_access_invite');
    c.ok('create email invite exact call', mk && JSON.stringify(mk.body) === JSON.stringify({ target_gym_id: GYM, invite_email: 'gus@example.com', requested_role: 'admin', expires_in_days: 14, invitee_name: 'Gus Guest' }) && calls.some((x) => x.body.invite_id === 'inv-new'));

    writes.length = 0;
    calls.length = 0;
    await page.getByLabel('Their name').fill('Hal Owner');
    await page.getByLabel('Email address').fill('hal@example.com');
    await page.getByLabel('Access level').selectOption('owner');
    await page.getByRole('button', { name: 'Send invitation email' }).click();
    await c.has('owner invite waits for approvals', page.getByText(/Owner invitation created\. 1 of 2 owner approvals recorded\./));
    c.ok('owner invite is NOT emailed until approved', calls.length === 0 && writes.some((w) => w.rpc === 'create_email_access_invite' && w.body.requested_role === 'owner'));

    writes.length = 0;
    await page.getByLabel('Their name').fill('Ivy Link');
    await page.getByLabel('Email address').fill('ivy@example.com');
    await page.getByLabel('Access level').selectOption('admin');
    await page.getByRole('button', { name: 'Generate secure invite link' }).click();
    await c.has('link shown', page.getByText('Secure invite link ready'));
    const linkValue = await page.getByLabel('Secure invite link').inputValue();
    const lu = new URL(linkValue);
    c.ok('link carries the token, email, gym and role', lu.pathname.endsWith('/index.html') && lu.searchParams.get('access_invite') === 'secret-token' && lu.searchParams.get('invite_email') === 'ivy@example.com' && lu.searchParams.get('invite_gym') === 'Puffin Performance' && lu.searchParams.get('invite_role') === 'admin');
    c.ok('link invite exact call and no email', writes.some((w) => w.rpc === 'create_shareable_access_invite' && w.body.invitee_name === 'Ivy Link') && calls.length === 0);
    c.ok('layout after actions', (await page.evaluate(layoutProblems)).length === 0);
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
