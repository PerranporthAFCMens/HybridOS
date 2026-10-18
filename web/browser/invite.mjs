// Browser check: the new Admin/Owner invitation screen, at phone and desktop widths, with no overflow.
import { base, launch, mockSupabase, reply, runChecks, serveApp, signedInPage, sizes } from './mock.mjs';

const browser = await launch();
let allOk = true;
const rpc = (page, row) =>
  page.route('**/rest/v1/rpc/get_access_invite*', (route) => reply(route, row ? [row] : []));

for (const [name, viewport] of Object.entries(sizes)) {
  const c = runChecks();

  // Signed out: shows who is invited, with create-account and sign-in.
  {
    const ctx = await browser.newContext({ viewport });
    await serveApp(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await rpc(page, { email: 'new.admin@example.test', expires_at: '2030-01-01', gym_name: 'Puffin Performance', invite_id: 'i1', invite_role: 'admin', status: 'open' });
    await page.goto(`${base}/invite?token=abc`);
    await c.has('the invitation heading shows', page.getByRole('heading', { name: 'Join Puffin Performance as Admin' }));
    await c.has('the invited email shows', page.getByText('This invitation is for new.admin@example.test.'));
    await c.has('create account is offered', page.getByRole('button', { name: 'Create account' }).first());
    await page.getByRole('button', { name: 'Create account' }).last().click();
    await c.has('an empty password is refused', page.getByText('Enter a password.'));
    c.ok('no overflow', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    c.ok('no page errors', errors.length === 0);
    await ctx.close();
  }

  // Signed out, revoked invitation: cannot be used.
  {
    const ctx = await browser.newContext({ viewport });
    await serveApp(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await rpc(page, { email: 'x@example.test', expires_at: '2030-01-01', gym_name: 'Puffin Performance', invite_id: 'i1', invite_role: 'owner', status: 'revoked' });
    await page.goto(`${base}/invite?token=abc`);
    await c.has('a revoked invitation says so', page.getByText('This invitation can no longer be used.'));
    await ctx.close();
  }

  // No token: says the link is incomplete.
  {
    const ctx = await browser.newContext({ viewport });
    await serveApp(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${base}/invite`);
    await c.has('a link with no token is called incomplete', page.getByText('This invitation link is incomplete.'));
    await ctx.close();
  }

  // Signed in as someone else: offers to sign out and continue.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async () => false);
    await rpc(page, { email: 'someone.else@example.test', expires_at: '2030-01-01', gym_name: 'Puffin Performance', invite_id: 'i1', invite_role: 'admin', status: 'open' });
    await page.goto(`${base}/invite?token=abc`);
    await c.has('a different account is flagged', page.getByText(/Different account signed in/));
    await c.has('it offers to sign out', page.getByRole('button', { name: 'Sign out and continue with invited email' }));
    c.ok('no overflow (mismatch)', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    c.ok('no page errors (mismatch)', errors.length === 0);
    await ctx.close();
  }

  // Signed in as the invited email: accepted straight away.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async () => false);
    await rpc(page, { email: 'owner@example.test', expires_at: '2030-01-01', gym_name: 'Puffin Performance', invite_id: 'i1', invite_role: 'admin', status: 'open' });
    await page.route('**/rest/v1/rpc/claim_access_invite*', (route) => reply(route, [{ access_status: 'active', gym_id: '22222222-2222-4222-8222-222222222222', gym_name: 'Puffin Performance', role: 'admin' }]));
    await page.goto(`${base}/invite?token=abc`);
    await c.has('the invitation is accepted', page.getByText(/Access activated\. You now have Admin access/));
    await c.has('it offers to open the gym', page.getByRole('button', { name: 'Open Puffin Performance' }));
    c.ok('no page errors (accepted)', errors.length === 0);
    await ctx.close();
  }

  if (!c.report(name)) allOk = false;
}
await browser.close();
process.exit(allOk ? 0 : 1);
