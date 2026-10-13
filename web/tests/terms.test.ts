import { describe, expect, it } from 'vitest';
import { noticeText, parseWhole, termText, termWarnings, termsSentence } from '../src/plans/terms';

describe('plan terms in words', () => {
  it('reads months, weeks and days sensibly', () => {
    expect(termText(0)).toBe('No minimum term');
    expect(termText(1)).toBe('1 month');
    expect(termText(12)).toBe('12 months');
    expect(noticeText(0)).toBe('no notice');
    expect(noticeText(1)).toBe('1 day');
    expect(noticeText(7)).toBe('1 week');
    expect(noticeText(14)).toBe('2 weeks');
    expect(noticeText(30)).toBe('1 month');
    expect(noticeText(60)).toBe('2 months');
    expect(noticeText(90)).toBe('3 months');
    expect(noticeText(45)).toBe('45 days');
  });
  it('puts term and notice in one line', () => {
    expect(termsSentence(6, 14)).toBe('6 months minimum · 2 weeks notice to leave');
    expect(termsSentence(0, 0)).toBe('No minimum term · Cancel any time');
    expect(termsSentence(12, null)).toBe('12 months minimum');
    expect(termsSentence(null, 30)).toBe('1 month notice to leave');
    expect(termsSentence(null, null)).toBe('');
    expect(termsSentence(undefined, undefined)).toBe('');
  });
});

describe('warnings never block', () => {
  it('warn above 12 months and above a month, and not at the limits', () => {
    expect(termWarnings(12, 30)).toEqual([]);
    expect(termWarnings(null, null)).toEqual([]);
    expect(termWarnings(13, null)).toHaveLength(1);
    expect(termWarnings(null, 31)).toHaveLength(1);
    expect(termWarnings(24, 90)).toHaveLength(2);
  });
});

describe('parsing', () => {
  it('blank is null, numbers must be whole and in range', () => {
    expect(parseWhole('', 0, 60)).toBeNull();
    expect(parseWhole(' 6 ', 0, 60)).toBe(6);
    expect(parseWhole('0', 0, 60)).toBe(0);
    expect(parseWhole('61', 0, 60)).toBe('bad');
    expect(parseWhole('-2', 0, 60)).toBe('bad');
    expect(parseWhole('2.5', 0, 60)).toBe('bad');
  });
});
