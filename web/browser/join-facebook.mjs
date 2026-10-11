// Browser gate: "Continue with Facebook" on the sign-up link. Mocked network only; no real Facebook or account.
// The button sends the person to Facebook and back to the same link; someone back from Facebook skips the account step with their name filled in.
import { base, GYM, launch, mockSupabase, reply, runChecks, session, sizes, serveApp } from './mock.mjs';

const PLANS = [{ id: 'plan-1', name: 'Hybrid', description: null, price_pence: 5900, billing_interval: 'monthly', includes_open_gym: true, includes_classes: true, classes_per_week: 3, includes_pt: false }];
const answerGym = async ({ route, path }) => (path.endsWith('/rpc/get_public_gym_join_options') ? reply(route, { gym_id: GYM, gym_name: 'Puffin Performance', logo_url: null, plans: PLANS }) : false);

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const c = runChecks();

  // 1. The button sends the person to Facebook, and asks to come back to this same link.
  const out = await browser.newContext({ viewport });
  await serveApp(out);
  const page = await out.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => { if (!/Fetch API cannot load .* due to access control checks/.test(String(e))) errors.push(String(e)); });
  await mockSupabase(page, answerGym);
  await page.goto(`${base}/join/puffin`);
  await c.has('the Facebook button is on the account step', page.getByRole('button', { name: 'Continue with Facebook', exact: true }));
  await page.getByRole('button', { name: 'Continue with Facebook', exact: true }).click();
  await page.waitForURL(/\/auth\/v1\/authorize/).catch(() => undefined);
  const sent = new URL(page.url());
  c.ok('it goes to Facebook through the sign-in service', sent.pathname.endsWith('/auth/v1/authorize') && sent.searchParams.get('provider') === 'facebook');
  c.ok('and comes back to this same sign-up link', sent.searchParams.get('redirect_to') === `${base}/join/puffin`);
  c.ok('no page errors', errors.length === 0);
  await out.close();

  // 2. Back from Facebook (signed in, name known): the account step is skipped and the name is filled in.
  const back = await browser.newContext({ viewport });
  await serveApp(back);
  const fb = { ...session, user: { ...session.user, app_metadata: { provider: 'facebook' }, user_metadata: { full_name: 'Alex Morgan', avatar_url: 'https://example.test/a.png' } } };
  await back.addInitScript(([key, value]) => localStorage.setItem(key, value), ['sb-mzgnhmeydhhpzgxlgudh-auth-token', JSON.stringify(fb)]);
  const p2 = await back.newPage();
  p2.setDefaultTimeout(10000);
  await mockSupabase(p2, answerGym);
  await p2.goto(`${base}/join/puffin`);
  await c.has('back from Facebook it skips the account step', p2.getByRole('heading', { name: 'About you' }));
  await p2.getByLabel('First name', { exact: true }).waitFor();
  c.ok('first name is filled in from Facebook', (await p2.getByLabel('First name', { exact: true }).inputValue()) === 'Alex');
  c.ok('last name is filled in from Facebook', (await p2.getByLabel('Last name', { exact: true }).inputValue()) === 'Morgan');
  c.ok('date of birth is not guessed', (await p2.getByLabel('Date of birth', { exact: true }).inputValue()) === '');
  await back.close();

  if (!c.report(`facebook join ${name}`)) allOk = false;
}
await browser.close();
process.exit(allOk ? 0 : 1);
