import { describe, expect, it } from 'vitest';
import { meaningVotePreview } from '../../infrastructure/vote.repository.impl';

describe('meaningVotePreview', () => {
  it('definisi placeholder memakai lemma dan padanan', () => {
    expect(meaningVotePreview('kalintiak', '-', 'makan')).toBe('kalintiak · makan');
  });

  it('tanpa definisi dan tanpa padanan tetap lemma', () => {
    expect(meaningVotePreview('kalintiak', '-', null)).toBe('kalintiak');
    expect(meaningVotePreview('kalintiak', '  ', '-')).toBe('kalintiak');
  });

  it('definisi sungguhan menang atas padanan', () => {
    expect(meaningVotePreview('kata dimoderasi', 'Kata untuk moderasi vote', 'kata moderasi')).toBe(
      'kata dimoderasi · Kata untuk moderasi vote',
    );
  });
});
