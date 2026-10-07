// Browser gate: the new app, served from the built _site, sends a signed-out
// visitor to the universal login at phone and desktop widths, with no overflow.
import { chromium } from 'playwright';

const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROMIUM_PATH || undefined;
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

const browser = await chromium.launch({ executablePath });
let failed = false;
for (const [name, viewport] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/next/`);
  await page.waitForURL(/login\.html/, { timeout: 15000 }).catch(() => undefined);
  const ok = /login\.html/.test(page.url()) && errors.length === 0;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  console.log(`${name}: url=${page.url()} errors=${errors.length} overflow=${overflow} -> ${ok && !overflow ? 'PASS' : 'FAIL'}`);
  if (!ok || overflow) failed = true;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
