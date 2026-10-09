// Browser gate: pages opened from another page have a Back link; the sidebar pages do not.
import { base, launch, mockSupabase, runChecks, signedInPage, sizes } from './mock.mjs';

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  process.env.MOCK_ROLE = 'owner';
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async () => false);
  const c = runChecks();
  const back = page.getByRole('button', { name: '‹ Back' });
  await page.goto(`${base}/next/#/today`);
  await c.has('today loads', page.getByRole('navigation', { name: 'Main' }));
  c.ok('no Back on a sidebar page', (await back.count()) === 0);
  await page.goto(`${base}/next/#/settings`);
  await c.has('settings loads', page.getByRole('heading', { name: 'Settings', level: 1 }));
  c.ok('no Back on Settings', (await back.count()) === 0);
  await page.getByRole('link', { name: 'Open' }).nth(3).click();
  await c.has('a Settings page shows Back', back);
  await back.click();
  await c.has('Back returns to Settings', page.getByRole('heading', { name: 'Settings', level: 1 }));
  await page.goto(`${base}/next/#/door`);
  await c.has('a page opened directly shows Back', back);
  await back.click();
  await c.has('with no history, Back goes to Settings', page.getByRole('heading', { name: 'Settings', level: 1 }));
  const newAppErrors = errors.length;
  // Opening the old admin address goes straight to the new app; a specific old page still opens
  await page.goto(`${base}/admin.html`);
  await page.waitForTimeout(500);
  c.ok('off by default: admin.html stays on the old frame', !page.url().includes('/next/'));
  await page.goto(`${base}/admin.html?next=1`);
  await page.waitForURL(/\/next\/#\/today/);
  c.ok('admin.html opens the new app', page.url().includes('/next/#/today'));
  await page.goto(`${base}/admin.html?view=index.html`);
  await page.waitForURL(/\/next\/#\/today/);
  c.ok('so does the plain dashboard view', page.url().includes('/next/#/today'));
  await page.goto(`${base}/admin.html?next=0`);
  await page.waitForTimeout(500);
  c.ok('next=0 turns it off again', !page.url().includes('/next/'));
  await page.goto(`${base}/admin.html?view=gym-layout.html`);
  await page.waitForTimeout(500);
  c.ok('another old page is not redirected', page.url().includes('/admin.html?view=gym-layout.html'));
  c.ok('no page errors in the new app', newAppErrors === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
