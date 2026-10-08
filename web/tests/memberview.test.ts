import { describe, expect, it } from 'vitest';
import { DEFAULT_CTA, DEFAULT_LAYOUT, moveTile, normaliseCta, normaliseLayout, setVisible, tileTitle, validateCta } from '../src/memberview/calc';

describe('layout', () => {
  it('defaults to nine visible tiles', () => {
    expect(DEFAULT_LAYOUT).toHaveLength(9);
    expect(DEFAULT_LAYOUT.every((t) => t.visible)).toBe(true);
  });
  it('keeps stored order and visibility, drops unknown and repeated tiles, adds missing ones at the end', () => {
    const l = normaliseLayout([{ key: 'pt', visible: false }, { key: 'nope' }, { key: 'pt', visible: true }, { key: 'goal' }, null, 'x']);
    expect(l.map((t) => t.key).slice(0, 2)).toEqual(['pt', 'goal']);
    expect(l[0]).toEqual({ key: 'pt', visible: false });
    expect(l).toHaveLength(9);
    expect(l.slice(2).every((t) => t.visible)).toBe(true);
  });
  it('treats junk as the default', () => {
    expect(normaliseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normaliseLayout('x')).toEqual(DEFAULT_LAYOUT);
  });
  it('moves a tile up or down and stops at the ends', () => {
    const l = DEFAULT_LAYOUT;
    expect(moveTile(l, 'goal', -1).map((t) => t.key).slice(0, 2)).toEqual(['goal', 'next_classes']);
    expect(moveTile(l, 'goal', 1).map((t) => t.key).slice(1, 3)).toEqual(['progress', 'goal']);
    expect(moveTile(l, 'next_classes', -1)).toBe(l);
    expect(moveTile(l, 'pt', 1)).toBe(l);
    expect(moveTile(l, 'missing', 1)).toBe(l);
  });
  it('shows and hides', () => {
    expect(setVisible(DEFAULT_LAYOUT, 'pt', false).find((t) => t.key === 'pt')?.visible).toBe(false);
    expect(setVisible(DEFAULT_LAYOUT, 'pt', false).filter((t) => t.visible)).toHaveLength(8);
  });
});

describe('promo panel', () => {
  it('uses defaults for anything missing or the wrong type', () => {
    expect(normaliseCta(null)).toEqual(DEFAULT_CTA);
    expect(normaliseCta({ title: 5, enabled: 'yes', body: 'Hi' })).toEqual({ ...DEFAULT_CTA, body: 'Hi' });
    expect(normaliseCta({ enabled: false, title: 'T' })).toMatchObject({ enabled: false, title: 'T' });
  });
  it('accepts the defaults', () => {
    expect(validateCta(DEFAULT_CTA)).toEqual({ ok: true, cta: DEFAULT_CTA });
  });
  it('limits lengths', () => {
    expect(validateCta({ ...DEFAULT_CTA, eyebrow: 'x'.repeat(61) })).toMatchObject({ ok: false });
    expect(validateCta({ ...DEFAULT_CTA, title: 'x'.repeat(121) })).toMatchObject({ ok: false });
    expect(validateCta({ ...DEFAULT_CTA, body: 'x'.repeat(301) })).toMatchObject({ ok: false });
    expect(validateCta({ ...DEFAULT_CTA, secondary_label: 'x'.repeat(41) })).toMatchObject({ ok: false });
  });
  it('external links must be full https addresses', () => {
    const ext = { ...DEFAULT_CTA, primary_target: 'external' };
    expect(validateCta({ ...ext, primary_url: '' })).toMatchObject({ ok: false });
    expect(validateCta({ ...ext, primary_url: 'javascript:alert(1)' })).toMatchObject({ ok: false });
    expect(validateCta({ ...ext, primary_url: 'http://example.com' })).toMatchObject({ ok: false });
    expect(validateCta({ ...ext, primary_url: 'example.com' })).toMatchObject({ ok: false });
    expect(validateCta({ ...ext, primary_url: ' https://example.com/join ' })).toMatchObject({ ok: true, cta: { primary_url: 'https://example.com/join' } });
    expect(validateCta({ ...DEFAULT_CTA, secondary_target: 'external', secondary_url: 'ftp://x.co' })).toMatchObject({ ok: false });
  });
  it('clears a stale link when the destination is not external', () => {
    const c = validateCta({ ...DEFAULT_CTA, primary_target: 'classes', primary_url: 'https://old.example' });
    expect(c.ok && c.cta.primary_url).toBe('');
  });
  it('previews the hub tile with the gym headline', () => {
    expect(tileTitle('hero', { ...DEFAULT_CTA, title: ' Join now ' })).toBe('Join now');
    expect(tileTitle('hero', { ...DEFAULT_CTA, title: ' ' })).toBe('Training hub');
    expect(tileTitle('pt', DEFAULT_CTA)).toBe('PT appointments');
  });
});
