// Browser gate: What members see (home tiles, order, promo panel), signed in as an owner, at phone and desktop
// width. Supabase is mocked at the network layer. Checks the saved order is shown, move/hide update the preview,
// bad promo links are refused with nothing written, and the exact saved row (shape the member app reads).
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const stored = { home_layout: [{ key: 'pt', visible: false }, { key: 'goal', visible: true }], cta_config: { title: 'Summer challenge', primary_label: 'Join', primary_target: 'community' } };

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const p = e.parentElement;
    if (p && cs.position !== 'fixed' && cs.position !== 'absolute' && !e.closest('.menu-btn')) {
      const pr = p.getBoundingClientRect();
      if (getComputedStyle(p).display !== 'contents' && (r.right > pr.right + 1 || r.left < pr.left - 1)) problems.push(`${name} sticks out of its parent`);
    }
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}



const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    if (path.endsWith('/gym_member_view_settings')) {
      if (['POST', 'PATCH'].includes(method)) { writes.push({ method, query: Object.fromEntries(url.searchParams), body }); await route.fulfill({ status: 204, body: '' }); return true; }
      return reply(route, [stored]);
    }
    return false;
  });
  await page.goto(`${base}/member-view`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'What members see', level: 1 }));
  const order = async () => page.locator('.mv-screen [data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')));
  const first = await order();
  c.ok('saved order shown, missing tiles added', first[0] === 'pt' && first[1] === 'goal' && first.length === 9);
  c.ok('hidden tile is dimmed in the preview', (await page.locator('.mv-screen [data-tile="pt"].off').count()) === 1);
  c.ok('promo prefilled over defaults', (await page.getByLabel('Headline').inputValue()) === 'Summer challenge' && (await page.getByLabel('First button goes to').inputValue()) === 'community' && (await page.getByLabel('Small label').inputValue()) === 'YOUR TRAINING HUB');
  c.ok('first Up button is disabled, last Down is disabled', (await page.getByRole('button', { name: 'Move PT appointments up' }).isDisabled()) && (await page.getByRole('button', { name: 'Move Training hub down' }).count()) === 1);
  c.ok('layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/member-view-${name}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Move Training goal up' }).click();
  c.ok('move up changes the preview', (await order())[0] === 'goal');
  await page.getByRole('button', { name: 'Move Training goal down' }).click();
  await page.getByRole('button', { name: 'Move Training goal down' }).click();
  c.ok('move down changes the preview', (await order()).indexOf('goal') === 2);
  await page.getByRole('button', { name: 'Move Training goal up' }).click();
  await page.getByLabel('Show').nth(0).check();
  await page.getByLabel('Show').nth(2).uncheck();

  // Refused: external link without https
  await page.getByLabel('First button goes to').selectOption('external');
  await page.getByLabel('First button link').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save member view' }).click();
  await c.has('bad link refused', page.getByText('The first button needs a full link starting with https://.'));
  c.ok('nothing written when refused', writes.length === 0);
  await page.getByLabel('First button link').fill('https://example.com/join');
  await page.getByLabel('Second button goes to').selectOption('');
  await page.getByRole('button', { name: 'Save member view' }).click();
  await c.has('saved message', page.getByText('Saved. The member home now uses this order and promo.'));
  const w = writes[0];
  c.ok('exact upsert on this gym', w && w.method === 'POST' && w.query.on_conflict === 'gym_id' && w.body.gym_id === GYM && w.body.updated_by === USER);
  const saved = w?.body?.home_layout ?? [];
  c.ok('layout saved as key + visible only, all nine, pt now visible and the third hidden', saved.length === 9 && saved.every((t) => Object.keys(t).sort().join() === 'key,visible') && saved[0].key === 'pt' && saved[0].visible === true && saved[2].visible === false);
  const cta = w?.body?.cta_config ?? {};
  c.ok('promo saved with the https link, second button cleared', cta.primary_target === 'external' && cta.primary_url === 'https://example.com/join' && cta.secondary_target === '' && cta.title === 'Summer challenge' && cta.enabled === true);

  await page.getByRole('button', { name: 'Reset order' }).click();
  c.ok('reset restores the default order here only', (await order())[0] === 'next_classes' && writes.length === 1);
  c.ok('old member preview link kept', (await page.getByRole('link', { name: 'View as member', exact: true }).getAttribute('href')).includes('member.html'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
