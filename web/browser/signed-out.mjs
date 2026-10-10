// Browser gate: the new app, served from the built _site, sends a signed-out
// visitor to the universal login at phone and desktop widths, with no overflow.
import { launch, serveApp } from './mock.mjs';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173';
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

const browser = await launch();
let failed = false;
for (const [name, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport });
  await serveApp(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/today`);
  await page.waitForURL(/login\.html/, { timeout: 15000 }).catch(() => undefined);
  const ok = /login\.html/.test(page.url()) && errors.length === 0;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  console.log(`${name}: url=${page.url()} errors=${errors.length} overflow=${overflow} -> ${ok && !overflow ? 'PASS' : 'FAIL'}`);
  if (!ok || overflow) failed = true;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
