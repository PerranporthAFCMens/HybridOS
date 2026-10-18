// Browser check: the new sign-in and choose-a-gym screens, at phone and desktop widths, with no overflow.
import { GYM, base, launch, mockSupabase, reply, runChecks, serveApp, signedInPage, sizes } from './mock.mjs';

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const c = runChecks();

  // Signed out: the form shows, a wrong password says so, "forgot" asks for the email first.
  {
    const ctx = await browser.newContext({ viewport });
    await serveApp(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/*.supabase.co/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.includes('/auth/v1/token')) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(`${base}/sign-in`);
    await c.has('the sign-in form shows', page.getByLabel('Email'));
    c.ok('no overflow', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await c.has('forgot asks for the email first', page.getByText('Enter your email address first.'));
    await page.getByLabel('Email').fill('someone@example.test');
    await page.getByLabel('Password', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await c.has('a wrong password says so', page.getByText('Email or password not recognised.'));
    c.ok('no page errors', errors.length === 0);
    await ctx.close();
  }

  // Signed in with one gym: the sign-in page moves on to that role's home.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async () => false);
    await page.goto(`${base}/sign-in`);
    await page.waitForURL(/\/today$/, { timeout: 15000 }).catch(() => undefined);
    c.ok('signed in with one gym leaves the sign-in page', /\/today$/.test(page.url()));
    c.ok('no page errors (signed in)', errors.length === 0);
    await ctx.close();
  }

  // Signed in with two gyms: the chooser lists both, and picking one opens it.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await page.addInitScript(() => sessionStorage.removeItem('hybrid-gym-id'));
    const G2 = '33333333-3333-4333-8333-333333333333';
    await mockSupabase(page, async () => false);
    // Registered after the shared mock, so it answers first: two gyms for this account.
    await page.route('**/rest/v1/gym_members*', (route) => {
      if (!(new URL(route.request().url()).searchParams.get('select') ?? '').includes('gyms(')) return route.fallback();
      return reply(route, [
        { gym_id: GYM, role: 'owner', gyms: { name: 'Puffin Performance', logo_url: null } },
        { gym_id: G2, role: 'member', gyms: { name: 'Hybrid Hub', logo_url: null } },
      ]);
    });
    await page.goto(`${base}/choose-gym`);
    await c.has('both gyms are listed', page.getByRole('button', { name: /Hybrid Hub/ }));
    await c.has('the first gym is listed', page.getByRole('button', { name: /Puffin Performance/ }));
    c.ok('no overflow (chooser)', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    await page.getByRole('button', { name: /Hybrid Hub/ }).click();
    await page.waitForURL(/\/m\/today$/, { timeout: 15000 }).catch(() => undefined);
    c.ok('a member role opens the member app', /\/m\/today$/.test(page.url()));
    c.ok('no page errors (chooser)', errors.length === 0);
    await ctx.close();
  }

  if (!c.report(name)) allOk = false;
}
await browser.close();
process.exit(allOk ? 0 : 1);
