import { describe, it, expect, vi } from 'vitest';
import { UpdateWordUseCase } from '../../application/use-cases/update-word.use-case';
import type { WordRepository, MissingReferences } from '../../domain/repositories/word.repository';
import type { UpdateWordDto } from '../../application/dto/update-word.dto';
import type { Word, WordDetail } from '../../domain/entities/word.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

// PRD relasi-lemma: aturan silang derived_from - tidak boleh relasi ke
// diri sendiri, tidak boleh menutup siklus akar (A→B→C lalu C→A).
const NO_MISSING: MissingReferences = {
  languageId: false,
  dialectId: false,
  languages: [],
  wordClasses: [],
  categories: [],
  words: [],
  dialects: [],
  inlineWordClasses: [],
  inlineLanguages: [],
  inlineCategories: [],
  inlineDialects: [],
};

const WORD_ID = '01WORDULID000000000000000';
const OTHER_ID = '01WORDLAINULID00000000000';

function makeDto(overrides: Partial<UpdateWordDto> = {}): UpdateWordDto {
  return {
    languageId: '01LANGLANGUAGESMB0000000',
    lemma: 'barakat',
    meanings: [
      {
        wordClassId: '01WORDCLASSESNOMINA000000',
        definition: 'definisi uji relasi',
        orderIndex: 1,
        translations: [],
      },
    ],
    wordType: 'word',
    usageLabels: [],
    categoryIds: [],
    relatedWords: [],
    status: 'published',
    ...overrides,
  };
}

function makeDetail(): WordDetail {
  return {
    id: WORD_ID,
    languageId: '01LANGLANGUAGESMB0000000',
    lemma: 'barakat',
    lemmaAllowsComma: false,
    notes: null,
    wordType: 'word',
    usageLabels: [],
    status: 'published',
    isVerified: true,
    verifiedBy: null,
    verifiedAt: null,
    isCorrected: false,
    createdBy: '01TESTULIDUSERID00000000',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
    deletedBy: null,
    takedownReasonCode: null,
    takedownNote: null,
    takenDownBy: null,
    takenDownAt: null,
    importSessionId: null,
    meanings: [],
    categories: [],
    pronunciations: [],
    images: [],
    audios: [],
    relatedWords: [],
    appearsIn: [],
    meaningGroups: [],
    variants: [],
    verifier: null,
    creator: null,
    importSource: null,
  };
}

function makeDeps(opts: { hasPath?: boolean } = {}) {
  const wordRepo = {
    findDetailById: vi.fn().mockResolvedValue(makeDetail()),
    findMissingReferences: vi.fn().mockResolvedValue(NO_MISSING),
    findDuplicate: vi.fn().mockResolvedValue(false),
    findById: vi.fn(),
    publishOrMergeMeanings: vi.fn().mockResolvedValue(null),
    updateWithRelations: vi.fn().mockResolvedValue({ id: WORD_ID } as unknown as Word),
    hasDerivedFromPath: vi.fn().mockResolvedValue(opts.hasPath ?? false),
  } as unknown as WordRepository;
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() };
  return {
    wordRepo,
    useCase: new UpdateWordUseCase(wordRepo, auditRepo as unknown as AuditLogRepository),
  };
}

const ADMIN = { roles: ['admin'], userId: '01TESTULIDUSERID00000000', role: 'admin', requestId: 'r' };

describe('UpdateWordUseCase - relasi PRD relasi-lemma', () => {
  it('relasi ke diri sendiri (relation_type apapun) → ValidationError', async () => {
    const { useCase } = makeDeps();
    await expect(
      useCase.execute(
        WORD_ID,
        makeDto({ relatedWords: [{ wordId: WORD_ID, relationType: 'variant_of' }] }),
        ADMIN,
      ),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('derived_from menutup siklus (path target→source sudah ada) → ValidationError', async () => {
    const { useCase, wordRepo } = makeDeps({ hasPath: true });
    await expect(
      useCase.execute(
        WORD_ID,
        makeDto({ relatedWords: [{ wordId: OTHER_ID, relationType: 'derived_from' }] }),
        ADMIN,
      ),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    expect(wordRepo.hasDerivedFromPath).toHaveBeenCalledWith(WORD_ID, OTHER_ID);
  });

  it('derived_from aman (bukan siklus) → lolos, hasDerivedFromPath dipanggil', async () => {
    const { useCase, wordRepo } = makeDeps({ hasPath: false });
    await useCase.execute(
      WORD_ID,
      makeDto({ relatedWords: [{ wordId: OTHER_ID, relationType: 'derived_from' }] }),
      ADMIN,
    );
    expect(wordRepo.hasDerivedFromPath).toHaveBeenCalledTimes(1);
  });

  it('relasi non-derived_from tidak memanggil hasDerivedFromPath', async () => {
    const { useCase, wordRepo } = makeDeps();
    await useCase.execute(
      WORD_ID,
      makeDto({ relatedWords: [{ wordId: OTHER_ID, relationType: 'variant_of' }] }),
      ADMIN,
    );
    expect(wordRepo.hasDerivedFromPath).not.toHaveBeenCalled();
  });
});
