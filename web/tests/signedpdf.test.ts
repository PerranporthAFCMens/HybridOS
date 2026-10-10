import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { buildSignedPdf, safeText, wrapLines, type SignedDoc, type SignedMeta } from '../../supabase/functions/finalise-signature/index';

// A real 2x2 PNG, so the signature can be embedded.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4EIwMTAMMwVAAC8CQQCfgCmrQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

const meta: SignedMeta = {
  signatureId: 'sig-1', gymName: 'Puffin Performance', memberName: 'Jo Penrose', signerName: 'Sam Penrose', signerIsGuardian: true,
  signedAt: new Date('2026-10-10T09:30:00Z'), signaturePng: PNG,
};
const typed: SignedDoc = {
  kind: 'waiver', title: 'Waiver', version: 3, source: 'text', body: 'I accept the risks of training.\n\nSecond paragraph.', pdfBytes: null,
  acceptance: 'I have read the waiver and accept the risk.', qa: [{ prompt: 'Do you have a heart condition?', answer: 'Yes - Mild, controlled' }],
};

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('text helpers', () => {
  it('replaces what the font cannot draw and keeps the rest', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(safeText(font, 'Price £5 – “quoted”')).toBe('Price £5 – “quoted”');
    expect(safeText(font, 'Hello 日本 😀')).toBe('Hello ?? ?');
  });
  it('wraps to the width and breaks a word that is too long', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapLines(font, 'one two three four five six seven eight nine ten', 11, 80);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.every((l) => font.widthOfTextAtSize(l, 11) <= 80)).toBe(true);
    const long = wrapLines(font, 'x'.repeat(200), 11, 100);
    expect(long.length).toBeGreaterThan(1);
    expect(long.every((l) => font.widthOfTextAtSize(l, 11) <= 100)).toBe(true);
    expect(wrapLines(font, 'a\n\nb', 11, 100)).toEqual(['a', '', 'b']);
  });
});

describe('signed copies', () => {
  it('typed wording becomes a document with a signature page', async () => {
    const bytes = await buildSignedPdf(typed, meta);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(await pages(bytes)).toBe(2);
  });
  it('a long typed document runs over several pages before the signature page', async () => {
    const long = { ...typed, body: Array.from({ length: 160 }, (_, i) => `Clause ${i + 1}. The member agrees to follow the rules of the gym at all times.`).join('\n') };
    expect(await pages(await buildSignedPdf(long, meta))).toBeGreaterThan(3);
  });
  it('an uploaded PDF keeps its own pages and gets one signature page added', async () => {
    const src = await PDFDocument.create();
    src.addPage();
    src.addPage();
    const bytes = await buildSignedPdf({ ...typed, kind: 'terms', source: 'pdf', body: null, pdfBytes: await src.save() }, meta);
    expect(await pages(bytes)).toBe(3);
  });
  it('questions, odd characters and a member signing for themselves do not break it', async () => {
    const bytes = await buildSignedPdf(
      { ...typed, title: 'Waiver 日本', qa: Array.from({ length: 30 }, (_, i) => ({ prompt: `Question ${i + 1} 😀?`, answer: i % 2 ? 'No' : 'Yes - details '.repeat(10) })) },
      { ...meta, signerIsGuardian: false, signerName: 'Jo Penrose' },
    );
    expect(await pages(bytes)).toBeGreaterThanOrEqual(2);
  });
});
