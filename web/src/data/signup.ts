import { supabase } from './client';
import type { DocKind, DocSource } from '../signup/calc';
import { pdfPath } from '../signup/calc';
import type { Json } from './database.types';

export interface SignupQuestion { id: string; position: number; prompt: string; answerType: string; detailsIfYes: boolean; required: boolean; flagOnYes: boolean }
export interface SignupDoc {
  id: string; kind: DocKind; version: number; title: string; source: DocSource; fileName: string | null; filePath: string | null; fileSize: number | null;
  body: string | null; acceptance: string; isCurrent: boolean; uploadedAt: string; questions: SignupQuestion[];
}
export interface SignatureRow {
  id: string; userId: string; name: string; signerName: string; isGuardian: boolean; signedAt: string;
  termsVersion: number | null; waiverVersion: number | null; termsPath: string | null; waiverPath: string | null; emailedAt: string | null; emailError: string | null;
}
export interface FlaggedAnswer { signatureId: string; member: string; prompt: string; details: string; signedAt: string }

const asKind = (v: string): DocKind => (v === 'waiver' ? 'waiver' : 'terms');

/** Every version of the gym's documents, newest first, each with its questions. */
export async function listDocuments(gymId: string): Promise<SignupDoc[]> {
  const d = await supabase.from('gym_signup_documents').select('*').eq('gym_id', gymId).order('uploaded_at', { ascending: false });
  if (d.error) throw new Error(d.error.message);
  const ids = (d.data ?? []).map((r) => r.id);
  const q = ids.length ? await supabase.from('gym_signup_questions').select('*').in('document_id', ids).order('position') : { data: [], error: null };
  if (q.error) throw new Error(q.error.message);
  return (d.data ?? []).map((r) => ({
    id: r.id, kind: asKind(r.kind), version: r.version, title: r.title, source: r.source === 'pdf' ? 'pdf' : 'text', fileName: r.file_name, filePath: r.file_path, fileSize: r.file_size,
    body: r.body_text, acceptance: r.acceptance_text, isCurrent: r.is_current, uploadedAt: r.uploaded_at,
    questions: (q.data ?? []).filter((x) => x.document_id === r.id).map((x) => ({
      id: x.id, position: x.position, prompt: x.prompt, answerType: x.answer_type, detailsIfYes: x.details_if_yes, required: x.is_required, flagOnYes: x.flag_on_yes,
    })),
  }));
}

export async function gymSlug(gymId: string): Promise<string> {
  const { data, error } = await supabase.from('gyms').select('slug').eq('id', gymId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.slug ?? '';
}

export async function uploadPdf(gymId: string, kind: DocKind, file: File): Promise<string> {
  const path = pdfPath(gymId, kind, Date.now());
  const up = await supabase.storage.from('gym-signup-documents').upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (up.error) throw new Error(up.error.message);
  return path;
}

export const publicPdfUrl = (path: string): string => supabase.storage.from('gym-signup-documents').getPublicUrl(path).data.publicUrl;

export async function saveDocument(a: {
  gymId: string; kind: DocKind; title: string; source: DocSource; filePath: string | null; fileName: string | null; fileSize: number | null;
  body: string | null; acceptance: string; questions: Json;
}): Promise<void> {
  const { error } = await supabase.rpc('add_gym_signup_document', {
    p_gym_id: a.gymId, p_kind: a.kind, p_title: a.title.trim(), p_source: a.source, p_file_path: a.filePath, p_file_name: a.fileName,
    p_file_size: a.fileSize, p_body_text: a.body, p_acceptance_text: a.acceptance.trim(), p_questions: a.questions,
  });
  if (error) throw new Error(error.message);
}

export async function removeDocument(gymId: string, kind: DocKind): Promise<void> {
  const { error } = await supabase.rpc('remove_gym_signup_document', { p_gym_id: gymId, p_kind: kind });
  if (error) throw new Error(error.message);
}

/** Who has signed, newest first, with the version of each document they signed. */
export async function listSignatures(gymId: string, limit = 100): Promise<SignatureRow[]> {
  const s = await supabase.from('member_signatures').select('*').eq('gym_id', gymId).order('signed_at', { ascending: false }).limit(limit);
  if (s.error) throw new Error(s.error.message);
  const rows = s.data ?? [];
  const users = [...new Set(rows.map((r) => r.user_id))];
  const docIds = [...new Set(rows.flatMap((r) => [r.terms_document_id, r.waiver_document_id]).filter((x): x is string => !!x))];
  const [p, d] = await Promise.all([
    users.length ? supabase.from('profiles').select('id, display_name, first_name, last_name').in('id', users) : Promise.resolve({ data: [], error: null }),
    docIds.length ? supabase.from('gym_signup_documents').select('id, version').in('id', docIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (p.error) throw new Error(p.error.message);
  if (d.error) throw new Error(d.error.message);
  const nameOf = new Map((p.data ?? []).map((x) => [x.id, x.display_name || [x.first_name, x.last_name].filter(Boolean).join(' ') || 'Member']));
  const version = new Map((d.data ?? []).map((x) => [x.id, x.version]));
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, name: nameOf.get(r.user_id) ?? 'Member', signerName: r.signer_name, isGuardian: r.signer_is_guardian, signedAt: r.signed_at,
    termsVersion: r.terms_document_id ? version.get(r.terms_document_id) ?? null : null, waiverVersion: r.waiver_document_id ? version.get(r.waiver_document_id) ?? null : null,
    termsPath: r.signed_terms_path, waiverPath: r.signed_waiver_path, emailedAt: r.emailed_at, emailError: r.email_error,
  }));
}

/** Questions answered "yes" that the gym asked to be shown (for example a heart condition). */
export async function listFlagged(gymId: string, sigs: SignatureRow[]): Promise<FlaggedAnswer[]> {
  if (!sigs.length) return [];
  const a = await supabase.from('member_signature_answers').select('*').in('signature_id', sigs.map((s) => s.id)).eq('answer_yes', true);
  if (a.error) throw new Error(a.error.message);
  const qIds = [...new Set((a.data ?? []).map((x) => x.question_id))];
  if (!qIds.length) return [];
  const q = await supabase.from('gym_signup_questions').select('id, prompt, flag_on_yes').in('id', qIds).eq('flag_on_yes', true);
  if (q.error) throw new Error(q.error.message);
  const prompt = new Map((q.data ?? []).map((x) => [x.id, x.prompt]));
  const sig = new Map(sigs.map((s) => [s.id, s]));
  void gymId;
  return (a.data ?? [])
    .filter((x) => prompt.has(x.question_id))
    .map((x) => ({ signatureId: x.signature_id, member: sig.get(x.signature_id)?.name ?? 'Member', prompt: prompt.get(x.question_id) ?? '', details: x.answer_text ?? '', signedAt: sig.get(x.signature_id)?.signedAt ?? '' }));
}

/** A short-lived link to a signed copy. Only the member and the gym's owner, admin and staff are allowed one. */
export async function signedCopyUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('signed-documents').createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export interface MissingDetails { userId: string; name: string; missing: string[] }

/** Members who lack something the gym requires (details, emergency contact, a signature). For owners, admins and staff only. */
export async function listMissingDetails(gymId: string): Promise<MissingDetails[]> {
  const { data, error } = await supabase.rpc('get_members_missing_details', { p_gym_id: gymId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ userId: r.user_id, name: r.member_name, missing: r.missing }));
}
