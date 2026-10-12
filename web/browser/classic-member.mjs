// Browser gate: the classic member app's Me page shows the member's signed documents and downloads the stored copy.
// Supabase is mocked at the network layer; the classic page itself is served from the built site.
process.env.MOCK_ROLE = 'member';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { GYM, base, launch, mockSupabase, reply, runChecks } from './mock.mjs';

const make = async (n) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage(); return Buffer.from(await d.save()); };
const TERMS = await make(2);
const WAIVER = await make(1);

const browser = await launch();
let allOk = true;
for (const [name, rows] of [['with a signed copy', [{ signed_at: '2026-10-06T09:00:00Z', signed_terms_path: 'g/u/terms.pdf', signed_waiver_path: 'g/u/waiver.pdf' }]], ['with none', []]]) {
  const c = runChecks();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const session = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'member@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
  await ctx.addInitScript(([k, v, g]) => { localStorage.setItem(k, v); sessionStorage.setItem('hybrid-gym-id', g); }, ['sb-mzgnhmeydhhpzgxlgudh-auth-token', JSON.stringify(session), GYM]);
  const page = await ctx.newPage();
  // Where the network cannot reach the CDN, CDN_DIR holds local copies of supabase.js and pdflib.js.
  if (process.env.CDN_DIR) {
    const js = (f) => (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(`${process.env.CDN_DIR}/${f}`) });
    await page.route(/(cdn\.jsdelivr\.net|esm\.sh)\/.*supabase-js/, js('supabase.js'));
    await page.route(/cdn\.jsdelivr\.net\/npm\/pdf-lib/, js('pdflib.js'));
  }
  await mockSupabase(page, async ({ route, path, method }) => {
    if (path.includes('/storage/v1/object/sign/signed-documents/')) {
      if (method === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: `${path.replace('/storage/v1', '')}?token=t` }) }).then(() => true);
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: path.includes('terms') ? TERMS : WAIVER }).then(() => true);
    }
    if (path.endsWith('/member_signatures')) return reply(route, rows);
    return false;
  });
  await page.goto(`${base}/member.html?gym_id=${GYM}`);
  await page.locator('.member-tabbar button[data-page="profile"]').click();
  const card = page.locator('#signedDocsCard');
  await c.has('the signed documents card is on the Me page', card);
  if (rows.length) {
    await c.has('it shows when they signed', card.getByText(/Tuesday 6 October 2026 at 10:00:00 BST/));
    const dl = page.waitForEvent('download', { timeout: 8000 });
    await card.getByRole('button', { name: 'Download my signed copy' }).click();
    const d = await dl;
    c.ok('the file is named for the gym and the date', d.suggestedFilename() === 'puffin-performance-my-signed-copy-2026-10-06.pdf');
    const got = await PDFDocument.load(await (await import('node:fs/promises')).readFile(await d.path()));
    c.ok('terms and waiver are joined into one PDF', got.getPageCount() === 3);
  } else {
    await c.has('it says there is nothing signed', card.getByText(/no signed documents on this account/));
  }
  c.ok('the page does not scroll sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  allOk = c.report(`classic member ${name}`) && allOk;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
