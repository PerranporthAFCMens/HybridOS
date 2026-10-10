// Browser gate: membership rules (owner), membership requests (owner), and the member's pause / change / cancel
// screens at phone and desktop width. Supabase is mocked at the network layer; every write is recorded and checked.
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

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
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const iso = (d) => d.toISOString().slice(0, 10);
const days = (n) => iso(new Date(Date.now() + n * 86400000));
const options = (over = {}) => ({
  membership: { id: 'm1', status: 'active', plan_id: 'p1', plan_name: 'Classes Monthly', price_pence: 3500, interval: 'monthly', starts_on: '2026-01-01', ends_on: null },
  pause: { enabled: true, allowed: true, reason: '', min_weeks: 2, max_weeks: 8, notice_days: 7, max_per_year: 2, used_this_year: 0, fee_pence: 500, approval: 'admin', earliest_start: days(7) },
  cancel: { enabled: true, allowed: true, reason: '', notice_days: 30, min_term_months: 6, early_mode: 'fee', offer_pause: true, ask_reason: true, approval: 'admin', in_term: true, last_day: days(30), fee_pence: 2500, term_ends_on: days(90) },
  change: { allowed: true, reason: '', approval: 'auto', plans: [{ id: 'p2', name: 'All Access', price_pence: 6500, interval: 'monthly', direction: 'up', starts_on: days(0) }] },
  requests: [],
  ...over,
});

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  // ---- owner: rules and requests ----
  process.env.MOCK_ROLE = 'owner';
  {
    const writes = [];
    const rpcs = [];
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, url, path, method, body }) => {
      if (path.endsWith('/membership_rules')) {
        if (['POST', 'PATCH'].includes(method)) { writes.push({ query: Object.fromEntries(url.searchParams), body }); await route.fulfill({ status: 204, body: '' }); return true; }
        return reply(route, []);
      }
      if (path.endsWith('/membership_requests')) {
        return reply(route, [
          { id: 'q1', kind: 'pause', status: 'pending', user_id: 'u1', effective_on: '2026-11-01', until_on: '2026-11-29', from_plan_id: 'p1', to_plan_id: null, reason: 'Injury', fee_pence: 500, requested_at: '2026-10-08T10:00:00Z', decided_at: null, decision_note: null, rules_snapshot: {} },
          { id: 'q2', kind: 'change_plan', status: 'approved', user_id: 'u2', effective_on: '2026-11-01', until_on: null, from_plan_id: 'p1', to_plan_id: 'p2', reason: null, fee_pence: 0, requested_at: '2026-10-05T10:00:00Z', decided_at: '2026-10-06T10:00:00Z', decision_note: 'Welcome up', rules_snapshot: { direction: 'up' } },
        ]);
      }
      if (path.endsWith('/rpc/decide_membership_request')) { rpcs.push(body); return reply(route, null); }
      if (path.endsWith('/membership_plans')) return reply(route, [{ id: 'p1', name: 'Classes Monthly', price_pence: 3500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true }, { id: 'p2', name: 'All Access', price_pence: 6500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true }]);
      if (path.endsWith('/profiles')) return reply(route, [{ id: 'u1', display_name: 'Jo Marsh', first_name: 'Jo', last_name: 'Marsh' }, { id: 'u2', display_name: 'Sam Lee', first_name: 'Sam', last_name: 'Lee' }]);
      return false;
    });
    const c = runChecks();
    await page.goto(`${base}/settings`);
    await c.has('settings lists the rules', page.getByText('Membership rules', { exact: true }));
    await page.goto(`${base}/membership-rules`);
    await c.has('rules heading', page.getByRole('heading', { name: 'Membership rules', level: 1 }));
    c.ok('everything starts off', !(await page.getByLabel('Members can ask to pause their membership').isChecked()) && (await page.getByLabel('Pause fee (£)').count()) === 0);
    await page.getByLabel('Members can ask to pause their membership').check();
    await page.getByLabel('Shortest pause (weeks)').fill('3');
    await page.getByLabel('Longest pause (weeks)').fill('2');
    await page.getByRole('button', { name: 'Save membership rules' }).click();
    await c.has('a shortest pause longer than the longest is refused', page.getByRole('alert').getByText('The shortest pause cannot be longer than the longest.'));
    c.ok('nothing written when refused', writes.length === 0);
    await page.getByLabel('Longest pause (weeks)').fill('6');
    await page.getByLabel('Pause fee (£)').fill('5');
    await page.getByLabel('Members can ask to cancel their membership').check();
    await page.getByLabel('Minimum term (months)').fill('6');
    await page.getByLabel('Leaving inside the minimum term').selectOption('fee');
    await page.getByLabel('Early cancellation fee (£)').fill('25');
    await page.getByLabel('Members can move to a more expensive plan').check();
    await page.getByLabel('A bigger plan starts').selectOption('next_month');
    c.ok('layout (rules)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/membership-rules-${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Save membership rules' }).click();
    await c.has('saved', page.getByText('Saved. Members see these rules straight away.'));
    const w = writes[0];
    c.ok('one upsert for this gym', writes.length === 1 && w.query.on_conflict === 'gym_id' && w.body.gym_id === GYM);
    c.ok('the exact rules were saved', w && w.body.pause_enabled === true && w.body.pause_min_weeks === 3 && w.body.pause_max_weeks === 6 && w.body.pause_fee_pence === 500 && w.body.cancel_enabled === true && w.body.cancel_min_term_months === 6 && w.body.cancel_early_mode === 'fee' && w.body.cancel_early_fee_pence === 2500 && w.body.upgrade_enabled === true && w.body.upgrade_starts === 'next_month' && w.body.downgrade_enabled === false && w.body.pause_approval === 'admin');

    await page.goto(`${base}/membership-requests`);
    await c.has('waiting request shows the member', page.getByRole('listitem', { name: 'Jo Marsh Pause' }));
    c.ok('and the recent one', (await page.getByRole('listitem', { name: 'Sam Lee Change plan' }).textContent()).includes('All Access'));
    c.ok('only waiting requests can be decided', (await page.getByRole('button', { name: 'Approve' }).count()) === 1);
    c.ok('layout (requests)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/membership-requests-${name}.png`, fullPage: true });
    await page.getByLabel('Note to Jo Marsh (optional)').fill('Get well soon');
    await page.getByRole('button', { name: 'Decline' }).click();
    await page.waitForTimeout(300);
    c.ok('declined with the note', rpcs.length === 1 && rpcs[0].p_request_id === 'q1' && rpcs[0].p_approve === false && rpcs[0].p_note === 'Get well soon');
    c.ok('no page errors', errors.length === 0);
    if (!c.report(`owner ${name}`)) allOk = false;
    await ctx.close();
  }

  // ---- member ----
  process.env.MOCK_ROLE = 'member';
  {
    const rpcs = [];
    let opts = options();
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, path, select, body }) => {
      if (path.endsWith('/rpc/get_my_membership_options')) return reply(route, opts);
      if (path.endsWith('/rpc/request_membership_pause') || path.endsWith('/rpc/request_membership_cancel') || path.endsWith('/rpc/request_membership_change') || path.endsWith('/rpc/withdraw_membership_request')) {
        rpcs.push({ fn: path.split('/').pop(), body });
        if (path.endsWith('request_membership_pause')) opts = options({ requests: [{ id: 'r1', kind: 'pause', status: 'pending', effective_on: body.p_starts_on, until_on: body.p_ends_on, to_plan_id: null, fee_pence: 500, requested_at: new Date().toISOString(), decision_note: null }] });
        if (path.endsWith('withdraw_membership_request')) opts = options();
        return reply(route, null);
      }
      if (path.endsWith('/memberships')) return reply(route, select.includes('membership_plans')
        ? [{ status: 'active', membership_plans: { name: 'Classes Monthly', includes_classes: true, includes_open_gym: false, includes_pt: false } }]
        : [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z' }]);
      if (path.endsWith('/profiles')) return reply(route, [{ display_name: 'Jo Marsh', first_name: 'Jo', last_name: 'Marsh' }]);
      return false;
    });
    const c = runChecks();
    await page.goto(`${base}/m/me`);
    await page.getByRole('link', { name: 'Pause, change or cancel' }).click();
    await c.has('membership page', page.getByRole('heading', { name: 'My membership' }));
    c.ok('shows the plan and price', (await page.getByLabel('Current membership').textContent()).includes('£35.00'));
    c.ok('three choices', (await page.getByLabel('What you can do').getByRole('button').count()) === 3);
    c.ok('layout (membership)', (await page.evaluate(layoutProblems)).length === 0);
    if (shots) await page.screenshot({ path: `${shots}/membership-member-${name}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Pause my membership' }).click();
    await page.getByLabel('Pause starts').fill(days(1));
    await page.getByLabel('Pause ends').fill(days(20));
    await page.getByRole('button', { name: 'Ask the gym' }).click();
    await c.has('too little notice is refused before sending', page.getByRole('alert').getByText(/needs 7 days notice/));
    c.ok('nothing sent', rpcs.length === 0);
    await page.getByLabel('Pause starts').fill(days(8));
    await page.getByLabel('Pause ends').fill(days(8 + 28));
    await page.getByRole('radio', { name: 'Injury' }).click();
    c.ok('layout (pause)', (await page.evaluate(layoutProblems)).length === 0);
    await page.getByRole('button', { name: 'Ask the gym' }).click();
    await c.has('sent', page.getByText('Sent. The gym will let you know.'));
    c.ok('exact pause request', rpcs.length === 1 && rpcs[0].fn === 'request_membership_pause' && rpcs[0].body.p_membership_id === 'm1' && rpcs[0].body.p_starts_on === days(8) && rpcs[0].body.p_ends_on === days(36) && rpcs[0].body.p_reason === 'Injury');
    await c.has('the request is listed as waiting', page.getByLabel('Your requests').getByText('Waiting for the gym'));
    await page.getByRole('button', { name: 'Withdraw Pause request' }).click();
    await c.has('withdrawn', page.getByText('Request withdrawn.'));
    c.ok('withdraw asked the database', rpcs[1]?.fn === 'withdraw_membership_request' && rpcs[1].body.p_request_id === 'r1');

    await page.getByRole('button', { name: 'Change my plan' }).click();
    await page.getByRole('button', { name: 'Choose All Access' }).click();
    await c.has('automatic change says so', page.getByText('Your plan is changing.'));
    c.ok('exact change request', rpcs[2]?.fn === 'request_membership_change' && rpcs[2].body.p_to_plan_id === 'p2');

    await page.getByRole('button', { name: 'Cancel my membership' }).click();
    await c.has('a pause is offered first', page.getByRole('heading', { name: 'Before you go' }));
    await page.getByRole('button', { name: 'No, I want to cancel' }).click();
    await c.has('the last day is shown', page.getByLabel('Cancel my membership').getByText(/Your last day would be/));
    c.ok('and the early fee', (await page.getByLabel('Cancel my membership').textContent()).includes('£25.00'));
    await page.getByRole('radio', { name: 'Cost' }).click();
    c.ok('layout (cancel)', (await page.evaluate(layoutProblems)).length === 0);
    await page.getByRole('button', { name: 'Ask the gym to cancel' }).click();
    await c.has('cancel sent', page.getByText('Sent. The gym will be in touch.'));
    c.ok('exact cancel request', rpcs[3]?.fn === 'request_membership_cancel' && rpcs[3].body.p_reason === 'Cost');

    opts = options({ pause: { ...options().pause, enabled: false, allowed: false }, cancel: { ...options().cancel, enabled: false, allowed: false }, change: { allowed: false, reason: '', approval: 'admin', plans: [] } });
    await page.reload();
    await c.has('with every rule off, members are told to ask at the gym', page.getByText('To pause, change or cancel your membership please ask at the gym.'));
    c.ok('no page errors', errors.length === 0);
    if (!c.report(`member ${name}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
