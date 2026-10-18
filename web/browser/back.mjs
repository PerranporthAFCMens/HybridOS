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
  await page.goto(`${base}/today`);
  await c.has('today loads', page.getByRole('navigation', { name: 'Main' }));
  c.ok('no Back on a sidebar page', (await back.count()) === 0);
  // One short menu, the same as the old admin shell; pages that used to have their own line sit under it as tabs
  const menu = page.getByRole('navigation', { name: 'Main' });
  c.ok('the menu is the short list', (await menu.getByRole('link').allInnerTexts()).map((t) => t.trim()).join('|') === 'Today|Members|Classes and workouts|Messages and community|Reports|Settings and staff|Preview as member|Preview as staff');
  await page.goto(`${base}/plans`);
  await c.has('plans loads', page.getByRole('heading', { name: 'Membership plans', level: 1 }));
  c.ok('Membership plans lights up Members', (await menu.getByRole('link', { name: 'Members' }).getAttribute('class')) === 'active');
  c.ok('and shows the Members tabs', (await page.getByRole('navigation', { name: 'Members' }).getByRole('link').allInnerTexts()).join('|') === 'Members|Membership plans');
  await page.goto(`${base}/training`);
  await c.has('training loads', page.getByRole('heading', { name: 'Client training', level: 1 }));
  c.ok('Client training lights up Classes and workouts', (await menu.getByRole('link', { name: 'Classes and workouts' }).getAttribute('class')) === 'active');
  await page.getByRole('navigation', { name: 'Classes and workouts' }).getByRole('link', { name: 'Workout builder' }).click();
  await c.has('a tab opens its page', page.getByRole('heading', { name: 'Workout builder', level: 1 }));
  await page.goto(`${base}/door`);
  c.ok('Door access lights up Settings and staff', (await menu.getByRole('link', { name: 'Settings and staff' }).getAttribute('class')) === 'active');
  await page.goto(`${base}/today`);
  await page.goto(`${base}/settings`);
  await c.has('settings loads', page.getByRole('heading', { name: 'Settings', level: 1 }));
  c.ok('no Back on Settings', (await back.count()) === 0);
  await page.getByRole('link', { name: 'Open' }).nth(3).click();
  await c.has('a Settings page shows Back', back);
  await back.click();
  await c.has('Back returns to Settings', page.getByRole('heading', { name: 'Settings', level: 1 }));
  await page.goto(`${base}/door`);
  await c.has('a page opened directly shows Back', back);
  await back.click();
  await c.has('with no history, Back goes to Settings', page.getByRole('heading', { name: 'Settings', level: 1 }));
  const newAppErrors = errors.length;
  // Opening the old admin address goes straight to the new app (default); ?next=0 opts out; a specific old page still opens
  await page.goto(`${base}/admin.html`);
  await page.waitForURL(/\/today$/);
  c.ok('admin.html opens the new app by default', page.url().endsWith('/today'));
  await page.goto(`${base}/admin.html?view=index.html`);
  await page.waitForURL(/\/today$/);
  c.ok('so does the plain dashboard view', page.url().endsWith('/today'));
  await page.goto(`${base}/admin.html?next=0`);
  await page.waitForTimeout(500);
  c.ok('next=0 stays on the old frame', !page.url().endsWith('/today'));
  await page.goto(`${base}/admin.html?next=1`);
  await page.waitForURL(/\/today$/);
  c.ok('next=1 turns the new app back on', page.url().endsWith('/today'));
  await page.goto(`${base}/admin.html?view=workout-builder.html`);
  await page.waitForTimeout(500);
  c.ok('another old page is not redirected', page.url().includes('/admin.html?view=workout-builder.html'));
  c.ok('no page errors in the new app', newAppErrors === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
