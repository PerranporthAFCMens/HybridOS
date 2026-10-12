// Browser gate: the member app's Community tab (/m/community) as a member, at phone and desktop width. Supabase is
// mocked at the network layer. Checks the feed, posting, commenting, replying (to a reply, stays in the thread),
// liking and unliking a post and a comment, that delete is offered only on your own things and asks first, and
// the exact request of every action.
import { GYM, USER, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

process.env.MOCK_ROLE = 'member';
const posts = [
  { id: 'p-new', user_id: 'u-amy', body: 'Broadcast-style news from Amy', created_at: '2026-10-07T09:00:00Z' },
  { id: 'p-mine', user_id: USER, body: 'My first week done', created_at: '2026-10-01T09:00:00Z' },
];
const comments = [
  { id: 'c1', post_id: 'p-new', user_id: 'u-ben', parent_comment_id: null, body: 'Count me in', created_at: '2026-10-07T10:00:00Z' },
  { id: 'c2', post_id: 'p-new', user_id: USER, parent_comment_id: 'c1', body: 'Me too', created_at: '2026-10-07T11:00:00Z' },
  { id: 'c3', post_id: 'p-new', user_id: 'u-ben', parent_comment_id: 'c2', body: 'Bringing a friend', created_at: '2026-10-07T12:00:00Z' },
];
const profiles = [
  { id: 'u-amy', display_name: 'Amy Coach', first_name: null, last_name: null, avatar_url: null },
  { id: 'u-ben', display_name: null, first_name: 'Ben', last_name: 'Lifter', avatar_url: null },
  { id: USER, display_name: 'Me Myself', first_name: null, last_name: null, avatar_url: null },
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  for (const e of document.querySelectorAll('#root *')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`;
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${name} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && r.height < 40) problems.push(`${name} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const likes = [{ post_id: 'p-new', comment_id: null, user_id: 'u-ben' }, { post_id: null, comment_id: 'c1', user_id: USER }];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, method, body }) => {
    const table = ['social_posts', 'social_comments', 'social_reactions'].find((t) => path.endsWith(`/${t}`));
    if (table && ['POST', 'DELETE', 'PATCH'].includes(method)) { writes.push({ table, method, query: Object.fromEntries(url.searchParams), body }); await route.fulfill({ status: 204, body: '' }); return true; }
    if (path.endsWith('/social_posts')) return reply(route, posts);
    if (path.endsWith('/social_comments')) return reply(route, comments);
    if (path.endsWith('/social_reactions')) return reply(route, url.searchParams.get('post_id') ? likes.filter((l) => l.post_id) : likes.filter((l) => l.comment_id));
    if (path.endsWith('/profiles')) return reply(route, profiles);
    return false;
  });
  await page.goto(`${base}/m/community`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Community', level: 1 }));
  await c.has('newest post first', page.locator('article').first().getByText('Broadcast-style news from Amy'));
  await c.has('the tab is in the bar', page.getByRole('navigation', { name: 'Member' }).getByRole('link', { name: 'Community' }));
  await c.has('comment count on the post', page.getByRole('button', { name: '3 comments' }));
  await c.has('like count on the post', page.getByRole('button', { name: 'Like the post by Amy Coach' }).filter({ hasText: '· 1' }));
  c.ok('no delete on someone else\'s post', (await page.getByRole('button', { name: 'Delete your post' }).count()) === 1);

  // Open the comments
  await page.getByRole('button', { name: '3 comments' }).click();
  await c.has('the reply to a reply is shown', page.getByText('Bringing a friend'));
  c.ok('replies are indented', (await page.locator('.cm-comment.reply').count()) === 2);
  await c.has('my own comment shows Liked', page.getByRole('button', { name: 'Unlike the comment by Ben Lifter' }));
  c.ok('delete only on my own comment', (await page.getByRole('button', { name: 'Delete your comment' }).count()) === 1);
  c.ok('layout', (await page.evaluate(layoutProblems)).length === 0);
  if (shots) await page.screenshot({ path: `${shots}/member-community-${name}.png`, fullPage: true });

  // Post
  await page.getByRole('button', { name: 'Post', exact: true }).first().click();
  await c.has('empty post refused', page.getByText('Write something to post.'));
  c.ok('nothing written for an empty post', writes.length === 0);
  await page.getByLabel('Share something with the gym').fill('  Hello gym  ');
  await page.getByRole('button', { name: 'Post', exact: true }).first().click();
  await page.waitForTimeout(300);
  const wp = writes.find((x) => x.table === 'social_posts' && x.method === 'POST');
  c.ok('post exact', wp && JSON.stringify(wp.body) === JSON.stringify({ gym_id: GYM, user_id: USER, body: 'Hello gym' }));

  // Like and unlike a post
  writes.length = 0;
  await page.getByRole('button', { name: 'Like the post by Amy Coach' }).click();
  await page.waitForTimeout(300);
  const lp = writes.find((x) => x.table === 'social_reactions' && x.method === 'POST');
  c.ok('like exact', lp && JSON.stringify(lp.body) === JSON.stringify({ gym_id: GYM, user_id: USER, reaction: 'like', post_id: 'p-new' }));
  writes.length = 0;
  await page.getByRole('button', { name: 'Unlike the comment by Ben Lifter' }).click();
  await page.waitForTimeout(300);
  const ul = writes.find((x) => x.table === 'social_reactions' && x.method === 'DELETE');
  c.ok('unlike is scoped to me and that comment', ul && ul.query.user_id === `eq.${USER}` && ul.query.comment_id === 'eq.c1');

  // Comment, then reply to a reply (attached to the top-level comment)
  writes.length = 0;
  const box = page.getByLabel('Add a comment to the post by Amy Coach');
  await box.fill('Looking forward to it');
  await page.getByRole('button', { name: 'Post comment on the post by Amy Coach' }).click();
  await page.waitForTimeout(300);
  const wc = writes.find((x) => x.table === 'social_comments' && x.method === 'POST');
  c.ok('comment exact', wc && JSON.stringify(wc.body) === JSON.stringify({ gym_id: GYM, post_id: 'p-new', user_id: USER, parent_comment_id: null, body: 'Looking forward to it' }));
  writes.length = 0;
  await page.getByRole('button', { name: 'Reply to Ben Lifter' }).last().click();
  await c.has('replying note', page.getByText('Replying to Ben Lifter'));
  await box.fill('Welcome!');
  await box.press('Enter');
  await page.waitForTimeout(300);
  const wr = writes.find((x) => x.table === 'social_comments' && x.method === 'POST');
  c.ok('reply to a reply goes under the top-level comment', wr && wr.body.parent_comment_id === 'c1' && wr.body.body === 'Welcome!');

  // Delete asks first
  writes.length = 0;
  await page.getByRole('button', { name: 'Delete your comment' }).click();
  await c.has('asks first', page.getByRole('alertdialog').getByText('Delete your comment?'));
  c.ok('nothing sent while asking', writes.length === 0);
  await page.getByRole('button', { name: 'Keep' }).click();
  c.ok('keep sends nothing', writes.length === 0);
  await page.getByRole('button', { name: 'Delete your comment' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await page.waitForTimeout(300);
  const dc = writes.find((x) => x.table === 'social_comments' && x.method === 'DELETE');
  c.ok('delete comment scoped', dc && dc.query.id === 'eq.c2' && dc.query.gym_id === `eq.${GYM}`);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(`member community ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
