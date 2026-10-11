import type { Agreement } from '../data/signup';
import type { MemberDetails } from '../data/memberDetails';
import { fullStamp } from '../signup/calc';
import { addressText, dobText, emergencyText, formatDate, formatRegistered, phoneText } from './calc';

// The member's file as a PDF. Built when someone asks for it, from what is on screen, so it can never be out of date and it
// shows only what that person is allowed to see (a mobile number or address the owner hid from the team stays hidden).
// It is a copy: the signed copy made at the moment of signing, and kept with the record, is the original.

export interface FilePdfMembership { plan: string; price: string; status: string; startsOn: string; endsOn: string }
export interface FilePdfInput {
  gymName: string; generatedAt: Date; name: string; role: string; status: string; joinedAt: string;
  memberships: FilePdfMembership[]; details: MemberDetails; agreements: Agreement[];
}

export type Block =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'row'; label: string; value: string }
  | { kind: 'text'; text: string; muted?: boolean }
  | { kind: 'image'; dataUrl: string; alt: string };

const HIDDEN = 'Hidden by the owner';
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** What goes in the PDF, in order, as plain blocks (so it can be tested without drawing anything). */
export function fileBlocks(i: FilePdfInput): Block[] {
  const d = i.details;
  const b: Block[] = [
    { kind: 'title', text: 'Member file' },
    { kind: 'subtitle', text: `${i.gymName} · made ${fullStamp(i.generatedAt.toISOString())}` },
    { kind: 'h2', text: i.name },
    { kind: 'row', label: 'Role', value: i.role },
    { kind: 'row', label: 'Membership', value: cap(i.status) },
    { kind: 'row', label: 'Member since', value: formatRegistered(i.joinedAt) },
    { kind: 'h2', text: 'Personal details' },
    { kind: 'row', label: 'Date of birth', value: dobText(d.dateOfBirth, i.generatedAt) },
    { kind: 'row', label: 'Mobile', value: d.phoneHidden ? HIDDEN : phoneText(d.phone) },
    { kind: 'row', label: 'Address', value: d.addressHidden ? HIDDEN : addressText(d.address) },
    { kind: 'row', label: 'Emergency contact', value: emergencyText(d.emergency) },
  ];
  if (d.guardian) b.push({ kind: 'row', label: 'Parent or guardian', value: `${d.guardian.name}, ${phoneText(d.guardian.phone)}` });
  b.push({ kind: 'h2', text: 'Membership' });
  if (!i.memberships.length) b.push({ kind: 'text', text: 'No membership assigned yet.', muted: true });
  for (const m of i.memberships) {
    b.push({ kind: 'row', label: m.plan || 'Membership', value: `${m.price} · ${cap(m.status)} · from ${formatDate(m.startsOn)}${m.endsOn ? ` to ${formatDate(m.endsOn)}` : ''}` });
  }
  b.push({ kind: 'h2', text: 'Signed agreements' });
  if (!i.agreements.length) b.push({ kind: 'text', text: 'Nothing signed yet.', muted: true });
  for (const a of i.agreements) {
    b.push({ kind: 'h3', text: fullStamp(a.signedAt) });
    b.push({ kind: 'text', text: `Signed by ${a.isGuardian ? `${a.signerName} (parent or guardian of ${i.name})` : a.signerName}`, muted: true });
    for (const doc of a.docs) {
      b.push({ kind: 'text', text: `${doc.title} (version ${doc.version})` });
      b.push({ kind: 'text', text: `Agreed: ${doc.acceptance}`, muted: true });
      for (const x of doc.answers) b.push({ kind: 'text', text: `${x.prompt} ${x.answer || 'No answer'}`, muted: true });
    }
    if (a.image) b.push({ kind: 'image', dataUrl: a.image, alt: `Signature of ${a.signerName}` });
    b.push({ kind: 'text', text: a.emailedAt ? `A signed copy was emailed ${fullStamp(a.emailedAt)}.` : a.emailError ? `The signed copy was not emailed: ${a.emailError}` : 'A signed copy has not been emailed.', muted: true });
  }
  b.push({ kind: 'text', text: 'This is a copy made from the member file on the date above. The signed copy made at the moment of signing is the original record.', muted: true });
  return b;
}

/** Draws the blocks on A4 pages and returns the PDF's bytes. jsPDF is loaded only when this is called. */
export async function renderFilePdf(blocks: Block[]): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 16;
  const W = 210 - M * 2;
  let y = M;
  const room = (h: number) => {
    if (y + h > 297 - M) { doc.addPage(); y = M; }
  };
  const lines = (text: string, size: number, width = W, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.splitTextToSize(text, width) as string[];
  };
  for (const blk of blocks) {
    if (blk.kind === 'title') { room(12); doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(blk.text, M, y + 6); y += 11; }
    else if (blk.kind === 'subtitle') { doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(lines(blk.text, 9), M, y + 3); y += 9; }
    else if (blk.kind === 'h2') { room(14); y += 4; doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(blk.text, M, y + 4); doc.setDrawColor(200, 200, 200); doc.line(M, y + 6, M + W, y + 6); y += 10; }
    else if (blk.kind === 'h3') { room(10); y += 2; doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(blk.text, M, y + 4); y += 7; }
    else if (blk.kind === 'row') {
      const v = lines(blk.value, 10, W - 46);
      room(v.length * 5 + 1);
      doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(blk.label, M, y + 4);
      doc.setTextColor(20); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(v, M + 46, y + 4);
      y += v.length * 5 + 1;
    } else if (blk.kind === 'text') {
      const t = lines(blk.text, 9.5);
      room(t.length * 4.6 + 1);
      doc.setTextColor(blk.muted ? 90 : 20); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(t, M, y + 4);
      y += t.length * 4.6 + 1;
    } else {
      try {
        const p = doc.getImageProperties(blk.dataUrl);
        const w = Math.min(60, W);
        const h = Math.min(24, (w * p.height) / p.width);
        room(h + 3);
        doc.setFillColor(255, 255, 255); doc.setDrawColor(200, 200, 200); doc.rect(M, y, w, h, 'FD');
        doc.addImage(blk.dataUrl, 'PNG', M, y, w, h);
        y += h + 3;
      } catch {
        room(6);
        doc.setTextColor(90); doc.setFontSize(9.5); doc.text('(The signature picture could not be drawn.)', M, y + 4);
        y += 6;
      }
    }
  }
  return doc.output('arraybuffer');
}

export async function memberFilePdf(i: FilePdfInput): Promise<Blob> {
  return new Blob([await renderFilePdf(fileBlocks(i))], { type: 'application/pdf' });
}
