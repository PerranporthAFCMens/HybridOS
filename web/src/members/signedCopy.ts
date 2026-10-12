import { signedCopyUrl, type Agreement } from '../data/signup';

/** The signed copies made at the moment of signing, in the order terms then waiver. These are the original record; they are never rebuilt here. */
export function signedPaths(a: Pick<Agreement, 'termsPath' | 'waiverPath'>): string[] {
  return [a.termsPath, a.waiverPath].filter((x): x is string => !!x);
}

/** Puts the stored copies one after another in a single PDF, page for page as they were made. One copy is returned untouched. */
export async function joinPdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const [only] = files;
  if (files.length === 1 && only) return only;
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const f of files) {
    const doc = await PDFDocument.load(f);
    for (const page of await out.copyPages(doc, doc.getPageIndices())) out.addPage(page);
  }
  return out.save();
}

/** Fetches this signing's stored signed copies and returns them as one PDF. */
export async function fetchSignedCopy(a: Pick<Agreement, 'termsPath' | 'waiverPath'>): Promise<Blob> {
  const paths = signedPaths(a);
  if (!paths.length) throw new Error('No signed copy has been made for this signing yet.');
  const files = await Promise.all(paths.map(async (path) => {
    const res = await fetch(await signedCopyUrl(path));
    if (!res.ok) throw new Error('Could not fetch the signed copy.');
    return new Uint8Array(await res.arrayBuffer());
  }));
  const bytes = await joinPdfs(files);
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}
