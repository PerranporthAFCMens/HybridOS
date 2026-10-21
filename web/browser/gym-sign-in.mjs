// Browser check: each gym's own sign-in page keeps its address, shows the form and that gym's name, with no overflow.
import { base, launch, runChecks, serveApp, sizes } from './mock.mjs';

const PAGES = [
  { path: 'hybrid-hub', name: 'Hybrid Hub' },
  { path: 'puffin-performance', name: 'Puffin Performance' },
];

const browser = await launch();
let allOk = true;
for (const [size, viewport] of Object.entries(sizes)) {
  const c = runChecks();
  for (const { path, name } of PAGES) {
    const ctx = await browser.newContext({ viewport });
    await serveApp(ctx);
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/*.supabase.co/**', (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.includes('get_public_gym_brand')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name, logo_url: null }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(`${base}/${path}`);
    await c.has(`${name}: the sign-in form shows`, page.getByLabel('Email'));
    await c.has(`${name}: its own name shows`, page.getByText(name).first());
    c.ok(`${name}: the address stays /${path}`, new URL(page.url()).pathname.endsWith(`/${path}`));
    c.ok(`${name}: no overflow`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    c.ok(`${name}: no page errors`, errors.length === 0);
    await ctx.close();
  }
  allOk = c.report(size) && allOk;
}
await browser.close();
process.exit(allOk ? 0 : 1);
