import { describe, expect, it, vi } from 'vitest';
import { decideImportPublication, meaningFingerprint } from '../../application/import-words';
import { ImportWordsUseCase } from '../../application/use-cases/import-words.use-case';
import { importWordsBodySchema } from '../../presentation/v1/validators/import-words.validator';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { LanguageRepository } from '@/modules/language/domain/repositories/language.repository';
import type { UserLookupPort } from '../../application/ports/user-lookup.port';
import type { WordClassSummary } from '../../domain/entities/word.entity';

describe('decideImportPublication', () => {
  it('centang tayang saja menayangkan tanpa verifikasi', () => {
    expect(decideImportPublication({ verify: true, verified: false, role: 'admin', parentStatus: null })).toEqual({
      status: 'published',
      isVerified: false,
      forcedDraft: false,
    });
  });

  it('tayang dan terverifikasi menandai kata terverifikasi', () => {
    expect(decideImportPublication({ verify: true, verified: true, role: 'reviewer', parentStatus: null })).toEqual({
      status: 'published',
      isVerified: true,
      forcedDraft: false,
    });
  });

  it('tanpa centang tayang tetap draf meski terverifikasi dicentang', () => {
    const result = decideImportPublication({ verify: false, verified: true, role: 'reviewer', parentStatus: null });
    expect(result.status).toBe('draft');
    expect(result.isVerified).toBe(false);
  });

  it('editor tidak bisa menayangkan atau memverifikasi', () => {
    expect(decideImportPublication({ verify: true, verified: true, role: 'editor', parentStatus: null })).toEqual({
      status: 'draft',
      isVerified: false,
      forcedDraft: false,
    });
  });

  it('induk belum tayang memaksa makna baru jadi draf', () => {
    expect(decideImportPublication({ verify: true, verified: true, role: 'admin', parentStatus: 'draft' })).toMatchObject({
      status: 'draft',
      isVerified: false,
      forcedDraft: true,
    });
    expect(
      decideImportPublication({ verify: true, verified: true, role: 'admin', parentStatus: 'taken_down' }).forcedDraft,
    ).toBe(true);
  });
});

describe('meaningFingerprint', () => {
  it('mengabaikan huruf besar, spasi ganda, dan placeholder', () => {
    expect(
      meaningFingerprint({
        definition: ' Makan  Siang ',
        translation: 'makan',
        isHaveDefinition: true,
        isHaveTranslation: true,
      }),
    ).toBe(
      meaningFingerprint({
        definition: 'makan siang',
        translation: 'Makan',
        isHaveDefinition: true,
        isHaveTranslation: true,
      }),
    );
    // Placeholder "-" / tanpa definisi: tidak jadi kunci isi (sama create).
    expect(
      meaningFingerprint({
        definition: '-',
        translation: 'makan',
        isHaveDefinition: false,
        isHaveTranslation: true,
      }),
    ).toBe(
      meaningFingerprint({
        definition: '',
        translation: 'makan',
        isHaveDefinition: false,
        isHaveTranslation: true,
      }),
    );
  });
});

describe('ImportWordsUseCase - word_class_code & example_translation', () => {
  const UMUM_ID = '01WORDCLASSUMUM00000000000';
  const NOMINA_ID = '01WORDCLASSNOMINA000000000';
  const VERBA_ID = '01WORDCLASSVERBA0000000000';
  const SBS_LANG_ID = '01LANGSBS00000000000000000';
  const IDN_LANG_ID = '01LANGIDN00000000000000000';

  const mockWordClasses: WordClassSummary[] = [
    { id: UMUM_ID, code: 'umum', name: 'Umum', alias: null, description: null, parentId: null },
    { id: NOMINA_ID, code: 'n', name: 'Nomina', alias: 'Kata Benda', description: null, parentId: null },
    { id: VERBA_ID, code: 'v', name: 'Verba', alias: 'Kata Kerja', description: null, parentId: null },
  ];

  function createUseCase(overrides: {
    wordRepo?: Partial<WordRepository>;
    languageRepo?: Partial<LanguageRepository>;
    users?: Partial<UserLookupPort>;
    activityAppend?: ReturnType<typeof vi.fn>;
  } = {}) {
    const defaultWordRepo: Partial<WordRepository> = {
      listWordClasses: vi.fn().mockResolvedValue(mockWordClasses),
      findActiveByLemma: vi.fn().mockResolvedValue(null),
      saveWithRelations: vi.fn().mockResolvedValue({ id: '01WORDNEW00000000000000000', lemma: 'uji', isVerified: false }),
      listMeaningKeys: vi.fn().mockResolvedValue([]),
      addMeaning: vi.fn().mockResolvedValue({ id: '01MEANINGNEW00000000000000' }),
      addExample: vi.fn().mockResolvedValue({ id: '01EXAMPLENEW00000000000000' }),
      ...overrides.wordRepo,
    };
    const defaultLanguageRepo: Partial<LanguageRepository> = {
      listLanguages: vi.fn().mockResolvedValue([
        { id: SBS_LANG_ID, code: 'SBS', name: 'Sambas' },
        { id: IDN_LANG_ID, code: 'IDN', name: 'Indonesia' },
      ]),
      listDialects: vi.fn().mockResolvedValue([
        { id: '01DIALECTDEFAULT0000000000', languageId: SBS_LANG_ID, code: 'umum', name: 'Umum', isDefault: true },
      ]),
      ...overrides.languageRepo,
    };
    const defaultUsers: Partial<UserLookupPort> = {
      findById: vi.fn().mockResolvedValue({ id: '01USER00000000000000000000', isActive: true }),
      ...overrides.users,
    };
    const activityAppend = overrides.activityAppend ?? vi.fn().mockResolvedValue('appended');
    return {
      useCase: new ImportWordsUseCase(
        defaultWordRepo as WordRepository,
        defaultLanguageRepo as LanguageRepository,
        defaultUsers as UserLookupPort,
        { append: activityAppend },
      ),
      wordRepo: defaultWordRepo,
      activityAppend,
    };
  }

  const defaultActor = { userId: 'admin1', role: 'admin', roles: ['admin'] };

  it('(a) word_class_code "kb" memetakan kelas kata ke id nomina', async () => {
    const { useCase, wordRepo } = createUseCase();
    await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'buku',
            verify: false,
            verified: false,
            meanings: [
              {
                definition: 'lembar kertas berjilid',
                translation: 'buku',
                wordClassCode: 'kb',
              },
            ],
          },
        ],
      },
      defaultActor,
    );

    expect(wordRepo.saveWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        meanings: [
          expect.objectContaining({
            wordClassId: NOMINA_ID,
          }),
        ],
      }),
      expect.any(String),
    );
  });

  it('(b) word_class_code tidak dikenal atau belum di-seed jatuh ke id kelas kata umum', async () => {
    const { useCase, wordRepo } = createUseCase();
    await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'lao',
            verify: false,
            verified: false,
            meanings: [
              {
                definition: 'sangat jauh',
                translation: 'jauh',
                // ks (adjektiva) belum di-seed di fixture mockWordClasses
                wordClassCode: 'ks',
              },
            ],
          },
        ],
      },
      defaultActor,
    );

    expect(wordRepo.saveWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        meanings: [
          expect.objectContaining({
            wordClassId: UMUM_ID,
          }),
        ],
      }),
      expect.any(String),
    );
  });

  it('(c) example_translation diteruskan ke targetSentence dan targetLanguageId pada addExample (meanings_added branch)', async () => {
    const existingParent = { id: '01PARENT000000000000000000', status: 'published' as const };
    const { useCase, wordRepo } = createUseCase({
      wordRepo: {
        findActiveByLemma: vi.fn().mockResolvedValue(existingParent),
        listMeaningKeys: vi.fn().mockResolvedValue([]),
        addMeaning: vi.fn().mockResolvedValue({ id: '01MEANING00000000000000000' }),
        addExample: vi.fn().mockResolvedValue({ id: '01EXAMPLE00000000000000000' }),
      },
    });

    await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'makan',
            verify: true,
            verified: false,
            meanings: [
              {
                definition: 'memasukkan makanan',
                translation: 'makan',
                wordClassCode: 'kk',
                example: 'Aku makan nasik.',
                exampleTranslation: 'Saya makan nasi.',
              },
            ],
          },
        ],
      },
      defaultActor,
    );

    // Assert addMeaning receives verba class ID (kk -> 'v')
    expect(wordRepo.addMeaning).toHaveBeenCalledWith(
      existingParent.id,
      expect.objectContaining({
        wordClassId: VERBA_ID,
      }),
      expect.any(String),
    );

    // Assert addExample receives targetSentence & targetLanguageId
    expect(wordRepo.addExample).toHaveBeenCalledWith(
      '01MEANING00000000000000000',
      expect.objectContaining({
        sourceLanguageId: SBS_LANG_ID,
        sourceSentence: 'Aku makan nasik.',
        targetLanguageId: IDN_LANG_ID,
        targetSentence: 'Saya makan nasi.',
      }),
      expect.any(String),
    );
  });

  it('example_translation juga masuk ke examples pada saveWithRelations (kata baru)', async () => {
    const { useCase, wordRepo } = createUseCase();
    await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'jalan',
            verify: false,
            verified: false,
            meanings: [
              {
                definition: 'melangkah',
                translation: 'jalan',
                example: 'Kamek jalan ke pasar.',
                exampleTranslation: 'Kami berjalan ke pasar.',
              },
            ],
          },
        ],
      },
      defaultActor,
    );

    expect(wordRepo.saveWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        meanings: [
          expect.objectContaining({
            examples: [
              expect.objectContaining({
                sourceLanguageId: SBS_LANG_ID,
                sourceSentence: 'Kamek jalan ke pasar.',
                targetLanguageId: IDN_LANG_ID,
                targetSentence: 'Kami berjalan ke pasar.',
              }),
            ],
          }),
        ],
      }),
      expect.any(String),
    );
  });

  it('makna sama (beda spasi/kasus) → skipped, tidak addMeaning', async () => {
    const existingParent = { id: '01PARENT000000000000000000', status: 'published' as const };
    const { useCase, wordRepo } = createUseCase({
      wordRepo: {
        findActiveByLemma: vi.fn().mockResolvedValue(existingParent),
        listMeaningKeys: vi.fn().mockResolvedValue([
          {
            definition: 'memasukkan makanan',
            translation: 'makan',
            isHaveDefinition: true,
            isHaveTranslation: true,
          },
        ]),
      },
    });

    const result = await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'makan',
            verify: true,
            verified: false,
            meanings: [
              {
                definition: '  Memasukkan   Makanan ',
                translation: 'Makan',
              },
            ],
          },
        ],
      },
      defaultActor,
    );

    expect(result.items[0]?.outcome).toBe('skipped');
    expect(wordRepo.addMeaning).not.toHaveBeenCalled();
  });

  it('kata baru tayang terverifikasi → event word_created', async () => {
    const { useCase, activityAppend } = createUseCase({
      wordRepo: {
        saveWithRelations: vi.fn().mockResolvedValue({
          id: '01WORDNEW00000000000000000',
          lemma: 'baru',
          isVerified: true,
        }),
      },
    });

    await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'baru',
            verify: true,
            verified: true,
            meanings: [{ definition: 'baru dibuat', translation: 'baru' }],
          },
        ],
      },
      defaultActor,
    );

    expect(activityAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'word_created',
        targetWordId: '01WORDNEW00000000000000000',
        dedupeKey: 'word:01WORDNEW00000000000000000',
      }),
    );
  });

  it('kata baru draf → tanpa event aktivitas', async () => {
    const { useCase, activityAppend } = createUseCase();
    await useCase.execute(
      {
        mode: 'commit',
        items: [
          {
            lemma: 'draf',
            verify: false,
            verified: false,
            meanings: [{ definition: 'masih draf', translation: 'draf' }],
          },
        ],
      },
      defaultActor,
    );
    expect(activityAppend).not.toHaveBeenCalled();
  });
});

describe('importWordsBodySchema - word_class_code & example_translation', () => {
  const baseItem = {
    lemma: 'uji',
    meanings: [{ definition: 'definisi' }],
  };

  it('menerima word_class_code valid (kb/kk/ks/kt/kd) dan example_translation', () => {
    for (const code of ['kb', 'kk', 'ks', 'kt', 'kd']) {
      const parsed = importWordsBodySchema.safeParse({
        mode: 'validate',
        items: [{ ...baseItem, meanings: [{ ...baseItem.meanings[0], word_class_code: code }] }],
      });
      expect(parsed.success).toBe(true);
    }
    const withTranslation = importWordsBodySchema.safeParse({
      mode: 'validate',
      items: [{ ...baseItem, meanings: [{ ...baseItem.meanings[0], example_translation: 'Saya makan nasi.' }] }],
    });
    expect(withTranslation.success).toBe(true);
  });

  it('menolak word_class_code di luar daftar', () => {
    const parsed = importWordsBodySchema.safeParse({
      mode: 'validate',
      items: [{ ...baseItem, meanings: [{ ...baseItem.meanings[0], word_class_code: 'noun' }] }],
    });
    expect(parsed.success).toBe(false);
  });

  it('menolak example_translation lebih dari 500 karakter', () => {
    const parsed = importWordsBodySchema.safeParse({
      mode: 'validate',
      items: [
        {
          ...baseItem,
          meanings: [{ ...baseItem.meanings[0], example_translation: 'a'.repeat(501) }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
