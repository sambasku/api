import { describe, expect, it } from 'vitest';
import {
  checkSuggestionCategoryShape,
  isRevertibleForApplyPending,
} from '../../application/utils/suggestion-category-shape';
import { censorSuggestionText } from '../../application/utils/suggestion-blocklist';
import { createSuggestionSchema } from '../../presentation/v1/validators/suggestion.validator';

const MEANING = '01HZZZZZZZZZZZZZZZZZZZZZZZ';

describe('checkSuggestionCategoryShape', () => {
  it('add_photo menolak lemma', () => {
    const issues = checkSuggestionCategoryShape('add_photo', {
      lemma: 'baru',
      images: [{ action: 'add', url: 'https://x/y.jpg', providerFileId: 'f1' }],
    });
    expect(issues.map((i) => i.field)).toContain('lemma');
  });

  it('change_meaning menolak foto dan kelas kata', () => {
    const issues = checkSuggestionCategoryShape('change_meaning', {
      meanings: [{ action: 'update', meaningId: MEANING, definition: 'x', wordClassId: 'wc' }],
      images: [{ action: 'remove', imageId: 'img' }],
    });
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('images');
    expect(fields).toContain('meanings.word_class_id');
  });

  it('change_word_class menolak definisi', () => {
    const issues = checkSuggestionCategoryShape('change_word_class', {
      meanings: [{ action: 'update', meaningId: MEANING, wordClassId: 'wc', definition: 'x' }],
    });
    expect(issues).toHaveLength(1);
  });

  it('synonym menolak antonim', () => {
    const issues = checkSuggestionCategoryShape('synonym', {
      relations: [{ action: 'add', relationType: 'antonym', wordId: 'w' }],
    });
    expect(issues).toHaveLength(1);
  });

  it('kode lama tidak dicek', () => {
    expect(
      checkSuggestionCategoryShape('typo', {
        lemma: 'x',
        images: [{ action: 'remove', imageId: 'img' }],
      }),
    ).toEqual([]);
  });

  it('kategori valid lolos', () => {
    expect(
      checkSuggestionCategoryShape('change_photo', {
        images: [
          { action: 'remove', imageId: 'img' },
          { action: 'add', url: 'https://x/y.jpg', providerFileId: 'f1' },
        ],
      }),
    ).toEqual([]);
  });
});

describe('isRevertibleForApplyPending', () => {
  it('teks dan foto baru boleh langsung tayang', () => {
    expect(
      isRevertibleForApplyPending({
        lemma: 'x',
        meanings: [{ action: 'update', meaningId: MEANING, definition: 'y' }],
        images: [{ action: 'add', url: 'https://x/y.jpg', providerFileId: 'f1' }],
      }),
    ).toBe(true);
  });

  it('sinonim, makna baru, dan hapus foto masuk antrean dulu', () => {
    expect(isRevertibleForApplyPending({ relations: [{ action: 'add', relationType: 'synonym', wordId: 'w' }] })).toBe(false);
    expect(isRevertibleForApplyPending({ meanings: [{ action: 'add', definition: 'x' }] })).toBe(false);
    expect(isRevertibleForApplyPending({ images: [{ action: 'remove', imageId: 'img' }] })).toBe(false);
  });
});

describe('censorSuggestionText', () => {
  const blocked = ['bodoh'];

  it('satu kata terlarang di kalimat panjang jadi ***', () => {
    const out = censorSuggestionText(
      { meanings: [{ action: 'update', meaningId: MEANING, definition: 'orang yang bodoh sekali dalam berhitung' }] },
      null,
      blocked,
    );
    expect(out.issues).toEqual([]);
    expect(out.changes.meanings?.[0]?.definition).toBe('orang yang *** sekali dalam berhitung');
  });

  it('definisi yang hampir seluruhnya terlarang ditolak', () => {
    const out = censorSuggestionText(
      { meanings: [{ action: 'update', meaningId: MEANING, definition: 'bodoh' }] },
      null,
      blocked,
    );
    expect(out.issues).toHaveLength(1);
  });

  it('lemma tidak disaring', () => {
    const out = censorSuggestionText({ lemma: 'bodoh' }, null, blocked);
    expect(out.changes.lemma).toBe('bodoh');
    expect(out.issues).toEqual([]);
  });
});

describe('createSuggestionSchema examples', () => {
  it('usulan berisi contoh ditolak', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'change_meaning',
      proposed_changes: {
        meanings: [
          {
            meaning_id: MEANING,
            action: 'update',
            definition: 'x',
            examples: [{ source_language_id: MEANING, source_sentence: 'a' }],
          },
        ],
      },
    });
    expect(parsed.success).toBe(false);
  });
});
