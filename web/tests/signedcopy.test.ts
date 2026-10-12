import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { joinPdfs, signedPaths } from '../src/members/signedCopy';

const pdf = async (pages: number) => {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage();
  return d.save();
};

describe('the stored signed copy', () => {
  it('lists the terms copy then the waiver copy, and only those that exist', () => {
    expect(signedPaths({ termsPath: 'a/terms.pdf', waiverPath: 'a/waiver.pdf' })).toEqual(['a/terms.pdf', 'a/waiver.pdf']);
    expect(signedPaths({ termsPath: null, waiverPath: 'a/waiver.pdf' })).toEqual(['a/waiver.pdf']);
    expect(signedPaths({ termsPath: null, waiverPath: null })).toEqual([]);
  });

  it('hands back a single stored copy exactly as it was, byte for byte', async () => {
    const one = await pdf(2);
    expect(await joinPdfs([one])).toBe(one);
  });

  it('puts two stored copies in one file, every page in order', async () => {
    const joined = await PDFDocument.load(await joinPdfs([await pdf(2), await pdf(3)]));
    expect(joined.getPageCount()).toBe(5);
  });
});
