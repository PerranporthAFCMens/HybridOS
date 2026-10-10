import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCEPTANCE, checkDraft, describeDoc, emptyDraft, joinLink, newQuestion, pdfPath, signerLine, toRpcQuestions, type DocDraft } from '../src/signup/calc';

const text = (over: Partial<DocDraft> = {}): DocDraft => ({ ...emptyDraft('waiver'), body: 'I accept the risks.', ...over });
const pdf = (over: Partial<DocDraft> = {}): DocDraft => ({ ...emptyDraft('terms'), source: 'pdf', file: { name: 'terms.pdf', size: 1000, type: 'application/pdf' }, ...over });

describe('a document draft', () => {
  it('starts with a title and the default tick-box sentence', () => {
    const d = emptyDraft('waiver');
    expect(d.title).toBe('Waiver');
    expect(d.acceptance).toBe(DEFAULT_ACCEPTANCE);
  });
  it('typed wording needs some words', () => {
    expect(checkDraft(text({ body: '   ' }))).toBe('Type or paste the wording.');
    expect(checkDraft(text())).toBeNull();
    expect(checkDraft(text({ body: 'x'.repeat(60001) }))).toMatch(/too long/);
  });
  it('a PDF must be chosen, be a PDF, and be under 10 MB', () => {
    expect(checkDraft(pdf({ file: null }))).toBe('Choose a PDF to upload.');
    expect(checkDraft(pdf({ file: { name: 'a.docx', size: 10, type: 'application/msword' } }))).toBe('The file must be a PDF.');
    expect(checkDraft(pdf({ file: { name: 'a.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' } }))).toMatch(/over 10 MB/);
    expect(checkDraft(pdf({ file: { name: 'a.pdf', size: 0, type: 'application/pdf' } }))).toBe('That file is empty.');
    expect(checkDraft(pdf())).toBeNull();
  });
  it('a phone that labels a PDF with no type is still accepted by its name', () => {
    expect(checkDraft(pdf({ file: { name: 'Terms.PDF', size: 10, type: '' } }))).toBeNull();
  });
  it('title and tick-box sentence are needed and limited', () => {
    expect(checkDraft(text({ title: ' ' }))).toBe('Give the document a title.');
    expect(checkDraft(text({ title: 'x'.repeat(121) }))).toMatch(/too long/);
    expect(checkDraft(text({ acceptance: '' }))).toMatch(/tick/);
    expect(checkDraft(text({ acceptance: 'x'.repeat(301) }))).toMatch(/300/);
  });
  it('every question needs wording, and there is a limit', () => {
    expect(checkDraft(text({ questions: [{ ...newQuestion('a'), prompt: 'Heart condition?' }, newQuestion('b')] }))).toBe('Question 2 needs some wording.');
    expect(checkDraft(text({ questions: Array.from({ length: 41 }, (_, i) => ({ ...newQuestion(`k${i}`), prompt: 'q' })) }))).toMatch(/40 questions/);
  });
});

describe('questions sent to the database', () => {
  it('options that only fit yes or no are dropped for written answers', () => {
    const out = toRpcQuestions([
      { key: 'a', prompt: ' Heart condition? ', answerType: 'yes_no', detailsIfYes: true, required: true, flagOnYes: true },
      { key: 'b', prompt: 'Injuries?', answerType: 'text', detailsIfYes: true, required: false, flagOnYes: true },
    ]);
    expect(out).toEqual([
      { prompt: 'Heart condition?', answer_type: 'yes_no', details_if_yes: true, is_required: true, flag_on_yes: true },
      { prompt: 'Injuries?', answer_type: 'text', details_if_yes: false, is_required: false, flag_on_yes: false },
    ]);
  });
});

describe('words and paths', () => {
  it('describes a document', () => {
    expect(describeDoc({ version: 3, source: 'text' }, 0)).toBe('Version 3, wording typed in, no questions');
    expect(describeDoc({ version: 1, source: 'pdf' }, 1)).toBe('Version 1, uploaded PDF, 1 question');
    expect(describeDoc({ version: 2, source: 'pdf' }, 5)).toBe('Version 2, uploaded PDF, 5 questions');
  });
  it('a PDF goes in the gym\'s own folder', () => {
    expect(pdfPath('gym-1', 'waiver', 99)).toBe('gym-1/waiver-99.pdf');
  });
  it('names a guardian signer', () => {
    expect(signerLine({ signerName: 'Sam Penrose', isGuardian: false }, 'Sam Penrose')).toBe('Sam Penrose');
    expect(signerLine({ signerName: 'Sam Penrose', isGuardian: true }, 'Jo Penrose')).toBe('Sam Penrose (parent or guardian of Jo Penrose)');
  });
  it('builds the sign-up link', () => {
    expect(joinLink('https://hybridone.co.uk', 'puffin')).toBe('https://hybridone.co.uk/join/puffin');
  });
});
