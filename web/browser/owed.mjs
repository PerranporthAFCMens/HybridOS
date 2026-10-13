// Browser gate: Reports > Money owed (admin). Everyone who is "not financial" with what they owe, a click on a name shows the
// payments they missed, and each can be marked paid another way, waived or written off (with a note), and undone. Signed in as
// an owner, phone and desktop width. Supabase is mocked at the network layer; the exact request of every action is checked.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *, .modal *')) {
    if (e.closest('.side') || e.closest('[hidden]') || e.closest('.table-wrap')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && !e.closest('.report-tab') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const PRIYA = '33333333-3333-4333-8333-333333333331';
const SAM = '33333333-3333-4333-8333-333333333332';
const P1 = 'e0000000-0000-4000-8000-000000000001';
const P2 = 'e0000000-0000-4000-8000-000000000002';
const P3 = 'e0000000-0000-4000-8000-000000000003';

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const calls = [];
  // The mock's own "database": each payment is outstanding until settled.
  const pay = {
    [P1]: { user: PRIYA, date: '2026-10-10', pence: 4000, state: 'failed', reason: 'insufficient_funds', plan: 'Basic', how: null, note: null },
    [P2]: { user: PRIYA, date: '2026-09-10', pence: 3000, state: 'failed', reason: null, plan: 'Basic', how: null, note: null },
    [P3]: { user: SAM, date: '2026-10-01', pence: 5000, state: 'pending', reason: null, plan: 'Pro', how: null, note: null },
  };
  let mode = 'normal'; // normal | denied | empty
  let refuse = false;
  const missedOf = (user) => Object.entries(pay).filter(([, p]) => p.user === user)
    .sort((a, b) => b[1].date.localeCompare(a[1].date))
    .map(([id, p]) => ({ payment_id: id, charge_date: p.date, amount_pence: p.pence, state: p.state, reason: p.reason, plan_name: p.plan, provider: 'manual', outstanding: !p.how, settled_how: p.how, settled_note: p.note, settled_at: p.how ? '2026-10-13T09:00:00Z' : null, settled_by_name: p.how ? 'Alex Owner' : null }));
  const debtors = () => {
    const out = [];
    for (const [user, nm, plan] of [[PRIYA, 'Priya Nair', 'Basic'], [SAM, 'Sam Lee', 'Pro']]) {
      const open = Object.values(pay).filter((p) => p.user === user && !p.how);
      if (!open.length) continue;
      out.push({ user_id: user, display_name: nm, plan_name: plan, membership_status: 'active', owed_pence: open.reduce((n, p) => n + p.pence, 0), missed_count: open.length, oldest_missed: open.map((p) => p.date).sort()[0], latest_missed: open.map((p) => p.date).sort().at(-1), latest_reason: open[0].reason });
    }
    return out.sort((a, b) => b.owed_pence - a.owed_pence);
  };

  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, path, body }) => {
    if (path.endsWith('/rpc/get_gym_arrears')) {
      calls.push({ fn: 'get_gym_arrears', body });
      if (mode === 'denied') { await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'Only an owner or admin can see money owed' }) }); return true; }
      return reply(route, mode === 'empty' ? [] : debtors());
    }
    if (path.endsWith('/rpc/get_member_missed_payments')) { calls.push({ fn: 'get_member_missed_payments', body }); return reply(route, missedOf(body.p_user_id)); }
    if (path.endsWith('/rpc/settle_missed_payment')) {
      calls.push({ fn: 'settle', body });
      if (refuse) { await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'That payment is not outstanding' }) }); return true; }
      pay[body.p_payment_id].how = body.p_how; pay[body.p_payment_id].note = body.p_note ?? null;
      await route.fulfill({ status: 204, body: '' }); return true;
    }
    if (path.endsWith('/rpc/reopen_missed_payment')) { calls.push({ fn: 'reopen', body }); pay[body.p_payment_id].how = null; pay[body.p_payment_id].note = null; await route.fulfill({ status: 204, body: '' }); return true; }
    return false;
  });

  const c = runChecks();
  // The front dashboard shows who is not financial, with a way straight to the list.
  await page.goto(`${base}/today`);
  const alertBox = page.getByRole('region', { name: 'Money owed' });
  await c.has('the front dashboard says who owes and how much', alertBox.getByText('Not financial: 2 people owe £120.00 across 3 missed payments'));
  c.ok('and names the biggest debts', (await alertBox.innerText()).includes('Priya Nair £70.00 · Sam Lee £50.00'));
  c.ok('layout (dashboard)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/owed-dashboard-${name}.png`, fullPage: true });
  await alertBox.getByRole('link', { name: 'See who owes' }).click();
  await c.has('the link opens Reports on Money owed', page.getByRole('button', { name: /^Priya Nair, owes £70\.00/ }));
  c.ok('with that tab selected', (await page.getByRole('tab', { name: 'Money owed' }).getAttribute('aria-selected')) === 'true');
  await page.goto(`${base}/reports`);
  await page.getByRole('tab', { name: 'Money owed' }).click();
  await c.has('the list opens with the biggest debt first', page.getByRole('button', { name: /^Priya Nair, owes £70\.00, 2 missed payments/ }));
  c.ok('the total, the people and the missed payments add up', (await page.getByTestId('owed-total').innerText()) === '£120.00' && (await page.getByText('People not financial').locator('..').innerText()).includes('2') && (await page.getByText('Missed payments', { exact: true }).locator('..').innerText()).includes('3'));
  const names = await page.locator('.owed-row b').allInnerTexts();
  c.ok('biggest first: Priya (£70.00) then Sam (£50.00)', names.join('|') === 'Priya Nair|£70.00|Sam Lee|£50.00');
  c.ok('the plan and how long ago show', (await page.locator('.owed-row').first().innerText()).includes('Basic') && (await page.locator('.owed-row').first().innerText()).includes('oldest 10 Sep 2026'));
  c.ok('asked for this gym only', calls.every((x) => x.body.p_gym_id === GYM));
  c.ok('layout (list)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/owed-list-${name}.png`, fullPage: true });

  // Find
  await page.getByLabel('Find a member').fill('sam');
  c.ok('searching narrows the list', (await page.locator('.owed-row').count()) === 1 && (await page.locator('.owed-row').first().innerText()).includes('Sam Lee'));
  await page.getByLabel('Find a member').fill('zzz');
  await c.has('nobody matching says so', page.getByText('Nobody matches.'));
  await page.getByLabel('Find a member').fill('');

  // One person
  await page.getByRole('button', { name: /^Priya Nair/ }).click();
  await c.has('their missed payments open', page.getByRole('dialog', { name: 'Missed payments: Priya Nair' }));
  const dlg = page.getByRole('dialog');
  await c.has('what they owe', dlg.getByText('£70.00').first());
  c.ok('both payments, newest first, with the reason in words', (await dlg.locator('.missed').count()) === 2 && (await dlg.locator('.missed').first().innerText()).includes('£40.00') && (await dlg.locator('.missed').first().innerText()).includes('Insufficient funds') && (await dlg.locator('.missed').first().innerText()).includes('Payment failed'));
  c.ok('asked for this person in this gym', calls.some((x) => x.fn === 'get_member_missed_payments' && x.body.p_gym_id === GYM && x.body.p_user_id === PRIYA));
  c.ok('layout (person)', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/owed-person-${name}.png`, fullPage: true });

  // Mark paid, with a note
  calls.length = 0;
  await dlg.locator('.missed').first().getByRole('button', { name: 'Mark paid' }).click();
  await c.has('asks for a note', dlg.getByLabel(/Add a note so the next person knows why/));
  await dlg.getByPlaceholder('e.g. Cash at the desk').fill('Cash at the desk 12 Oct');
  await dlg.getByRole('button', { name: 'Confirm' }).click();
  await c.has('it is marked as paid another way', dlg.locator('.missed.settled .tag', { hasText: 'Paid another way' }));
  const s1 = calls.find((x) => x.fn === 'settle');
  c.ok('settled exactly: this gym, that payment, paid, the note', s1 && s1.body.p_gym_id === GYM && s1.body.p_payment_id === P1 && s1.body.p_how === 'paid' && s1.body.p_note === 'Cash at the desk 12 Oct');
  await c.has('what they owe drops', dlg.locator('.owed-now', { hasText: 'Owes £30.00' }));
  const shown = await dlg.innerText();
  c.ok('who settled it and the note are shown', shown.includes('By Alex Owner') && shown.includes('Cash at the desk 12 Oct'));
  if (!(shown.includes('By Alex Owner') && shown.includes('Cash at the desk 12 Oct'))) console.log(JSON.stringify(shown));
  await page.waitForFunction(() => document.querySelector('[data-testid="owed-total"]')?.textContent === '£80.00').catch(() => {});
  c.ok('and the list behind it now adds up to the lower amount', (await page.getByTestId('owed-total').innerText()) === '£80.00');

  // Waive the other without a note
  calls.length = 0;
  await dlg.locator('.missed:not(.settled)').filter({ hasText: '£30.00' }).getByRole('button', { name: 'Waive' }).click();
  await dlg.getByRole('button', { name: 'Confirm' }).click();
  await c.has('nothing owed: they are financial', dlg.locator('.owed-now', { hasText: 'Nothing owed now: they are financial.' }));
  const s2 = calls.find((x) => x.fn === 'settle');
  c.ok('waived exactly, with no note sent', s2 && s2.body.p_payment_id === P2 && s2.body.p_how === 'waived' && !('p_note' in s2.body && s2.body.p_note));

  // Undo
  calls.length = 0;
  await dlg.locator('.missed').filter({ hasText: 'Waived' }).getByRole('button', { name: 'Undo' }).click();
  await c.has('it is owed again', dlg.locator('.owed-now', { hasText: 'Owes £30.00' }));
  const u = calls.find((x) => x.fn === 'reopen');
  c.ok('undone exactly: this gym, that payment', u && u.body.p_gym_id === GYM && u.body.p_payment_id === P2);

  // The database refuses
  refuse = true;
  await dlg.locator('.missed:not(.settled)').filter({ hasText: '£30.00' }).getByRole('button', { name: 'Write off' }).click();
  await dlg.getByRole('button', { name: 'Confirm' }).click();
  await c.has('a refusal is shown in words', dlg.getByText('That payment is not outstanding'));
  refuse = false;
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  c.ok('cancelling closes the form without saving', (await dlg.getByRole('button', { name: 'Confirm' }).count()) === 0);

  await dlg.getByRole('button', { name: 'Close' }).first().click();
  await c.has('back on the list', page.getByRole('button', { name: /^Sam Lee, owes £50\.00/ }));

  // Everyone is financial
  mode = 'empty';
  await page.reload();
  await page.getByRole('tab', { name: 'Money owed' }).click();
  await c.has('an empty list says so', page.getByText('Everyone is financial. Nobody has a missed payment.'));

  // Not allowed
  mode = 'denied';
  await page.reload();
  await page.getByRole('tab', { name: 'Money owed' }).click();
  await c.has('someone who is not an owner or admin is told so', page.getByText('Only owners and admins can see money owed.'));

  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
