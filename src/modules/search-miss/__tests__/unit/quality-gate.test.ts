import { describe, expect, it } from 'vitest';
import {
  passesSearchMissQualityGate,
  searchMissBlocklistTokens,
} from '../../domain/quality-gate';

describe('passesSearchMissQualityGate', () => {
  it('lolos term huruf biasa', () => {
    expect(passesSearchMissQualityGate('kalintiak')).toBe(true);
    expect(passesSearchMissQualityGate("don't")).toBe(true);
    expect(passesSearchMissQualityGate('makatn-makatn')).toBe(true);
  });

  it('tolak terlalu pendek / tanpa huruf / url / simbol', () => {
    expect(passesSearchMissQualityGate('a')).toBe(false);
    expect(passesSearchMissQualityGate('sa')).toBe(false);
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
