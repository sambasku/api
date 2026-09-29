import { describe, it, expect } from 'vitest';
import { createWordSchema } from '../../presentation/v1/validators/create-word.validator';

const ULID = (s: string) => s.padEnd(26, '0');

function buildMeaning(overrides: Record<string, unknown> = {}) {
  return {
    word_class_id: ULID('01WCNOMINA'),
    definition: 'Aktivitas memasukkan makanan ke mulut',
    order_index: 1,
    translations: [
      { language_id: ULID('01LANGIDN'), translation_text: 'makan', translation_type: 'direct' },
    ],
    ...overrides,
  };
}

function build(overrides: Record<string, unknown> = {}) {
  return {
    language_id: ULID('01LANGSMB'),
    lemma: 'makatn',
    meanings: [buildMeaning()],
    word_type: 'word',
    category_ids: [],
    related_words: [],
    status: 'published',
    ...overrides,
  };
}

describe('createWordSchema - meaning_source', () => {
  it('default manual bila field absen', () => {
    const result = createWordSchema.safeParse(build());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.meanings[0].meaning_source).toBe('manual');
  });

  it('menerima kbbi dan kbbi_edited', () => {
    for (const source of ['kbbi', 'kbbi_edited'] as const) {
      const result = createWordSchema.safeParse(
        build({ meanings: [buildMeaning({ meaning_source: source })] }),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.meanings[0].meaning_source).toBe(source);
    }
  });

  it('menolak nilai di luar enum', () => {
    const result = createWordSchema.safeParse(
      build({ meanings: [buildMeaning({ meaning_source: 'copied' })] }),
    );
    expect(result.success).toBe(false);
  });
});
