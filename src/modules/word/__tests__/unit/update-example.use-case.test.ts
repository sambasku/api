import { describe, it, expect, vi } from 'vitest';
import { UpdateExampleUseCase } from '../../application/use-cases/update-example.use-case';
import type { WordRepository } from '../../domain/repositories/word.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

const WORD = { id: '01WORDULID000000000000000', lemma: 'makatn' } as const;
const OWNER = { roles: ['contributor'], userId: '01CONTRIBUTORULID0000000', role: 'contributor', requestId: null };
const EXAMPLE_ID = '01EXULID000000000000000000';

function makeDeps() {
  const wordRepo = {
    findById: vi.fn().mockResolvedValue(WORD),
    findExampleForOwner: vi.fn().mockResolvedValue({
      id: EXAMPLE_ID,
      meaningId: '01MEANINGULID0000000000000',
      wordId: WORD.id,
      sourceSentence: 'Kami udah makatn tadu.',
      targetSentence: null,
      status: 'pending_review',
      isVerified: false,
    }),
    updateExampleContent: vi.fn().mockImplementation(
      (_id: string, _actorId: string, data: { sourceSentence: string; targetSentence?: string | null }) =>
        Promise.resolve({
          id: EXAMPLE_ID,
          meaningId: '01MEANINGULID0000000000000',
          sourceLanguageId: '01LANGLANGUAGESMB0000000',
          sourceSentence: data.sourceSentence,
          targetLanguageId: null,
          targetSentence: data.targetSentence ?? null,
          sourceType: null,
          notes: null,
          status: 'pending_review',
          isVerified: false,
          isCorrected: false,
        }),
    ),
  } as unknown as WordRepository;
  const auditRepo = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() };
  return { wordRepo, auditRepo };
}

describe('UpdateExampleUseCase (#244)', () => {
  it('bukan milik / tidak ada → 404 EXAMPLE_NOT_FOUND', async () => {
    const { wordRepo, auditRepo } = makeDeps();
    wordRepo.findExampleForOwner = vi.fn().mockResolvedValue(null);
    const useCase = new UpdateExampleUseCase(wordRepo, auditRepo as unknown as AuditLogRepository);
    await expect(
      useCase.execute(EXAMPLE_ID, { sourceSentence: 'x' }, OWNER),
    ).rejects.toMatchObject({ errorCode: 'EXAMPLE_NOT_FOUND', statusCode: 404 });
  });

  it('sudah direview (published) → 409 EXAMPLE_ALREADY_REVIEWED', async () => {
    const { wordRepo, auditRepo } = makeDeps();
    wordRepo.findExampleForOwner = vi.fn().mockResolvedValue({
      id: EXAMPLE_ID,
      meaningId: '01MEANINGULID0000000000000',
      wordId: WORD.id,
      sourceSentence: 'x',
      targetSentence: null,
      status: 'published',
      isVerified: true,
    });
    const useCase = new UpdateExampleUseCase(wordRepo, auditRepo as unknown as AuditLogRepository);
    await expect(
      useCase.execute(EXAMPLE_ID, { sourceSentence: 'y' }, OWNER),
    ).rejects.toMatchObject({ errorCode: 'EXAMPLE_ALREADY_REVIEWED', statusCode: 409 });
  });

  it('isi sama persis → no_changes, tidak ada update/audit', async () => {
    const { wordRepo, auditRepo } = makeDeps();
    const useCase = new UpdateExampleUseCase(wordRepo, auditRepo as unknown as AuditLogRepository);
    const result = await useCase.execute(
      EXAMPLE_ID,
      { sourceSentence: 'Kami udah makatn tadu.' },
      OWNER,
    );
    expect(result.outcome).toBe('no_changes');
    expect(wordRepo.updateExampleContent).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('perbaiki typo → updated, tetap pending, audit action update', async () => {
    const { wordRepo, auditRepo } = makeDeps();
    const useCase = new UpdateExampleUseCase(wordRepo, auditRepo as unknown as AuditLogRepository);
    const result = await useCase.execute(
      EXAMPLE_ID,
      { sourceSentence: 'Kami udah makatn tadi.' },
      OWNER,
    );
    expect(result.outcome).toBe('updated');
    if (result.outcome !== 'updated') return;
    expect(result.media.status).toBe('pending_review');
    expect(result.media.sourceSentence).toBe('Kami udah makatn tadi.');
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entityType: 'example', entityId: EXAMPLE_ID }),
    );
  });

  it('kalah race di update (null) → 409 EXAMPLE_ALREADY_REVIEWED', async () => {
    const { wordRepo, auditRepo } = makeDeps();
    wordRepo.updateExampleContent = vi.fn().mockResolvedValue(null);
    const useCase = new UpdateExampleUseCase(wordRepo, auditRepo as unknown as AuditLogRepository);
    await expect(
      useCase.execute(EXAMPLE_ID, { sourceSentence: 'Kami udah makatn tadi.' }, OWNER),
    ).rejects.toMatchObject({ errorCode: 'EXAMPLE_ALREADY_REVIEWED', statusCode: 409 });
  });

  it('teks terkena censor berat → VALIDATION_ERROR', async () => {
    const { wordRepo, auditRepo } = makeDeps();
    const blocked = ['bangsat'];
    const blocklist = { listAllActiveWords: vi.fn().mockResolvedValue(blocked) };
    const useCase = new UpdateExampleUseCase(
      wordRepo,
      auditRepo as unknown as AuditLogRepository,
      blocklist as never,
    );
    await expect(
      useCase.execute(EXAMPLE_ID, { sourceSentence: 'kata bangsat kata bangsat' }, OWNER),
    ).rejects.toMatchObject({
      errorCode: 'VALIDATION_ERROR',
      details: [{ field: 'source_sentence' }],
    });
  });
});
