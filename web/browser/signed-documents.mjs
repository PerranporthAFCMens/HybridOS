// Browser gate: Members › Signed documents. Mocked network only. Search, sort, the exact timestamp, the signature, and the PDF buttons.
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes, GYM } from './mock.mjs';

const U = { ann: '44444444-4444-4444-8444-444444444441', ben: '44444444-4444-4444-8444-444444444442', cat: '44444444-4444-4444-8444-444444444443' };
const row = (id, user, signer, guardian, at, termsPath, waiverPath, emailedAt, error) => ({ id, gym_id: GYM, user_id: user, signer_name: signer, signer_is_guardian: guardian, signature_png: 'data:image/png;base64,iVBORw0KGgo=', terms_document_id: 'dt', waiver_document_id: 'dw', signed_at: at, agreed_text: 'I have read the waiver.', signed_terms_path: termsPath, signed_waiver_path: waiverPath, emailed_at: emailedAt, email_error: error });
const SIGS = [
  row('s1', U.ann, 'Ann Archer', false, '2026-10-09T10:00:00Z', null, null, null, null),
  row('s2', U.ben, 'Pat Baker', true, '2026-10-11T15:29:12Z', 'u/g/s2-terms.pdf', 'u/g/s2-waiver.pdf', '2026-10-11T15:30:00Z', null),
  row('s3', U.cat, 'Cat Cole', false, '2026-10-10T08:00:00Z', null, null, null, 'Failed at build_pdfs: boom'),
];

function layoutProblems() {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) problems.push('page scrolls sideways');
  return problems;
}

const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  process.env.MOCK_ROLE = 'owner';
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  const calls = [];
  await mockSupabase(page, async ({ route, path, select, body }) => {
    if (path.endsWith('/functions/v1/finalise-signature')) { calls.push(body); return reply(route, { ok: true }); }
    if (path.endsWith('/member_signatures') && select.includes('signature_png') && !select.includes('*')) return reply(route, { signature_png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', agreed_text: 'I have read the waiver.' });
    if (path.endsWith('/member_signatures')) return reply(route, SIGS);
    if (path.endsWith('/profiles')) return reply(route, [{ id: U.ann, display_name: 'Ann Archer', first_name: 'Ann', last_name: 'Archer' }, { id: U.ben, display_name: 'Ben Baker', first_name: 'Ben', last_name: 'Baker' }, { id: U.cat, display_name: 'Cat Cole', first_name: 'Cat', last_name: 'Cole' }]);
    if (path.endsWith('/gym_signup_documents')) return reply(route, [{ id: 'dt', version: 2 }, { id: 'dw', version: 1 }]);
    return false;
  });
  const c = runChecks();
  const names = () => page.locator('.signed-item b').allTextContents();
  await page.goto(`${base}/signed-documents`);
  await c.has('heading', page.getByRole('heading', { name: 'Signed documents' }));
  await page.locator('.signed-item').first().waitFor();
  c.ok('newest first by default', (await names()).join() === 'Ben Baker,Cat Cole,Ann Archer');
  await page.getByLabel('Sort', { exact: true }).selectOption('az');
  c.ok('A to Z', (await names()).join() === 'Ann Archer,Ben Baker,Cat Cole');
  await page.getByLabel('Sort', { exact: true }).selectOption('za');
  c.ok('Z to A', (await names()).join() === 'Cat Cole,Ben Baker,Ann Archer');
  await page.getByLabel('Sort', { exact: true }).selectOption('oldest');
  c.ok('oldest first', (await names()).join() === 'Ann Archer,Cat Cole,Ben Baker');
  await page.getByLabel('Search signed documents').fill('pat');
  c.ok('search finds the signer, not only the member', (await names()).join() === 'Ben Baker');
  await page.getByLabel('Search signed documents').fill('zzz');
  await c.has('a search with no match says so', page.getByText('No signed documents match your search.'));
  await page.getByLabel('Search signed documents').fill('');
  await c.has('a parent signing is shown as such', page.getByText(/Pat Baker \(parent or guardian of Ben Baker\)/));
  await c.has('the exact time, with seconds and the time zone', page.getByText(/Sunday 11 October 2026 at 16:29:12 BST/).first());
  c.ok('PDF buttons only where a PDF exists', (await page.getByRole('button', { name: 'Terms PDF' }).count()) === 1 && (await page.getByRole('button', { name: 'Waiver PDF' }).count()) === 1);
  c.ok('and a plain note where none was made', (await page.getByText('No PDF made yet').count()) === 2);
  await c.has('a failed email shows its reason', page.getByText('Email failed: Failed at build_pdfs: boom'));
  c.ok('Make PDF only on rows with no PDF', (await page.getByRole('button', { name: 'Make PDF' }).count()) === 2);
  c.ok('Resend email on the row that was emailed', (await page.getByRole('button', { name: 'Resend email' }).count()) === 1);
  await page.getByRole('button', { name: 'Make PDF' }).first().click();
  await c.has('making a PDF says so', page.getByText(/Made the PDF for/));
  c.ok('and asks only for the copies, without emailing the member', calls.length === 1 && calls[0].send_email === false && calls[0].resend === false && typeof calls[0].signature_id === 'string');
  await page.getByRole('button', { name: 'Resend email' }).click();
  await c.has('resending says so', page.getByText('Emailed the signed copies to Ben Baker.'));
  c.ok('and asks for the email to be sent again', calls.length === 2 && calls[1].signature_id === 's2' && calls[1].send_email === true && calls[1].resend === true);
  await page.getByRole('button', { name: 'View signature' }).first().click();
  await c.has('the signature image opens', page.getByRole('img', { name: /Signature of/ }));
   await c.has('with what they agreed to', page.getByText('I have read the waiver.').first());
  c.ok('no horizontal overflow', (await page.evaluate(layoutProblems)).length === 0);
  c.ok('no page errors', errors.length === 0);
  if (!c.report(`signed documents ${name}`)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
