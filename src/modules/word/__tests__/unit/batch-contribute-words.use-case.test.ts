import { describe, expect, it, vi } from 'vitest';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { BadRequestError } from '@/shared/errors/app-error';
import {
  BATCH_CONTRIBUTE_MAX_ROWS,
  BATCH_CONTRIBUTE_SOURCE_LABEL,
  BatchContributeWordsUseCase,
} from '../../application/use-cases/batch-contribute-words.use-case';

describe('BatchContributeWordsUseCase', () => {
  function makeDeps() {
    const sessionRepo = {
      upsert: vi.fn().mockImplementation(async (session) => ({
        ...session,
        triggeredByUsername: null,
        triggeredByDisplayName: null,
        attributedToUsername: 'Anonim',
        attributedToDisplayName: 'Anonim',
        claimedBy: null,
        claimedByUsername: null,
        claimedByDisplayName: null,
        claimedAt: null,
        createdAt: new Date(),
        rolledBackAt: null,
        rolledBackBy: null,
      })),
      findById: vi.fn(),
      list: vi.fn(),
      claim: vi.fn(),
      markRolledBack: vi.fn(),
    };
    const languageRepo = {
      listLanguages: vi.fn().mockResolvedValue([
        { id: '01LANGSBS00000000000000001', code: 'SBS', name: 'Sambas' },
        { id: '01LANGIDN00000000000000001', code: 'IDN', name: 'Indonesia' },
      ]),
      listDialects: vi.fn().mockResolvedValue([
        { id: '01DIALECTUMUM0000000000001', code: 'umum', isDefault: true },
      ]),
    };
    const wordRepo = {
      listWordClasses: vi.fn().mockResolvedValue([{ id: '01WCUMUM000000000000000001', code: 'umum' }]),
      findActiveByLemma: vi.fn().mockResolvedValue(null),
      saveWithRelations: vi.fn().mockImplementation(async (word) => ({
        id: '01WORDCREATED0000000000001',
        lemma: word.lemma,
        status: word.status,
        isVerified: word.isVerified,
        importSessionId: word.importSessionId,
      })),
      listMeaningKeys: vi.fn(),
      addMeaning: vi.fn(),
    };
    return { sessionRepo, languageRepo, wordRepo };
  }

  it('membuat sesi + kata published dengan import_session_id; nama kosong → Anonim', async () => {
    const deps = makeDeps();
    const useCase = new BatchContributeWordsUseCase(
      deps.wordRepo as never,
      deps.languageRepo as never,
      deps.sessionRepo as never,
    );

    const result = await useCase.execute({
      rows: [{ sambas: 'makatn', indonesia: 'makan' }],
      contributorName: '  ',
      triggeredBy: ANONIM_USER_ID,
    });

    expect(result.created_count).toBe(1);
    expect(result.session_id).toBeTruthy();
    expect(deps.wordRepo.saveWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        lemma: 'makatn',
        status: 'published',
        isVerified: false,
        importSessionId: result.session_id,
      }),
      ANONIM_USER_ID,
    );
    const finalUpsert = deps.sessionRepo.upsert.mock.calls.at(-1)?.[0];
    expect(finalUpsert).toMatchObject({
      attributedTo: ANONIM_USER_ID,
      supportName: null,
      sourceLabel: BATCH_CONTRIBUTE_SOURCE_LABEL,
      status: 'completed',
      createdCount: 1,
    });
  });

  it('menyimpan contributor_name ke support_name', async () => {
    const deps = makeDeps();
    const useCase = new BatchContributeWordsUseCase(
      deps.wordRepo as never,
      deps.languageRepo as never,
      deps.sessionRepo as never,
    );

    await useCase.execute({
      rows: [{ sambas: 'nginum', indonesia: 'minum' }],
      contributorName: 'Budi',
      triggeredBy: ANONIM_USER_ID,
    });

    const finalUpsert = deps.sessionRepo.upsert.mock.calls.at(-1)?.[0];
    expect(finalUpsert.supportName).toBe('Budi');
  });

  it('menolak lebih dari max rows', async () => {
    const deps = makeDeps();
    const useCase = new BatchContributeWordsUseCase(
      deps.wordRepo as never,
      deps.languageRepo as never,
      deps.sessionRepo as never,
    );
    const rows = Array.from({ length: BATCH_CONTRIBUTE_MAX_ROWS + 1 }, (_, i) => ({
      sambas: `kata${i}`,
      indonesia: `arti${i}`,
    }));

    await expect(
      useCase.execute({ rows, triggeredBy: ANONIM_USER_ID }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(deps.sessionRepo.upsert).not.toHaveBeenCalled();
  });
});
