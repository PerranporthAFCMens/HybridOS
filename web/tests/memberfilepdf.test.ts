import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fileBlocks, renderFilePdf, type FilePdfInput } from '../src/members/filePdf';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4EIwMTAMMwVAAC8CQQCfgCmrQAAAABJRU5ErkJggg==';

const input = (over: Partial<FilePdfInput> = {}): FilePdfInput => ({
  gymName: 'Puffin Performance', generatedAt: new Date('2026-10-12T09:00:00Z'), name: 'Adam Turner', role: 'Member', status: 'Active', joinedAt: '2026-03-01T00:00:00',
  memberships: [{ plan: 'Hybrid Gold', price: '£59.00 / monthly', status: 'Active', startsOn: '2026-03-01', endsOn: '' }],
  details: { dateOfBirth: '2001-03-14', phoneHidden: false, addressHidden: false, phone: '+447700900123', hasDetails: true, address: { line1: '12 High Street', line2: null, town: 'Truro', postcode: 'TR1 2AB' }, emergency: { name: 'Jo Turner', phone: '+447700900456', relationship: 'Mother' }, guardian: null, signed: [] },
  agreements: [{
    id: 's1', signedAt: '2026-10-11T15:29:19Z', signerName: 'John Smith', isGuardian: false, image: PNG, emailedAt: '2026-10-11T21:17:47Z', emailError: null,
    docs: [{ kind: 'waiver', title: 'Waiver', version: 1, source: 'text', acceptance: 'I have read the waiver.', answers: [{ prompt: 'Do you have a heart condition?', answer: 'No' }] }],
  }],
  ...over,
});
const first = (i: FilePdfInput) => i.agreements[0] as FilePdfInput['agreements'][number];
const texts = (i: FilePdfInput) => fileBlocks(i).flatMap((b) => ('text' in b ? [b.text] : 'value' in b ? [`${b.label}: ${b.value}`] : []));

describe('member file PDF contents', () => {
  it('has the details, membership and the signed agreement with its exact time, answers and signature', () => {
    const t = texts(input());
    expect(t).toContain('Member file');
    expect(t).toContain('Mobile: 07700 900123');
    expect(t).toContain('Address: 12 High Street, Truro, TR1 2AB');
    expect(t).toContain('Emergency contact: Jo Turner (Mother), 07700 900456');
    expect(t).toContain('Member since: 1 Mar 2026');
    expect(t.some((x) => x.startsWith('Hybrid Gold:') && x.includes('£59.00 / monthly'))).toBe(true);
    expect(t).toContain('Sunday 11 October 2026 at 16:29:19 BST');
    expect(t).toContain('Signed by John Smith');
    expect(t).toContain('Agreed: I have read the waiver.');
    expect(t).toContain('Do you have a heart condition? No');
    expect(fileBlocks(input()).some((b) => b.kind === 'image')).toBe(true);
  });

  it('leaves out a mobile number and address the owner has hidden from the team', () => {
    const t = texts(input({ details: { ...input().details, phoneHidden: true, addressHidden: true, phone: null, address: null } })).join('\n');
    expect(t).toContain('Mobile: Hidden by the owner');
    expect(t).toContain('Address: Hidden by the owner');
    expect(t).not.toContain('07700 900123');
    expect(t).not.toContain('High Street');
  });

  it('says so when nothing is signed or no membership exists, and names a parent who signed', () => {
    const t = texts(input({ memberships: [], agreements: [] }));
    expect(t).toContain('No membership assigned yet.');
    expect(t).toContain('Nothing signed yet.');
    const g = texts(input({ agreements: [{ ...first(input()), signerName: 'Dad Turner', isGuardian: true }] }));
    expect(g).toContain('Signed by Dad Turner (parent or guardian of Adam Turner)');
  });

  it('draws a real PDF, with a signature and a long list that runs over more than one page', async () => {
    const one = await renderFilePdf(fileBlocks(input()));
    expect(new TextDecoder().decode(new Uint8Array(one).slice(0, 5))).toBe('%PDF-');
    const many = Array.from({ length: 25 }, (_, n) => ({ ...first(input()), id: `s${n}` }));
    const long = await PDFDocument.load(await renderFilePdf(fileBlocks(input({ agreements: many }))));
    expect(long.getPageCount()).toBeGreaterThan(1);
  });
});
