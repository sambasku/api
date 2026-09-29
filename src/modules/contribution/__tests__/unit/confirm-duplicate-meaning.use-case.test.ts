import { describe, it, expect, vi } from 'vitest';
import { ConfirmDuplicateMeaningUseCase } from '../../application/use-cases/confirm-duplicate-meaning.use-case';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { ToggleVoteUseCase } from '@/modules/vote/application/use-cases/toggle-vote.use-case';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

const WORD_ID = '01JDWORDMAKATN0000000000A';
const MEANING_ID = '01MEANINGULID0000000000000';
const USER = '01JDUSERKONTRIB0000000000A';

function makeDeps(opts?: { meaning?: object | null }) {
  const wordRepo = {
    findPublishedMeaningForDuplicateConfirm: vi.fn().mockResolvedValue(
      opts && 'meaning' in opts
        ? opts.meaning
        : {
            wordId: WORD_ID,
            meaningId: MEANING_ID,
            lemma: 'makatn',
            definition: 'makan',
            translationText: 'makan',
          },
    ),
  } as unknown as WordRepository;
  const toggleVote = {
    execute: vi.fn().mockResolvedValue({ myVote: 1, upvotes: 2, downvotes: 0 }),
  } as unknown as ToggleVoteUseCase;
  const auditRepo = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditLogRepository;
  return {
    wordRepo,
    toggleVote,
    auditRepo,
    useCase: new ConfirmDuplicateMeaningUseCase(wordRepo, toggleVote, auditRepo),
  };
}

describe('ConfirmDuplicateMeaningUseCase', () => {
  it('makna published → cast vote + audit duplicate_vote + pesan riwayat', async () => {
    const { useCase, toggleVote, auditRepo } = makeDeps();
    const result = await useCase.execute({
      wordId: WORD_ID,
      meaningId: MEANING_ID,
      value: 1,
      userId: USER,
    });

    expect(toggleVote.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        targetType: 'meaning',
        targetId: MEANING_ID,
        value: 1,
      }),
    );
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'duplicate_vote',
        entityType: 'word',
        entityId: WORD_ID,
        newData: expect.objectContaining({ meaning_id: MEANING_ID, value: 1 }),
      }),
    );
    expect(result.lemma).toBe('makatn');
    expect(result.message).toContain('riwayat perubahan makatn');
    expect(result.myVote).toBe(1);
  });

  it('makna tidak ada → 404, vote/audit tidak dipanggil', async () => {
    const { useCase, toggleVote, auditRepo } = makeDeps({ meaning: null });
    await expect(
      useCase.execute({
        wordId: WORD_ID,
        meaningId: MEANING_ID,
        value: -1,
        userId: USER,
      }),
    ).rejects.toMatchObject({ errorCode: 'MEANING_NOT_FOUND', statusCode: 404 });
    expect(toggleVote.execute).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });
});
