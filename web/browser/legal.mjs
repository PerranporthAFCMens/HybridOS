// Browser gate: the privacy policy and data-deletion pages open for a signed-out visitor (Facebook and Google need public addresses).
import { launch, mockSupabase, runChecks, serveApp, sizes } from './mock.mjs';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173';
const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport });
  await serveApp(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockSupabase(page, async () => false);
  const c = runChecks();
  await page.goto(`${base}/privacy`);
  await c.has('privacy heading', page.getByRole('heading', { name: 'Privacy policy' }));
  await c.has('says other members never see details', page.getByText(/Other members can never see your details/));
  await c.has('says nothing is shared without consent', page.getByText(/only time information goes to another company is when you choose it/));
  await page.goto(`${base}/data-deletion`);
  await c.has('deletion heading', page.getByRole('heading', { name: 'Delete your data' }));
  await c.has('says how to ask', page.getByText(/Delete my data/));
  c.ok('stays on the page, not sent to sign in', /data-deletion/.test(page.url()));
  c.ok('no horizontal overflow', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(`legal ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
