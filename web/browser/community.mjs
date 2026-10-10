// Browser gate: Community feed (post, comment, reply, delete), signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Checks threads (including a reply to a reply), that deleting asks first,
// and the exact request of every action.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const posts = [
  { id: 'p-new', user_id: 'u-amy', body: 'Summer challenge starts Monday', created_at: '2026-10-07T09:00:00Z' },
  { id: 'p-old', user_id: USER, body: 'Welcome to the new app', created_at: '2026-10-01T09:00:00Z' },
];
const comments = [
  { id: 'c1', post_id: 'p-new', user_id: 'u-ben', parent_comment_id: null, body: 'Count me in', created_at: '2026-10-07T10:00:00Z' },
  { id: 'c2', post_id: 'p-new', user_id: 'u-amy', parent_comment_id: 'c1', body: 'Great, see you there', created_at: '2026-10-07T11:00:00Z' },
  { id: 'c3', post_id: 'p-new', user_id: 'u-ben', parent_comment_id: 'c2', body: 'Bringing a friend', created_at: '2026-10-07T12:00:00Z' },
];
const profiles = [
  { id: 'u-amy', display_name: 'Amy Coach', first_name: null, last_name: null, avatar_url: null },
  { id: 'u-ben', display_name: null, first_name: 'Ben', last_name: 'Lifter', avatar_url: null },
  { id: USER, display_name: 'Olly Owner', first_name: null, last_name: null, avatar_url: null },
];

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
    const table = ['social_posts', 'social_comments'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'DELETE', 'PATCH'].includes(method)) { writes.push({ table, method, query: Object.fromEntries(url.searchParams), body }); await route.fulfill({ status: 204, body: '' }); return true; }
    if (path.endsWith('/social_posts')) return reply(route, posts);
    if (path.endsWith('/social_comments')) return reply(route, comments);
    if (path.endsWith('/social_reactions')) return reply(route, [{ post_id: 'p-new', comment_id: null }, { post_id: 'p-new', comment_id: null }]);
    if (path.endsWith('/profiles')) return reply(route, profiles);
    return false;
  });
  await page.goto(`${base}/community`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Community', level: 1 }));
  await c.has('newest post first', page.locator('article').first().getByText('Summer challenge starts Monday'));
  await c.has('counts', page.getByText('2 reactions · 3 comments'));
  await c.has('author names', page.getByText('Ben Lifter').first());
  c.ok('the reply to a reply is shown', (await page.getByText('Bringing a friend').count()) === 1);
  c.ok('replies are indented under their thread', (await page.locator('.cm-comment.reply').count()) === 2);
  c.ok('layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/community-${name}.png`, fullPage: true });

  // Post
  await page.getByRole('button', { name: 'Post to community' }).click();
  await c.has('empty post refused', page.getByText('Write something to post.'));
  c.ok('nothing written for an empty post', writes.length === 0);
  await page.getByLabel('Post to your members').fill('  Fresh news  ');
  await page.getByRole('button', { name: 'Post to community' }).click();
  await page.waitForTimeout(300);
  const wp = writes.find((x) => x.table === 'social_posts' && x.method === 'POST');
  c.ok('post exact', wp && JSON.stringify(wp.body) === JSON.stringify({ gym_id: GYM, user_id: USER, body: 'Fresh news' }));

  // Comment, and reply to a reply (stays in the same thread)
  writes.length = 0;
  const box = page.getByLabel('Add a comment to the post by Amy Coach');
  await box.fill('Looking forward to it');
  await page.getByRole('button', { name: 'Post comment on the post by Amy Coach' }).click();
  await page.waitForTimeout(300);
  const wc = writes.find((x) => x.table === 'social_comments' && x.method === 'POST');
  c.ok('comment exact (no parent)', wc && JSON.stringify(wc.body) === JSON.stringify({ gym_id: GYM, post_id: 'p-new', user_id: USER, parent_comment_id: null, body: 'Looking forward to it' }));
  writes.length = 0;
  await page.getByRole('button', { name: 'Reply to Ben Lifter' }).last().click();
  await c.has('replying note', page.getByText('Replying to Ben Lifter'));
  await box.fill('Welcome!');
  await box.press('Enter');
  await page.waitForTimeout(300);
  const wr = writes.find((x) => x.table === 'social_comments' && x.method === 'POST');
  c.ok('reply to a reply is attached to the top-level comment', wr && wr.body.parent_comment_id === 'c1' && wr.body.body === 'Welcome!');
  await page.getByRole('button', { name: 'Post comment on the post by Amy Coach' }).click();
  await c.has('empty comment refused', page.getByText('Write a comment first.'));

  // Delete asks first
  writes.length = 0;
  await page.getByRole('button', { name: 'Delete comment by Ben Lifter' }).first().click();
  await c.has('asks first', page.getByRole('alertdialog').getByText('Delete this comment?'));
  c.ok('nothing sent while asking', writes.length === 0);
  await page.getByRole('button', { name: 'Keep' }).click();
  c.ok('keep sends nothing', writes.length === 0);
  await page.getByRole('button', { name: 'Delete comment by Ben Lifter' }).first().click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await page.waitForTimeout(300);
  const dc = writes.find((x) => x.table === 'social_comments' && x.method === 'DELETE');
  c.ok('delete comment scoped', dc && dc.query.id === 'eq.c1' && dc.query.gym_id === `eq.${GYM}`);
  writes.length = 0;
  await page.getByRole('button', { name: 'Delete post by Olly Owner' }).click();
  await c.has('post delete warns about comments', page.getByText('Delete this post and all its comments?'));
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await page.waitForTimeout(300);
  const dp = writes.find((x) => x.table === 'social_posts' && x.method === 'DELETE');
  c.ok('delete post scoped', dp && dp.query.id === 'eq.p-old' && dp.query.gym_id === `eq.${GYM}`);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
