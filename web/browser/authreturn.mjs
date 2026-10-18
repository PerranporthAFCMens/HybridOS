// Browser check: the new email-link landing page and sign-out screen, at phone and desktop widths, with no overflow.
import { base, launch, mockSupabase, runChecks, serveApp, signedInPage, sizes } from './mock.mjs';

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const c = runChecks();

  // Signed out: an email link with no session says it is not active and offers sign-in.
  {
    const ctx = await browser.newContext({ viewport });
    await serveApp(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${base}/auth-return?mode=recovery`);
    await c.has('a dead reset link says so', page.getByRole('heading', { name: 'This reset link is not active' }));
    await c.has('it offers a way back to sign in', page.getByRole('link', { name: 'Back to sign in' }));
    c.ok('no overflow (dead link)', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    c.ok('no page errors (dead link)', errors.length === 0);
    await ctx.close();
  }

  // Signed in from a reset link: the new-password form checks length and match, then saves.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async () => false);
    let saved = false;
    await page.route('**/auth/v1/user', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      saved = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'a@example.test' }) });
    });
    await page.goto(`${base}/auth-return?mode=recovery`);
    await c.has('the new-password form shows', page.getByRole('heading', { name: 'Choose a new password' }));
    c.ok('no overflow (reset form)', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    await page.getByLabel('New password', { exact: true }).fill('longenough1');
    await page.getByLabel('Confirm new password').fill('different123');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await c.has('mismatched passwords are refused', page.getByText('Passwords do not match.'));
    c.ok('nothing saved on a mismatch', !saved);
    await page.getByLabel('Confirm new password').fill('longenough1');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await c.has('a good password is saved', page.getByText('Password saved.'));
    c.ok('the password update was sent', saved);
    c.ok('no page errors (reset)', errors.length === 0);
    await ctx.close();
  }

  // Signed in from a magic link: verified page with Continue.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async () => false);
    await page.goto(`${base}/auth-return?mode=magic`);
    await c.has('the verified page shows', page.getByRole('heading', { name: 'Secure link verified' }));
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/today$/, { timeout: 15000 }).catch(() => undefined);
    c.ok('Continue opens the app home', /\/today$/.test(page.url()));
    c.ok('no page errors (magic)', errors.length === 0);
    await ctx.close();
  }

  // Sign-out ends up on the sign-in page.
  {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async () => false);
    await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto(`${base}/sign-out`);
    await page.waitForURL(/\/sign-in$/, { timeout: 15000 }).catch(() => undefined);
    c.ok('sign-out lands on sign-in', /\/sign-in$/.test(page.url()));
    c.ok('no page errors (sign-out)', errors.length === 0);
    await ctx.close();
  }

  if (!c.report(name)) allOk = false;
}
await browser.close();
process.exit(allOk ? 0 : 1);
