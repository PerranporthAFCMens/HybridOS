// Browser gate: the Members screen, signed in as an owner, at phone and desktop width.
// Supabase is mocked at the network layer. Besides what is on screen, this captures every write
// (lifecycle dates, membership status changes) and checks its exact request.
import { PDFDocument } from 'pdf-lib';
import { GYM, base, launch, mockSupabase, reply, runChecks, shots, signedInPage, sizes } from './mock.mjs';

const ADA = '33333333-3333-4333-8333-333333333333';
const BOB = '44444444-4444-4444-8444-444444444444';
const CAT = '55555555-5555-4555-8555-555555555555';
const PAT = '66666666-6666-4666-8666-666666666666';

const people = [
  { user_id: ADA, role: 'member', joined_at: '2026-03-01T00:00:00', attrition_on: null },
  { user_id: BOB, role: 'member', joined_at: '2026-05-01T00:00:00', attrition_on: null },
  { user_id: CAT, role: 'member', joined_at: '2026-04-01T00:00:00', attrition_on: '2026-09-30' },
  { user_id: PAT, role: 'owner', joined_at: '2026-02-01T00:00:00', attrition_on: null },
];
const profiles = [
  { id: ADA, display_name: null, first_name: 'Ada', last_name: 'Zane' },
  { id: BOB, display_name: 'Bob Adams', first_name: null, last_name: null },
  { id: CAT, display_name: null, first_name: 'Cat', last_name: 'Young' },
  { id: PAT, display_name: null, first_name: 'Pat', last_name: 'Boss' },
];

let hide = false;
const onePageDoc = await PDFDocument.create();
onePageDoc.addPage();
const STORED_PDF = Buffer.from(await onePageDoc.save());

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  const writes = [];
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  await mockSupabase(page, async ({ route, url, path, select, method, body }) => {
    if (path.endsWith('/rpc/get_member_details')) {
      return reply(route, hide
        ? { date_of_birth: '2001-03-14', phone_hidden: true, address_hidden: true, phone: null, has_details: true, address_line1: null, address_line2: null, town: null, postcode: null, emergency_name: 'Jo Zane', emergency_phone: '+447700900456', emergency_relationship: 'Mother', guardian_name: null, guardian_phone: null }
        : { date_of_birth: '2001-03-14', phone_hidden: false, address_hidden: false, phone: '+447700900123', has_details: true, address_line1: '12 High Street', address_line2: 'Flat 2', town: 'Truro', postcode: 'TR1 2AB', emergency_name: 'Jo Zane', emergency_phone: '+447700900456', emergency_relationship: 'Mother', guardian_name: null, guardian_phone: null }, 1);
    }
    if (path.endsWith('/rpc/staff_save_member_details')) {
      writes.push({ method, path, query: {}, body });
      return reply(route, { ok: true, under_18: false }, 1);
    }
    if (path.endsWith('/rpc/get_members_missing_details')) return reply(route, [{ user_id: BOB, member_name: 'Bob Adams', missing: ['address', 'emergency contact'] }]);
    if (path.includes('/storage/v1/object/sign/signed-documents/') && method === 'POST') return reply(route, { signedURL: '/object/sign/signed-documents/stored.pdf?token=t' });
    if (path.includes('/storage/v1/object/sign/signed-documents/') && method === 'GET') { await route.fulfill({ status: 200, contentType: 'application/pdf', body: STORED_PDF }); return true; }
    if (['PATCH', 'POST'].includes(method)) {
      writes.push({ method, path, query: Object.fromEntries(url.searchParams), body });
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    if (path.endsWith('/gym_members')) return reply(route, people);
    if (path.endsWith('/functions/v1/finalise-signature')) { writes.push({ method, path, body }); return reply(route, { ok: true }); }
    if (path.endsWith('/gym_signup_documents')) return reply(route, [{ id: 'dw', kind: 'waiver', title: 'Waiver', version: 1, source: 'text', acceptance_text: 'I have read the waiver.' }]);
    if (path.endsWith('/gym_signup_questions')) return reply(route, [{ id: 'q1', document_id: 'dw', prompt: 'Do you have a heart condition?', answer_type: 'yes_no', position: 1 }]);
    if (path.endsWith('/member_signature_answers')) return reply(route, [{ signature_id: 'sig1', question_id: 'q1', answer_yes: false, answer_text: null }]);
    if (path.endsWith('/member_signatures')) return reply(route, [{ id: 'sig1', gym_id: GYM, user_id: ADA, signed_at: '2026-10-06T09:00:00Z', signer_name: 'Ada Zane', signer_is_guardian: false, signature_png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', terms_document_id: null, waiver_document_id: 'dw', signed_terms_path: 'u/g/sig1-terms.pdf', signed_waiver_path: null, emailed_at: '2026-10-06T09:01:00Z' }]);
    if (path.endsWith('/profiles')) return reply(route, profiles);
    if (path.endsWith('/memberships') && select.includes('starts_on')) {
      return reply(route, [
        { id: 'm1', status: 'active', starts_on: '2026-03-01', ends_on: null, payment_provider: 'manual', payment_status: 'confirmed', term_months: 6, notice_days: 14, membership_plans: { name: 'Hybrid Monthly', price_pence: 4500, billing_interval: 'monthly' } },
        { id: 'm2', status: 'active', starts_on: '2026-04-01', ends_on: null, payment_provider: 'stripe', payment_status: 'confirmed', term_months: 0, notice_days: 30, membership_plans: { name: 'Stripe Gold', price_pence: 8000, billing_interval: 'monthly' } },
      ]);
    }
    if (path.endsWith('/memberships')) return reply(route, [{ user_id: ADA, status: 'active', membership_plans: { name: 'Hybrid Monthly' } }]);
    if (path.endsWith('/membership_plans')) {
      return reply(route, [{ id: 'p1', name: 'Hybrid Monthly', price_pence: 4500, billing_interval: 'monthly', access_type: 'hybrid', is_active: true }]);
    }
    return false;
  });

  await page.goto(`${base}/members`);
  const c = runChecks();
  await c.has('heading', page.getByRole('heading', { name: 'Members' }));
  await c.has('summary 3 users', page.getByText('4 gym users'));
  await c.has('plan and status on row', page.getByText('Hybrid Monthly · active'));
  await c.has('no membership yet', page.getByText('No membership yet').first());

  // Order by first name: Ada, Bob, Cat
  const order = await page.locator('.member-text b').allTextContents();
  c.ok('sorted by first name', order.join('|') === 'Ada Zane|Bob Adams|Cat Young|Pat Boss');

  // Search narrows the list and the summary
  await page.getByLabel('Search members by name').fill('zan');
  await c.has('search summary', page.getByText('1 of 4 gym users'));
  await page.getByLabel('Search members by name').fill('');

  // Who is missing details is shown to the gym, and opens the record
  await c.has('the missing details card', page.getByText('1 member is missing details'));
  await page.getByText('1 member is missing details').click();
  await c.has('it says who and what', page.getByText('Missing: address, emergency contact'));
  c.ok('no horizontal overflow (missing details)', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  c.ok('the Open button is a proper tap target', ((await page.locator('.missing-details').getByRole('button', { name: 'Open' }).boundingBox())?.height ?? 0) >= 40);
  await page.locator('.missing-details').getByRole('button', { name: 'Open' }).click();
  await c.has('Open shows that member\'s file as a page', page.getByRole('heading', { name: 'Bob Adams', level: 1 }));
  c.ok('the address is the member\'s own page', /\/members\/[0-9a-f-]+$/.test(page.url()));
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.locator('.member-row').first().waitFor();

  // The team are listed too, marked by role, and can be filtered
  c.ok('the owner is listed as an owner', (await page.locator('.member-row', { hasText: 'Pat Boss' }).textContent()).includes('Owner'));
  await page.getByLabel('Show', { exact: true }).selectOption('team');
  c.ok('team only', (await page.locator('.member-text b').allTextContents()).join('|') === 'Pat Boss');
  await page.getByLabel('Show', { exact: true }).selectOption('members');
  c.ok('members only', (await page.locator('.member-text b').allTextContents()).join('|') === 'Ada Zane|Bob Adams|Cat Young');
  await page.getByLabel('Show', { exact: true }).selectOption('all');
  await page.locator('.member-row', { hasText: 'Pat Boss' }).click();
  await c.has('a team record explains itself', page.getByText(/This is a team login/));
  c.ok('no member lifecycle dates for the team', (await page.getByText('Customer lifecycle').count()) === 0 && (await page.getByRole('button', { name: 'Assign membership' }).count()) === 0);
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.locator('.member-row').first().waitFor();

  // Jump letter: B only
  await page.locator('.member-jump button', { hasText: /^B$/ }).click();
  c.ok('letter filter', (await page.locator('.member-text b').allTextContents()).join('|') === 'Bob Adams');
  await page.locator('.member-jump button', { hasText: /^B$/ }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  c.ok('no horizontal overflow (list)', !overflow);
  if (shots) await page.screenshot({ path: `${shots}/members-${name}.png`, fullPage: true });

  // Open Ada's record
  await page.locator('.member-row', { hasText: 'Ada Zane' }).click();
  const dialog = page.locator('main.main');
  await c.has('record opens', dialog.getByText('Customer lifecycle'));
  await c.has('existing membership', dialog.getByRole('heading', { name: 'Hybrid Monthly' }));
  // What the gym holds on the member: date of birth, mobile, address, emergency contact, and the signed copies
  await c.has('date of birth and age', dialog.getByText(/14 Mar 2001 \(\d+\)/));
  await c.has('mobile', dialog.getByText('07700 900123'));
  await c.has('address', dialog.getByText('12 High Street, Flat 2, Truro, TR1 2AB'));
  await c.has('emergency contact and relationship', dialog.getByText('Jo Zane (Mother), 07700 900456'));
  await c.has('the file has a Signed agreements section', dialog.getByRole('heading', { name: 'Signed agreements' }));
  await c.has('with the exact time to the second', dialog.getByText('Tuesday 6 October 2026 at 10:00:00 BST'));
  await c.has('who signed', dialog.getByText('Signed by Ada Zane'));
  await c.has('what they agreed to', dialog.getByText('I have read the waiver.'));
  await c.has('and their answer', dialog.getByText(/Do you have a heart condition\?/));
  await c.has('and their signature', dialog.getByRole('img', { name: 'Signature of Ada Zane' }));
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  if (shots) await pdf.saveAs(`${shots}/member-file-${name}.pdf`);
  c.ok('Download PDF saves the stored signed copy, named for the gym, the person and the signing date', pdf.suggestedFilename() === 'puffin-performance-ada-zane-signed-copy-2026-10-06.pdf');
  c.ok('and it is the stored file, not a new one', (await import('node:fs')).readFileSync(await pdf.path()).equals(STORED_PDF));
  await page.getByRole('button', { name: 'Send to customer' }).click();
  await c.has('Send to customer asks first', page.getByText(/Email the signed copy to Ada Zane/));
  writes.length = 0;
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await c.has('and says it was sent', page.getByText('Sent the signed copy to Ada Zane.'));
  const sentCopy = writes.find((w) => w.path.endsWith('/functions/v1/finalise-signature'));
  c.ok('it asks the server to email that signing again, to the person', sentCopy && sentCopy.body.signature_id === 'sig1' && sentCopy.body.send_email === true && sentCopy.body.resend === true);
  writes.length = 0;
  c.ok('no Make PDF or Resend buttons on the file', (await dialog.getByRole('button', { name: /Make PDF|Resend|Send email/ }).count()) === 0);
  if (shots) await page.screenshot({ path: `${shots}/member-file-${name}.png`, fullPage: true });
  c.ok('no horizontal overflow (details)', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // Editing: the form starts from what is held, is checked, and saves through the checked database call
  await dialog.getByRole('button', { name: 'Edit details' }).click();
  c.ok('the form starts from what is held', (await dialog.getByLabel('Mobile number').inputValue()) === '07700 900123' && (await dialog.getByLabel('Postcode').inputValue()) === 'TR1 2AB' && (await dialog.getByLabel('Emergency contact is their…').inputValue()) === 'Mother');
  await dialog.getByLabel('Mobile number').fill('123');
  await dialog.getByRole('button', { name: 'Save details' }).click();
  await c.has('a bad mobile number is refused on the screen', dialog.getByText(/valid mobile number/));
  c.ok('and nothing was sent', !writes.some((w) => w.path.endsWith('/rpc/staff_save_member_details')));
  await dialog.getByLabel('First name').fill('Adaline');
  await dialog.getByLabel('Mobile number').fill('07700 900999');
  await dialog.getByLabel('Postcode').fill('pl28 8ab');
  await dialog.getByRole('button', { name: 'Save details' }).click();
  await c.has('saved', dialog.getByText('Saved.'));
  const sent = writes.find((w) => w.path.endsWith('/rpc/staff_save_member_details'));
  c.ok('sent for this gym and this member, in the form the database wants', !!sent && sent.body.p_gym_id === GYM && sent.body.p_user_id === ADA && sent.body.p_first_name === 'Adaline' && sent.body.p_phone === '+447700900999' && sent.body.p_postcode === 'PL28 8AB' && sent.body.p_date_of_birth === '2001-03-14' && sent.body.p_emergency_phone === '+447700900456');
  c.ok('the form closes after saving', (await dialog.getByRole('button', { name: 'Save details' }).count()) === 0);
  writes.length = 0;
  if (shots) await page.screenshot({ path: `${shots}/member-record-${name}.png` });

  // iPhone date boxes have a wide built-in minimum width. Fake that here and check the boxes
  // stay inside the lifecycle card instead of spilling past its edge.
  await page.addStyleTag({ content: 'input[type=date]::-webkit-datetime-edit{display:inline-block;min-width:330px}' });
  const spill = await page.evaluate(() => {
    return { worst: Math.max(...[...document.querySelectorAll('.record-section input[type=date]')].map((i) => i.getBoundingClientRect().right - i.closest('.record-section').getBoundingClientRect().right)), scrolls: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  c.ok('date boxes stay inside the card with wide built-in width', spill.worst <= 0 && !spill.scrolls);

  // Lifecycle validation, then a real save
  await dialog.getByLabel('Attrition date').fill('2026-02-01');
  await dialog.getByRole('button', { name: 'Save lifecycle dates' }).click();
  await c.has('attrition before joined is refused', dialog.getByText('Attrition cannot be before joined date.'));
  c.ok('no write on invalid dates', writes.length === 0);
  await dialog.getByLabel('Attrition date').fill('2026-09-01');
  await dialog.getByRole('button', { name: 'Save lifecycle dates' }).click();
  await c.has('lifecycle saved', dialog.getByText('Saved.'));
  // "Saved." is also still on screen from the details save a moment ago, so wait for the lifecycle write itself (on a busy runner it can arrive after that text is seen).
  for (let i = 0; i < 100 && !writes.some((w) => w.method === 'PATCH' && w.path.endsWith('/gym_members')); i++) await page.waitForTimeout(100);
  const life = writes.find((w) => w.method === 'PATCH' && w.path.endsWith('/gym_members'));
  c.ok('lifecycle write scoped to gym, user, member role', life && life.query.gym_id === `eq.${GYM}` && life.query.user_id === `eq.${ADA}` && life.query.role === 'eq.member');
  c.ok('lifecycle write body', life && life.body.joined_at === '2026-03-01T00:00:00' && life.body.attrition_on === '2026-09-01' && life.body.is_active === false && typeof life.body.updated_at === 'string');

  // Pause, then cancel
  const card1 = dialog.locator('.membership-card', { hasText: 'Hybrid Monthly' });
  const card2 = dialog.locator('.membership-card', { hasText: 'Stripe Gold' });
  await card1.getByRole('button', { name: 'Pause' }).click();
  await c.has('membership updated', dialog.getByText('Membership updated.'));
  const pause = writes.find((w) => w.path.endsWith('/memberships') && w.body?.status === 'paused');
  c.ok('pause write', pause && pause.method === 'PATCH' && pause.query.id === 'eq.m1' && pause.query.gym_id === `eq.${GYM}` && Object.keys(pause.body).join() === 'status');

  // Ending a membership is a staff override: it needs a reason, ignores the term and notice, and is kept on the record
  await c.has('their own terms are shown', card1.getByText('Their terms: 6 months minimum · 2 weeks notice to leave'));
  c.ok('the old one-click cancel button is gone', (await dialog.getByRole('button', { name: 'Cancel', exact: true }).count()) === 0);
  await card1.getByRole('button', { name: 'End membership…' }).click();
  await card1.getByRole('button', { name: 'End membership', exact: true }).click();
  await c.has('a reason is required', card1.getByText('Give a reason (a few words is fine).'));
  c.ok('nothing was sent without a reason', !writes.some((w) => w.path.endsWith('/rpc/staff_end_membership')));
  await card1.getByLabel('Reason (required)').fill('Moved away, agreed at the desk');
  await card1.getByRole('button', { name: 'End membership', exact: true }).click();
  await c.has('ended today', card1.getByText('Membership ended today.'));
  const ended = writes.find((w) => w.path.endsWith('/rpc/staff_end_membership'));
  c.ok('end write: this membership, today, with the reason', ended && ended.body.p_membership_id === 'm1' && ended.body.p_last_day === null && ended.body.p_reason === 'Moved away, agreed at the desk');
  c.ok('a manual membership does not call Stripe', !writes.some((w) => w.path.endsWith('/functions/v1/stripe-membership-sync')));

  // Releasing from the minimum term
  await card1.getByRole('button', { name: 'Release from minimum term…' }).click();
  await card1.getByRole('button', { name: 'Release them' }).click();
  await c.has('a reason is required to release', card1.getByText('Give a reason (a few words is fine).'));
  await card1.getByLabel('Reason (required)').fill('Goodwill, long illness');
  await card1.getByRole('button', { name: 'Release them' }).click();
  await c.has('released', card1.getByText('Ada Zane is released from their minimum term.'));
  const released = writes.find((w) => w.path.endsWith('/rpc/staff_release_from_term'));
  c.ok('release write', released && released.body.p_membership_id === 'm1' && released.body.p_reason === 'Goodwill, long illness');
  c.ok('a member with no term has no release button', (await card2.getByRole('button', { name: 'Release from minimum term…' }).count()) === 0);

  // A card-paying (Stripe) member: ending it on a date also tells Stripe
  await card2.getByRole('button', { name: 'End membership…' }).click();
  await card2.getByLabel('When').selectOption('date');
  await card2.getByRole('button', { name: 'End membership', exact: true }).click();
  await c.has('a last day is required', card2.getByText('Choose their last day.'));
  await card2.getByLabel('Last day').fill('2099-01-31');
  await card2.getByLabel('Reason (required)').fill('Injury, last day agreed');
  await card2.getByRole('button', { name: 'End membership', exact: true }).click();
  await c.has('booked', card2.getByText(/Booked: their last day is 2099-01-31\./));
  const ended2 = writes.find((w) => w.path.endsWith('/rpc/staff_end_membership') && w.body.p_membership_id === 'm2');
  c.ok('end-on-a-date write', ended2 && ended2.body.p_last_day === '2099-01-31' && ended2.body.p_reason === 'Injury, last day agreed');
  const synced = writes.find((w) => w.path.endsWith('/functions/v1/stripe-membership-sync'));
  c.ok('Stripe was told to match, for that membership only', synced && synced.body.membership_id === 'm2');

  // There is no way to assign a membership by hand: people join through the sign-up link and pay
  c.ok('no assign-membership box, and no GoCardless wording anywhere on the record', (await dialog.getByText('Assign membership').count()) === 0 && (await dialog.getByLabel('Payment method').count()) === 0 && (await dialog.getByText(/GoCardless/i).count()) === 0);

  const overflowModal = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  c.ok('no horizontal overflow (record)', !overflowModal);
  await page.getByRole('button', { name: '‹ Back' }).click();
  await page.locator('.member-row').first().waitFor();

  // When the owner has hidden mobile numbers and addresses from the team: they are not shown, and only the owner can edit
  hide = true;
  await page.locator('.member-row', { hasText: 'Cat Young' }).click();
  await c.has('hidden things say so', dialog.getByText('Hidden by the owner').first());
  c.ok('the mobile number and address are not on the screen', (await dialog.getByText('07700 900123').count()) === 0 && (await dialog.getByText('12 High Street').count()) === 0);
  c.ok('the emergency contact is still shown', (await dialog.getByText('Jo Zane (Mother), 07700 900456').count()) === 1);
  c.ok('no way to edit, and it says why', (await dialog.getByRole('button', { name: /Edit details|Add details/ }).count()) === 0 && (await dialog.getByText(/only the owner can edit/).count()) === 1);
  hide = false;
  c.ok('no page errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
