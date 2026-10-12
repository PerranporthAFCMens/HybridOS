// Browser gate: the member's Today screen obeys what the gym set under "What members see": which tiles show and in
// what order, the promo panel (buttons, https-only external link, off switch) and the door PIN (hidden until tapped,
// absent when switched off). Supabase is mocked at the network layer; phone and desktop width.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

process.env.MOCK_ROLE = 'member';
const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const classes = [
  { session_id: 'c1', name: 'Strength and Conditioning', description: '', starts_at: hours(26), ends_at: hours(27), capacity: 12, booked_count: 8, available_spaces: 4, is_booked: true },
  { session_id: 'c2', name: 'HIIT', description: '', starts_at: hours(30), ends_at: hours(31), capacity: 12, booked_count: 8, available_spaces: 4, is_booked: false },
];
const pbs = [{ id: 'b1', exercise_name: 'Back squat', metric_type: 'weight', comparison_direction: 'higher', value_numeric: 100, unit: 'kg', achieved_at: '2026-10-05T10:00:00Z', notes: null }];
const sessions = [{ id: 's1', title: 'Leg day', performed_at: '2026-10-06T10:00:00Z' }];

const scenarios = {
  custom: {
    settings: { home_layout: [{ key: 'membership', visible: true }, { key: 'hero', visible: true }, { key: 'goal', visible: false }, { key: 'progress', visible: true }, { key: 'activity', visible: false }], cta_config: { enabled: true, eyebrow: 'SUMMER', title: 'Summer challenge', body: 'Join in', primary_label: 'See classes', primary_target: 'classes', secondary_label: 'Rules', secondary_target: 'external', secondary_url: 'https://example.test/rules' } },
    door: { access_enabled: true, access_code: '4821', member_label: 'Front door', member_note: 'Push firmly' },
  },
  unsafe: {
    settings: { home_layout: [{ key: 'hero', visible: true }], cta_config: { enabled: true, title: 'Offer', primary_label: 'Bad link', primary_target: 'external', primary_url: 'javascript:alert(1)', secondary_label: 'Good', secondary_target: 'workouts' } },
    door: { access_enabled: false, access_code: '4821', member_label: null, member_note: null },
  },
  off: { settings: { home_layout: [{ key: 'hero', visible: true }], cta_config: { enabled: false } }, door: null },
  none: { settings: {}, door: null },
};

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  for (const [scenario, cfg] of Object.entries(scenarios)) {
    const { ctx, page, errors } = await signedInPage(browser, viewport);
    await mockSupabase(page, async ({ route, path }) => {
      if (path.endsWith('/rpc/member_class_schedule')) return reply(route, classes);
      if (path.endsWith('/rpc/get_member_home_settings')) return reply(route, cfg.settings);
      if (path.endsWith('/gym_access_settings')) return reply(route, cfg.door ? [cfg.door] : []);
      if (path.endsWith('/personal_bests')) return reply(route, pbs);
      if (path.endsWith('/workout_sessions')) return reply(route, sessions);
      if (path.endsWith('/memberships')) return reply(route, [{ id: 'm1', status: 'active', ends_on: null, created_at: '2026-01-01T00:00:00Z', membership_plans: { name: 'Classes Monthly', includes_classes: true, includes_open_gym: true, includes_pt: false } }]);
      return false;
    });
    await page.goto(`${base}/m/today`);
    const c = runChecks();
    await c.has('the screen loads', page.getByRole('heading', { level: 1 }));
    await page.waitForTimeout(600);
    const sections = () => page.locator('section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    const order = await sections();
    if (scenario === 'custom') {
      const idx = (l) => order.indexOf(l);
      c.ok('Membership comes before the promo panel, then the snapshot', idx('Membership') >= 0 && idx('Membership') < idx('From your gym') && idx('From your gym') < idx('Training snapshot'));
      c.ok('hidden tiles are not shown (goal, recent activity)', !order.includes('This week') && !order.includes('Recent activity'));
      c.ok('tiles not mentioned are added at the end (booked classes, PT)', order.includes('My booked classes'));
      await c.has('promo headline', page.getByText('Summer challenge'));
      c.ok('promo button goes to classes', (await page.getByRole('link', { name: 'See classes' }).getAttribute('href')) === '/m/classes');
      const ext = page.getByRole('link', { name: 'Rules' });
      c.ok('external https link opens safely in a new tab', (await ext.getAttribute('href')) === 'https://example.test/rules' && (await ext.getAttribute('rel')) === 'noopener noreferrer' && (await ext.getAttribute('target')) === '_blank');
      await c.has('door card is there', page.getByRole('region', { name: 'Door access' }));
      c.ok('the PIN is hidden until tapped', (await page.getByText('4821').count()) === 0);
      await page.getByRole('button', { name: 'Tap to reveal' }).click();
      await c.has('PIN shows after the tap', page.getByText('4821'));
      await c.has('the gym\'s note', page.getByText('Push firmly'));
      await page.getByRole('button', { name: 'Hide code' }).click();
      c.ok('and hides again', (await page.getByText('4821').count()) === 0);
      c.ok('snapshot shows the latest best', (await page.getByText('Back squat 100 kg').count()) >= 1);
    }
    if (scenario === 'unsafe') {
      c.ok('a javascript: link gets no button', (await page.getByRole('link', { name: 'Bad link' }).count()) === 0 && (await page.getByText('Bad link').count()) === 0);
      c.ok('the safe button stays', (await page.getByRole('link', { name: 'Good' }).getAttribute('href')) === '/m/train');
      c.ok('door PIN switched off: no door card', !order.includes('Door access'));
    }
    if (scenario === 'off') c.ok('promo switched off: nothing shown', !order.includes('From your gym'));
    if (scenario === 'none') c.ok('nothing set: the gym\'s defaults (promo, membership, snapshot) show', order.includes('From your gym') && order.includes('Membership') && order.includes('Training snapshot'));
    c.ok('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    c.ok('no page errors', errors.length === 0);
    if (!c.report(`member home ${name} / ${scenario}`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
