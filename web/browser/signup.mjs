// Browser gate: Settings › Sign-up process. Mocked network only. Checks the page, adding a typed waiver with questions,
// uploading a PDF terms, what is sent, refusals, and who has signed (with flagged answers).
import { base, launch, mockSupabase, reply, runChecks, signedInPage, sizes, GYM } from './mock.mjs';

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
    if (cs.position !== 'fixed' && cs.position !== 'absolute' && (r.right > vw + 1 || r.left < -1)) problems.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} runs off the screen`);
    const interactive = ['button', 'select', 'input', 'textarea'].includes(e.tagName.toLowerCase()) || e.matches('.btn');
    if (interactive && !e.closest('.menu-btn') && r.height < 40) problems.push(`${e.tagName.toLowerCase()} only ${Math.round(r.height)}px tall`);
  }
  return problems;
}

const U1 = '44444444-4444-4444-8444-444444444444';
const browser = await launch();
let allOk = true;
for (const [name, viewport] of Object.entries(sizes)) {
  process.env.MOCK_ROLE = 'owner';
  const { ctx, page, errors } = await signedInPage(browser, viewport);
  const state = { docs: [], saved: [], uploaded: [], removed: [] };
  await mockSupabase(page, async ({ route, path, method, body, select }) => {
    if (path.endsWith('/gym_signup_documents') && method === 'GET') return reply(route, state.docs);
    if (path.endsWith('/gym_signup_questions') && select.includes('flag_on_yes') && !select.includes('*')) return reply(route, [{ id: 'q1', prompt: 'Do you have a heart condition?', flag_on_yes: true }]);
    if (path.endsWith('/gym_signup_questions')) return reply(route, state.docs.length ? [{ id: 'q1', document_id: 'd1', position: 1, prompt: 'Do you have a heart condition?', answer_type: 'yes_no', details_if_yes: true, is_required: true, flag_on_yes: true }] : []);
    if (path.endsWith('/gyms')) return reply(route, [{ slug: 'puffin' }]);
    if (path.endsWith('/rpc/add_gym_signup_document')) {
      state.saved.push(body);
      state.docs = [{ id: 'd1', gym_id: GYM, kind: body.p_kind, version: 1, title: body.p_title, source: body.p_source, file_path: body.p_file_path, file_name: body.p_file_name, file_size: body.p_file_size, body_text: body.p_body_text, acceptance_text: body.p_acceptance_text, is_current: true, uploaded_at: '2026-10-11T10:00:00Z', uploaded_by: null, retired_at: null }, ...state.docs.filter((d) => d.kind !== body.p_kind)];
      return reply(route, { ok: true, id: 'd1', version: 1, questions: (body.p_questions ?? []).length });
    }
    if (path.endsWith('/rpc/remove_gym_signup_document')) { state.removed.push(body); state.docs = state.docs.filter((d) => d.kind !== body.p_kind); return reply(route, { ok: true }); }
    if (path.includes('/storage/v1/object/gym-signup-documents/')) { state.uploaded.push(path); return reply(route, { Key: 'ok' }); }
    if (path.endsWith('/member_signatures')) return reply(route, [{ id: 's1', gym_id: GYM, user_id: U1, signer_name: 'Sam Penrose', signer_is_guardian: true, signature_png: 'x', terms_document_id: null, waiver_document_id: 'd1', signed_at: '2026-10-11T09:00:00Z', agreed_text: '', signed_terms_path: null, signed_waiver_path: null, emailed_at: null, email_error: null }]);
    if (path.endsWith('/profiles')) return reply(route, [{ id: U1, display_name: 'Jo Penrose', first_name: 'Jo', last_name: 'Penrose' }]);
    if (path.endsWith('/member_signature_answers')) return reply(route, [{ id: 'a1', signature_id: 's1', question_id: 'q1', answer_yes: true, answer_text: 'Mild, controlled' }]);
    return false;
  });
  const c = runChecks();
  const fill = (label, value) => page.getByLabel(label, { exact: true }).fill(value);
  await page.goto(`${base}/settings`);
  await c.has('settings lists Sign-up process', page.getByText('Sign-up process', { exact: true }));
  await page.goto(`${base}/signup-process`);
  await c.has('page loads', page.getByRole('heading', { name: 'Sign-up process', level: 1 }));
  await c.has('the sign-up link is shown', page.getByText(/\/join\/puffin/));
  await c.has('nothing set up yet', page.getByText(/Not set up. New members are not asked to sign a waiver/));
  c.ok('layout (empty)', (await page.evaluate(layoutProblems)).length === 0);

  await page.getByRole('button', { name: 'Set up waiver' }).click();
  const dialog = page.getByRole('dialog');
  await c.has('editor opens', dialog.getByRole('heading', { name: 'Set up waiver' }));
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('typed wording is required', dialog.getByRole('alert').filter({ hasText: 'Type or paste the wording' }));
  await fill('Wording', 'I accept the risks of training.');
  await dialog.getByRole('button', { name: 'Add a question' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('a blank question is refused', dialog.getByRole('alert').filter({ hasText: 'Question 1 needs some wording' }));
  await fill('Question 1', 'Do you have a heart condition?');
  await dialog.getByLabel('Ask for details if yes').check({ force: true });
  await dialog.getByLabel('Show staff when the answer is yes').check({ force: true });
  await fill('Tick-box wording', 'x'.repeat(2001));
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('over-long tick-box wording is refused', dialog.getByRole('alert').filter({ hasText: 'too long (2,000 characters' }));
  await fill('Tick-box wording', 'I have read the waiver and accept the risk. '.repeat(20).trim());
  c.ok('layout (editor)', (await page.evaluate(layoutProblems)).length === 0);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('saved message', page.getByText(/Waiver saved/));
  const w = state.saved[0];
  c.ok('the right things were sent', w?.p_kind === 'waiver' && w?.p_source === 'text' && w?.p_body_text === 'I accept the risks of training.' && w?.p_file_path === null && w?.p_acceptance_text === 'I have read the waiver and accept the risk. '.repeat(20).trim()
    && JSON.stringify(w?.p_questions) === JSON.stringify([{ prompt: 'Do you have a heart condition?', answer_type: 'yes_no', details_if_yes: true, is_required: true, flag_on_yes: true }]));
  await c.has('the waiver now shows', page.getByText('Version 1, wording typed in, 1 question'));
  await c.has('its question is listed', page.getByText(/Do you have a heart condition\?.*flagged to staff/));

  await page.getByRole('button', { name: 'Set up terms and conditions' }).click();
  await dialog.getByLabel('How do you want to add it?').selectOption('pdf');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('a PDF is required', dialog.getByRole('alert').filter({ hasText: 'Choose a PDF' }));
  await dialog.getByLabel('PDF', { exact: true }).setInputFiles({ name: 'terms.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await c.has('terms saved', page.getByText(/Terms and conditions saved/));
  c.ok('the PDF was uploaded into the gym folder', state.uploaded.length === 1 && state.uploaded[0].includes(`/${GYM}/terms-`));
  const t = state.saved[1];
  c.ok('the PDF details were sent', t?.p_source === 'pdf' && t?.p_file_name === 'terms.pdf' && t?.p_file_path.startsWith(`${GYM}/terms-`) && t?.p_body_text === null);
  await c.has('a link to the PDF', page.getByRole('link', { name: /Open the PDF \(terms\.pdf\)/ }));

  await c.has('who has signed', page.getByText('Jo Penrose', { exact: true }).first());
  await c.has('a parent signing is shown as such', page.getByText(/Sam Penrose \(parent or guardian of Jo Penrose\)/));
  await c.has('the copy is not emailed yet', page.getByText('Signed copy not emailed yet.'));
  await c.has('a flagged yes answer is shown', page.getByText(/Do you have a heart condition\?: yes \(Mild, controlled\)/));
  c.ok('layout (full page)', (await page.evaluate(layoutProblems)).length === 0);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Stop requiring it' }).first().click();
  await c.has('stopping explains what happens', page.getByText(/no longer be asked to sign it/));
  c.ok('the stop was sent', state.removed.length === 1);
  c.ok('no script errors', errors.length === 0);
  if (!c.report(name)) allOk = false;
  await ctx.close();
}
await browser.close();
process.exit(allOk ? 0 : 1);
