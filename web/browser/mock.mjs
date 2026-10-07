// Shared helpers for the signed-in browser checks: a fake owner session and a mocked Supabase.
// No real account or data is used. Each check passes its own handlers for the tables it cares about.
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

export const base = process.env.SITE_URL ?? 'http://127.0.0.1:4173';
export const shots = process.env.SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });
export const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

// MOCK_GYM / MOCK_LOGO let a one-off visual check use another gym id or no logo ('none').
export const GYM = process.env.MOCK_GYM ?? '11111111-1111-4111-8111-111111111111';
export const USER = '22222222-2222-4222-8222-222222222222';
export const session = {
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'owner@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
};

// BROWSER=webkit runs the checks in the Safari-style engine; the default is Chromium.
export const launch = () => (process.env.BROWSER === 'webkit' ? webkit.launch() : chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined }));

export async function signedInPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(([key, value, gym]) => { localStorage.setItem(key, value); sessionStorage.setItem('hybrid-gym-id', gym); }, ['sb-mzgnhmeydhhpzgxlgudh-auth-token', JSON.stringify(session), GYM]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/** Answer a request with JSON. Resolves true so a handler can `return reply(...)` to say it answered. */
export async function reply(route, body, count) {
  const single = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
  const payload = single ? (Array.isArray(body) ? body[0] ?? null : body) : body;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-0/${count ?? (Array.isArray(body) ? body.length : 1)}` }, body: JSON.stringify(payload) });
  return true;
}

/** Mock Supabase. `handle({route, url, path, select, method, body})` returns true when it answered; otherwise a default applies. */
export async function mockSupabase(page, handle) {
  // The uploaded gym logo: answer with a 1x1 png so the image loads.
  await page.route('https://logos.example.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await page.route('**/*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const select = url.searchParams.get('select') ?? '';
    const method = req.method();
    let body = null;
    try { body = req.postDataJSON(); } catch { /* no body */ }
    if (path.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
    if (path.endsWith('/gym_members') && select.includes('gyms(')) return reply(route, [{ gym_id: GYM, role: 'owner', gyms: { name: 'Puffin Performance', logo_url: process.env.MOCK_LOGO === 'none' ? null : 'https://logos.example.test/puffin.png' } }]);
    if (await handle({ route, url, path, select, method, body })) return undefined;
    if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' } });
    if (['PATCH', 'POST', 'DELETE'].includes(method)) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

export const runChecks = () => {
  const results = [];
  return {
    results,
    ok: (label, ok) => results.push([label, !!ok]),
    async has(label, locator) { results.push([label, await locator.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false)]); },
    report(name) {
      const bad = results.filter(([, ok]) => !ok);
      console.log(`${name}: ${bad.length ? 'FAIL ' + bad.map(([l]) => l).join(', ') : 'PASS (' + results.length + ' checks)'}`);
      return bad.length === 0;
    },
  };
};
