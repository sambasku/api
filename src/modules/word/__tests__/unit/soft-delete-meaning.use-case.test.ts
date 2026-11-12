import { describe, expect, it, vi } from 'vitest';
import { SoftDeleteMeaningUseCase } from '../../application/use-cases/soft-delete-meaning.use-case';

const WORD = '01JDWORDMAKATN0000000000A';
const MEANING = '01JDMEANING0000000000000A';
const ADMIN = '01JDUSERADMIN000000000000A';

describe('SoftDeleteMeaningUseCase', () => {
  function make(opts?: {
    liveCount?: number;
    meaning?: { id: string; wordId: string; definition: string } | null;
    deleted?: { id: string; definition: string } | null;
  }) {
    const wordRepo = {
      findById: vi.fn().mockResolvedValue({ id: WORD, lemma: 'makatn' }),
      findMeaningById: vi.fn().mockResolvedValue(
        opts?.meaning === undefined
          ? { id: MEANING, wordId: WORD, definition: 'arti' }
          : opts.meaning,
      ),
      countLiveMeanings: vi.fn().mockResolvedValue(opts?.liveCount ?? 2),
      softDeleteMeaning: vi.fn().mockResolvedValue(
        opts?.deleted === undefined
          ? { id: MEANING, definition: 'arti' }
          : opts.deleted,
      ),
    };
    const audit = { record: vi.fn() };
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    return {
      wordRepo,
      audit,
      onDeleted,
      useCase: new SoftDeleteMeaningUseCase(
        wordRepo as never,
        audit as never,
        onDeleted,
      ),
    };
  }

  it('hapus makna + audit + hook', async () => {
    const { useCase, wordRepo, audit, onDeleted } = make();
    const row = await useCase.execute(WORD, MEANING, {
      userId: ADMIN,
      role: 'reviewer',
      roles: ['reviewer'],
    });
    expect(row.meaningId).toBe(MEANING);
    expect(wordRepo.softDeleteMeaning).toHaveBeenCalledWith(WORD, MEANING, ADMIN);
    expect(audit.record).toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ wordId: WORD, meaningId: MEANING, actorId: ADMIN }),
    );
  });

  it('makna terakhir → 409', async () => {
    const { useCase, wordRepo } = make({ liveCount: 1 });
    await expect(
      useCase.execute(WORD, MEANING, {
        userId: ADMIN,
        role: 'admin',
        roles: ['admin'],
      }),
    ).rejects.toMatchObject({ errorCode: 'LAST_MEANING' });
    expect(wordRepo.softDeleteMeaning).not.toHaveBeenCalled();
  });

  it('contributor → 403', async () => {
    const { useCase } = make();
    await expect(
      useCase.execute(WORD, MEANING, {
        userId: ADMIN,
        role: 'contributor',
        roles: ['contributor'],
      }),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });
  });

  it('makna salah kata → 404', async () => {
    const { useCase } = make({
      meaning: { id: MEANING, wordId: '01JDOTHERWORD000000000000A', definition: 'x' },
    });
    await expect(
      useCase.execute(WORD, MEANING, {
        userId: ADMIN,
        role: 'root',
        roles: ['root'],
      }),
    ).rejects.toMatchObject({ errorCode: 'MEANING_NOT_FOUND' });
  });
});
