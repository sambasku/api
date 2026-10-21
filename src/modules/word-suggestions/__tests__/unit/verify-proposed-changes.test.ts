import { describe, expect, it } from 'vitest';
import { verifyProposedChanges } from '@/modules/word-suggestions/application/utils/verify-proposed-changes';

describe('verifyProposedChanges', () => {
  it('menerima hanya lemma', () => {
    const r = verifyProposedChanges({ lemma: "kete'" });
    expect(r.valid).toBe(true);
  });

  it('menerima hanya jenis entri', () => {
    const r = verifyProposedChanges({ wordType: 'ungkapan' });
    expect(r.valid).toBe(true);
  });

  it('menerima hanya update makna', () => {
    const r = verifyProposedChanges({
      meanings: [
        {
          meaningId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          action: 'update',
          definition: 'Definisi baru',
        },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('menolak body kosong', () => {
    const r = verifyProposedChanges({});
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.field).toBe('proposed_changes');
  });

  it('menolak add tanpa translation bila definisi kosong', () => {
    const r = verifyProposedChanges({
      meanings: [{ action: 'add', definition: '' }],
    });
    expect(r.valid).toBe(false);
  });

  it('menerima add tanpa translation jika definisi nyata', () => {
    const r = verifyProposedChanges({
      meanings: [{ action: 'add', definition: 'uraian tanpa padanan' }],
    });
    expect(r.valid).toBe(true);
  });

  it('menerima hanya relations add', () => {
    const r = verifyProposedChanges({
      relations: [
        {
          action: 'add',
          relationType: 'synonym',
          wordId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('menerima relations add dengan lemma target (kata baru)', () => {
    const r = verifyProposedChanges({
      relations: [{ action: 'add', relationType: 'derived_from', lemma: 'anak akar' }],
    });
    expect(r.valid).toBe(true);
  });

  it('menolak relation add tanpa word_id dan tanpa lemma', () => {
    const r = verifyProposedChanges({
      relations: [{ action: 'add', relationType: 'synonym' }],
    });
    expect(r.valid).toBe(false);
  });

  it('menolak relation add yang mengisi word_id dan lemma sekaligus', () => {
    const r = verifyProposedChanges({
      relations: [
        {
          action: 'add',
          relationType: 'synonym',
          wordId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          lemma: 'kata lain',
        },
      ],
    });
    expect(r.valid).toBe(false);
  });

  it('menolak lebih dari 3 lemma baru dalam satu usulan', () => {
    const r = verifyProposedChanges({
      relations: ['a', 'b', 'c', 'd'].map((lemma) => ({
        action: 'add' as const,
        relationType: 'derived_from' as const,
        lemma,
      })),
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.includes('Maksimal 3 lemma baru'))).toBe(true);
  });

  it('menerima kelompok baru dengan anggota lemma', () => {
    const r = verifyProposedChanges({
      groups: [{ action: 'add', name: 'Kelompok uji', lemmas: ['kata baru'] }],
    });
    expect(r.valid).toBe(true);
  });

  it('menolak action=remove kelompok yang menyertakan anggota', () => {
    const r = verifyProposedChanges({
      groups: [
        {
          action: 'remove',
          groupId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          lemmas: ['kata lain'],
        },
      ],
    });
    expect(r.valid).toBe(false);
  });

  it('menerima variants dan images', () => {
    const r = verifyProposedChanges({
      variants: [{ action: 'add', form: 'ketex', variantType: 'alternative' }],
      images: [
        {
          action: 'add',
          url: 'https://example.com/a.jpg',
          providerFileId: 'file_1',
          isPrimary: true,
        },
      ],
    });
    expect(r.valid).toBe(true);
  });
});
