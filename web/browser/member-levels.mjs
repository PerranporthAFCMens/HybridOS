// Browser gate: in the workout player the member picks Rx, Scaled or Foundations, and sees the gym's wording, cue and video link
// beside each movement. The choice is remembered. Without any movement wording there is no level choice. Supabase is mocked.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes } from './mock.mjs';

const hrs = (h) => new Date(Date.now() + h * 3600000).toISOString();
const snapshot = { title: 'Hybrid benchmark', blocks: [{ position: 0, title: 'Workout', activities: [
  { position: 0, activity_name: 'Sled Push', tracking_type: 'distance', prescription: { display: '20 m' } },
  { position: 1, activity_name: 'Plank', tracking_type: 'time', prescription: { display: '60 s' } },
] }] };
const movements = [
  { id: 'mv1', name: 'Sled Push', video_url: 'https://example.test/sled', cue: 'Drive through the legs', default_tracking: 'distance', is_active: true },
  { id: 'mv2', name: 'Plank', video_url: null, cue: null, default_tracking: 'time', is_active: true },
];
const levels = [
  { movement_id: 'mv1', level: 'rx', prescription: { display: '4 x 20 m at 152 kg' } },
  { movement_id: 'mv1', level: 'scaled', prescription: { display: '2 x 20 m at 102 kg' } },
];

const browser = await launch();
let allOk = true;
process.env.MOCK_ROLE = 'member';
for (const [name, viewport] of Object.entries(sizes)) {
  for (const withLevels of [true, false]) {
    const { ctx, page, errors } = await signedInPage(browser, { ...viewport });
    await mockSupabase(page, async ({ route, path, url }) => {
      if (path.endsWith('/rpc/member_class_schedule')) return reply(route, []);
      if (path.endsWith('/class_session_workouts')) return reply(route, [{ session_id: 'c1', title: 'Hybrid benchmark', workout_snapshot: snapshot, class_sessions: { name: 'Hybrid 6pm', starts_at: hrs(-3) } }].filter((w) => !url.searchParams.get('session_id') || url.searchParams.get('session_id') === `eq.${w.session_id}`));
      if (path.endsWith('/movements')) return reply(route, movements);
      if (path.endsWith('/movement_levels')) return reply(route, withLevels ? levels : []);
      if (path.endsWith('/memberships')) return reply(route, []);
      if (path.endsWith('/pt_appointments')) return reply(route, []);
      return false;
    });
    const c = runChecks();
    await page.goto(`${base}/m/train/class/c1`);
    await c.has('the workout opens', page.getByRole('heading', { name: 'Hybrid benchmark' }));
    const sled = page.getByRole('region', { name: 'Sled Push' });
    await c.has('the cue shows beside the movement', sled.getByText('Cue: Drive through the legs'));
    c.ok('and a video link that opens safely in a new tab', (await sled.getByRole('link', { name: 'Watch a video of Sled Push' }).getAttribute('rel')) === 'noopener noreferrer');
    const group = page.getByRole('radiogroup', { name: 'Your level' });
    if (withLevels) {
      await c.has('the level choice shows', group);
      c.ok('no level wording until one is chosen', (await sled.getByText('4 x 20 m at 152 kg').count()) === 0);
      await group.getByRole('radio', { name: 'Scaled' }).click();
      await c.has('Scaled wording shows', sled.getByText('2 x 20 m at 102 kg'));
      await group.getByRole('radio', { name: 'Foundations' }).click();
      c.ok('a level with no wording shows nothing extra', (await sled.getByText('2 x 20 m at 102 kg').count()) === 0);
      await group.getByRole('radio', { name: 'Rx' }).click();
      await c.has('Rx wording shows', sled.getByText('4 x 20 m at 152 kg'));
      await page.reload();
      await c.has('the choice is remembered', page.getByRole('region', { name: 'Sled Push' }).getByText('4 x 20 m at 152 kg'));
      c.ok('and marked on the button', (await page.getByRole('radiogroup', { name: 'Your level' }).getByRole('radio', { name: 'Rx' }).getAttribute('aria-checked')) === 'true');
    } else {
      c.ok('no level choice when no movement has level wording', (await group.count()) === 0);
    }
    const noSideways = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    c.ok('no sideways scroll', noSideways);
    c.ok('no page errors', errors.length === 0);
    if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ').slice(0, 500)}`);
    if (!c.report(`levels ${name} ${withLevels ? 'with' : 'without'} wording`)) allOk = false;
    await ctx.close();
  }
}
await browser.close();
process.exit(allOk ? 0 : 1);
