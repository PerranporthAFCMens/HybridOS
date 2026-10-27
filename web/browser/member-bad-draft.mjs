// Browser gate: a half-finished workout saved by an older version of the app (exercises with no sets) must not blank the "Start my own workout" screen.
// The screen starts a fresh workout instead. Phone and desktop. Supabase is mocked at the network layer.
import { launch, mockSupabase, reply, runChecks, signedInPage, sizes, GYM, base } from './mock.mjs';

const browser = await launch();
let allOk = true;
process.env.MOCK_ROLE = 'member';
for (const [name, viewport] of Object.entries(sizes)) {
  const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
  await page.addInitScript((g) => localStorage.setItem(`hybrid-train-draft:${g}:new`, JSON.stringify({ acts: [{ key: 'a1', name: 'Squat' }], rpe: '', notes: '' })), GYM);
  await mockSupabase(page, async ({ route, path }) => {
    if (path.endsWith('/memberships')) return reply(route, [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
    return reply(route, []);
  });
  const c = runChecks();
  await page.goto(`${base}/m/train/new`);
  await page.waitForTimeout(2500);await c.has('the workout screen opens (not blank)', page.getByRole('heading', { name: 'My workout' }));
  c.ok('the unreadable draft was ignored', (await page.getByText('No exercises yet').count()) === 1);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
