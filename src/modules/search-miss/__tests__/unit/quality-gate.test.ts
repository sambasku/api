import { describe, expect, it } from 'vitest';
import {
  isSearchMissJunkTerm,
  passesSearchMissQualityGate,
  searchMissBlocklistTokens,
} from '../../domain/quality-gate';

describe('isSearchMissJunkTerm', () => {
  it('tolak semuanya angka / non-huruf', () => {
    expect(isSearchMissJunkTerm('42')).toBe(true);
    expect(isSearchMissJunkTerm('12 34')).toBe(true);
    expect(isSearchMissJunkTerm('!!!')).toBe(true);
    expect(isSearchMissJunkTerm('---')).toBe(true);
    expect(isSearchMissJunkTerm('@@@')).toBe(true);
  });

  it('lolos bila ada huruf (termasuk lemma 2 huruf / campur angka)', () => {
    expect(isSearchMissJunkTerm('sa')).toBe(false);
    expect(isSearchMissJunkTerm('kat4')).toBe(false);
    expect(isSearchMissJunkTerm("don't")).toBe(false);
  });
});

describe('passesSearchMissQualityGate', () => {
  it('lolos term huruf biasa', () => {
    expect(passesSearchMissQualityGate('kalintiak')).toBe(true);
    expect(passesSearchMissQualityGate("don't")).toBe(true);
    expect(passesSearchMissQualityGate('makatn-makatn')).toBe(true);
  });

  it('tolak terlalu pendek / tanpa huruf / url / simbol', () => {
    expect(passesSearchMissQualityGate('a')).toBe(false);
    expect(passesSearchMissQualityGate('sa')).toBe(true);
    expect(passesSearchMissQualityGate('42')).toBe(false);
    expect(passesSearchMissQualityGate('!!!')).toBe(false);
    expect(passesSearchMissQualityGate('http://spam.example')).toBe(false);
    expect(passesSearchMissQualityGate('www.spam.example')).toBe(false);
    expect(passesSearchMissQualityGate('hello@world')).toBe(false);
  });
});

describe('searchMissBlocklistTokens', () => {
  it('term utuh + token spasi', () => {
    expect(searchMissBlocklistTokens('kata kotor')).toEqual(
      expect.arrayContaining(['kata kotor', 'kata', 'kotor']),
    );
  });
});
