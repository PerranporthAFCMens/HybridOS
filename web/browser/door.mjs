// Browser gate: Door access, signed in as an owner, at phone and desktop width. Supabase is mocked at the network
// layer. Checks the preview, that a code is required to show access to members, and the exact saved row.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

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
    if (path.endsWith('/gym_access_settings')) {
      if (['POST', 'PATCH'].includes(method)) { writes.push({ method, query: Object.fromEntries(url.searchParams), body }); await route.fulfill({ status: 204, body: '' }); return true; }
      return reply(route, [{ access_enabled: true, access_code: '4826', member_label: 'Front door', member_note: 'Use the main entrance.' }]);
    }
    return false;
  });
  await page.goto(`${base}/door`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Door access', level: 1 }));
  c.ok('prefilled', (await page.getByLabel('Door PIN / access code').inputValue()) === '4826' && (await page.getByLabel('Label members see').inputValue()) === 'Front door' && (await page.getByLabel('Show door access to members').isChecked()));
  await c.has('preview shows the code', page.getByLabel('What members see').getByText('4826'));
  c.ok('save is disabled until something changes', await page.getByRole('button', { name: 'Save door access' }).isDisabled());
  c.ok('layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/door-${name}.png`, fullPage: true });

  await page.getByLabel('Door PIN / access code').fill('');
  await page.getByRole('button', { name: 'Save door access' }).click();
  await c.has('code required while shown to members', page.getByText('Enter an access code before showing door access to members.'));
  c.ok('nothing written when refused', writes.length === 0);
  await page.getByLabel('Door PIN / access code').fill('9911');
  await page.getByLabel('Label members see').fill('  ');
  await page.getByLabel('Note for members').fill('');
  await page.getByRole('button', { name: 'Save door access' }).click();
  await c.has('saved message', page.getByText('Saved. Members now see this setting.'));
  const w = writes[0];
  c.ok('exact upsert on this gym', w && w.method === 'POST' && w.query.on_conflict === 'gym_id' && w.body.gym_id === GYM && w.body.access_enabled === true && w.body.access_code === '9911' && w.body.member_label === 'Door access' && w.body.member_note === null && w.body.updated_by === USER);
  await page.getByLabel('Show door access to members').uncheck();
  await c.has('preview says hidden', page.getByText('Hidden from members: door access is switched off.'));
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
