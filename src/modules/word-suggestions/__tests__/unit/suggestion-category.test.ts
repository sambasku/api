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
    expect(fields).toContain('meanings.0.word_class_id');
  });

  it('#230 change_meaning menerima beberapa makna sekaligus', () => {
    const issues = checkSuggestionCategoryShape('change_meaning', {
      meanings: [
        { action: 'update', meaningId: '01HAAAAAAAAAAAAAAAAAAAAAAAA', definition: 'x' },
        { action: 'update', meaningId: '01HBBBBBBBBBBBBBBBBBBBBBBBB', translations: [{ languageId: 'idn', translationText: 'y' }] },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('#230 change_meaning menolak makna sama dua kali dan entri tanpa target', () => {
    const issues = checkSuggestionCategoryShape('change_meaning', {
      meanings: [
        { action: 'update', meaningId: MEANING, definition: 'x' },
        { action: 'update', meaningId: MEANING, definition: 'y' },
        { action: 'update', meaningId: '01HCCCCCCCCCCCCCCCCCCCCCCCC' },
        { action: 'add', definition: 'baru' },
      ],
    });
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('meanings.1'); // duplikat makna
    expect(fields).toContain('meanings.2'); // tanpa isi
    expect(fields).toContain('meanings.3'); // bukan update
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

  it('kategori menolak jenis entri yang dicampur', () => {
    const issues = checkSuggestionCategoryShape('change_meaning', {
      wordType: 'ungkapan',
      meanings: [{ action: 'update', meaningId: MEANING, definition: 'x' }],
    });
    expect(issues.map((i) => i.field)).toContain('word_type');
  });

  it('change_word_type hanya terima word_type', () => {
    expect(
      checkSuggestionCategoryShape('change_word_type', { wordType: 'idiom' }),
    ).toEqual([]);
    expect(
      checkSuggestionCategoryShape('change_word_type', {
        wordType: 'idiom',
        lemma: 'x',
      }).map((i) => i.field),
    ).toContain('lemma');
    expect(
      checkSuggestionCategoryShape('change_word_type', {
        wordType: 'idiom',
        meanings: [{ action: 'update', meaningId: MEANING, definition: 'x' }],
      }).map((i) => i.field),
    ).toContain('meanings');
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

  it('#244 change_example menerima update kalimat/arti', () => {
    expect(
      checkSuggestionCategoryShape('change_example', {
        examples: [
          {
            exampleId: '01EXAMPLE00000000000000001',
            action: 'update',
            sourceSentence: 'Kami makan kalintiak.',
          },
        ],
      }),
    ).toEqual([]);
  });

  it('#244 change_example menolak contoh ganda dan tanpa isi', () => {
    const dup = checkSuggestionCategoryShape('change_example', {
      examples: [
        {
          exampleId: '01EXAMPLE00000000000000001',
          action: 'update',
          sourceSentence: 'a',
        },
        {
          exampleId: '01EXAMPLE00000000000000001',
          action: 'update',
          sourceSentence: 'b',
        },
      ],
    });
    expect(dup.some((i) => i.message.includes('dua kali'))).toBe(true);

    const empty = checkSuggestionCategoryShape('change_example', {
      examples: [{ exampleId: '01EXAMPLE00000000000000001', action: 'update' }],
    });
    expect(empty.some((i) => i.message.includes('kalimat contoh'))).toBe(true);
  });

  it('change_pronunciation menerima update value', () => {
    expect(
      checkSuggestionCategoryShape('change_pronunciation', {
        pronunciations: [
          {
            pronunciationId: '01PRONUN000000000000000001',
            action: 'update',
            value: 'sa.dap',
          },
        ],
      }),
    ).toEqual([]);
  });

  it('change_pronunciation menolak ganda dan value kosong', () => {
    const dup = checkSuggestionCategoryShape('change_pronunciation', {
      pronunciations: [
        {
          pronunciationId: '01PRONUN000000000000000001',
          action: 'update',
          value: 'a',
        },
        {
          pronunciationId: '01PRONUN000000000000000001',
          action: 'update',
          value: 'b',
        },
      ],
    });
    expect(dup.some((i) => i.message.includes('dua kali'))).toBe(true);

    const empty = checkSuggestionCategoryShape('change_pronunciation', {
      pronunciations: [
        { pronunciationId: '01PRONUN000000000000000001', action: 'update', value: '   ' },
      ],
    });
    expect(empty.some((i) => i.message.includes('pelafalan'))).toBe(true);
  });

  it('relasi baru: tipe lain ditolak, tipe sendiri lolos', () => {
    expect(
      checkSuggestionCategoryShape('variant_of', {
        relations: [{ action: 'add', relationType: 'nonstandard_of', wordId: 'w' }],
      }).map((i) => i.field),
    ).toContain('relations');
    expect(
      checkSuggestionCategoryShape('derived_from', {
        relations: [{ action: 'add', relationType: 'derived_from', wordId: 'w' }],
      }),
    ).toEqual([]);
  });

  it('meaning_group hanya terima payload groups', () => {
    expect(
      checkSuggestionCategoryShape('meaning_group', {
        relations: [{ action: 'add', relationType: 'synonym', wordId: 'w' }],
        groups: [{ action: 'add', name: 'kenapa' }],
      }).map((i) => i.field),
    ).toContain('relations');
    expect(
      checkSuggestionCategoryShape('meaning_group', {
        groups: [{ action: 'add', name: 'kenapa' }],
      }),
    ).toEqual([]);
  });
});

describe('isRevertibleForApplyPending', () => {
  it('jenis entri boleh dikembalikan saat ditolak', () => {
    expect(isRevertibleForApplyPending({ wordType: 'ungkapan' })).toBe(true);
  });

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

  it('PRD relasi-lemma: relasi baru dan kelompok masuk antrean dulu', () => {
    expect(
      isRevertibleForApplyPending({
        relations: [{ action: 'add', relationType: 'variant_of', wordId: 'w' }],
      }),
    ).toBe(false);
    expect(isRevertibleForApplyPending({ groups: [{ action: 'add', name: 'kenapa' }] })).toBe(false);
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
  it('contoh nested di meanings tetap ditolak (tambah lewat POST examples)', () => {
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

  it('#244 change_example top-level lolos', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'change_example',
      proposed_changes: {
        examples: [
          {
            example_id: '01EXAMPLE00000000000000001',
            action: 'update',
            source_sentence: 'Kami makan kalintiak.',
            target_sentence: 'Kami makan kue.',
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('change_pronunciation top-level lolos dan strip slash tepi', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'change_pronunciation',
      proposed_changes: {
        pronunciations: [
          {
            pronunciation_id: '01PRONUN000000000000000001',
            action: 'update',
            value: '/sa.dap/',
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.proposed_changes.pronunciations?.[0]?.value).toBe('sa.dap');
  });

  it('PRD relasi-lemma: meaning_group dengan kelompok baru lolos', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'meaning_group',
      proposed_changes: {
          groups: [{ action: 'add', name: 'kenapa', word_ids: ['01HZZZZZZZZZZZZZZZZZZZZZZ2'] }],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('PRD relasi-lemma: hapus kelompok tanpa group_id ditolak', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'meaning_group',
      proposed_changes: { groups: [{ action: 'remove' }] },
    });
    expect(parsed.success).toBe(false);
  });

  it('PRD relasi-lemma: relasi variant_of sah di payload', () => {
    const parsed = createSuggestionSchema.safeParse({
      reason_code: 'variant_of',
      proposed_changes: {
          relations: [{ action: 'add', relation_type: 'variant_of', word_id: '01HZZZZZZZZZZZZZZZZZZZZZZ3' }],
      },
    });
    expect(parsed.success).toBe(true);
  });
});
