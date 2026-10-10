import type { Json } from '../data/database.types';

// Pure rules for Settings › Sign-up process: preparing a terms or waiver document (an uploaded PDF or typed wording,
// a tick-box sentence and optional questions) for the database, which checks all of it again.

export type DocKind = 'terms' | 'waiver';
export type DocSource = 'pdf' | 'text';
export type AnswerType = 'yes_no' | 'text';

export interface QuestionDraft {
  key: string;
  prompt: string;
  answerType: AnswerType;
  detailsIfYes: boolean;
  required: boolean;
  flagOnYes: boolean;
}

export interface DocDraft {
  title: string;
  source: DocSource;
  body: string;
  file: { name: string; size: number; type: string } | null;
  acceptance: string;
  questions: QuestionDraft[];
}

export const KIND_LABEL: Record<DocKind, string> = { terms: 'Terms and conditions', waiver: 'Waiver' };
export const DEFAULT_ACCEPTANCE = 'I confirm I have read, understood and agree to this document.';
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT = 60000;
export const MAX_QUESTIONS = 40;
export const MAX_ACCEPTANCE = 2000;

export function emptyDraft(kind: DocKind): DocDraft {
  return { title: KIND_LABEL[kind], source: 'text', body: '', file: null, acceptance: DEFAULT_ACCEPTANCE, questions: [] };
}

export function newQuestion(key: string): QuestionDraft {
  return { key, prompt: '', answerType: 'yes_no', detailsIfYes: false, required: true, flagOnYes: false };
}

/** The first thing wrong with a draft, in words for the owner, or null when it can be saved. */
export function checkDraft(d: DocDraft): string | null {
  if (!d.title.trim()) return 'Give the document a title.';
  if (d.title.trim().length > 120) return 'That title is too long (120 characters at most).';
  if (d.source === 'pdf') {
    if (!d.file) return 'Choose a PDF to upload.';
    if (d.file.type !== 'application/pdf' && !d.file.name.toLowerCase().endsWith('.pdf')) return 'The file must be a PDF.';
    if (d.file.size > MAX_PDF_BYTES) return 'That PDF is over 10 MB. Try a smaller file.';
    if (d.file.size === 0) return 'That file is empty.';
  } else {
    if (!d.body.trim()) return 'Type or paste the wording.';
    if (d.body.trim().length > MAX_TEXT) return 'That wording is too long (60,000 characters at most).';
  }
  if (!d.acceptance.trim()) return 'Write the sentence members tick to agree.';
  if (d.acceptance.trim().length > MAX_ACCEPTANCE) return 'The tick-box wording is too long (2,000 characters at most).';
  if (d.questions.length > MAX_QUESTIONS) return `Use ${MAX_QUESTIONS} questions at most.`;
  for (const [i, q] of d.questions.entries()) {
    if (!q.prompt.trim()) return `Question ${i + 1} needs some wording.`;
    if (q.prompt.trim().length > 300) return `Question ${i + 1} is too long (300 characters at most).`;
  }
  return null;
}

/** The questions as the database function wants them. Options that only make sense for yes or no are dropped for written answers. */
export function toRpcQuestions(qs: QuestionDraft[]): Json {
  return qs.map((q) => ({
    prompt: q.prompt.trim(),
    answer_type: q.answerType,
    details_if_yes: q.answerType === 'yes_no' && q.detailsIfYes,
    is_required: q.required,
    flag_on_yes: q.answerType === 'yes_no' && q.flagOnYes,
  }));
}

/** "Version 3, wording typed in, 2 questions". */
export function describeDoc(d: { version: number; source: string }, questionCount: number): string {
  const q = questionCount === 0 ? 'no questions' : questionCount === 1 ? '1 question' : `${questionCount} questions`;
  return `Version ${d.version}, ${d.source === 'pdf' ? 'uploaded PDF' : 'wording typed in'}, ${q}`;
}

/** A path for the uploaded PDF inside the gym's own folder, which is all the storage rules let an owner write to. */
export function pdfPath(gymId: string, kind: DocKind, at: number): string {
  return `${gymId}/${kind}-${at}.pdf`;
}

/** Who a signature is from, in a sentence: the member, or their parent or guardian. */
export function signerLine(s: { signerName: string; isGuardian: boolean }, member: string): string {
  return s.isGuardian ? `${s.signerName} (parent or guardian of ${member})` : s.signerName;
}

/** The sign-up link a gym sends out. */
export function joinLink(origin: string, slug: string): string {
  return `${origin}/next/#/join/${slug}`;
}
