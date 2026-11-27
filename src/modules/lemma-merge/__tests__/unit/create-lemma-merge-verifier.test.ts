import { describe, expect, it, vi } from 'vitest';
import { CreateLemmaMergeUseCase } from '../../application/create-lemma-merge.use-case';

describe('CreateLemmaMergeUseCase verifikator', () => {
  it('role reviewer langsung approve (applied), bukan antrean kontributor', async () => {
    const insertReturning = vi.fn().mockResolvedValue([
      {
        id: '01REQ_____________________',
        keepWordId: '01KEEP_____________________',
        mergeWordIds: ['01MERGE____________________'],
        status: 'pending',
      },
    ]);
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: insertReturning }),
      }),
      delete: vi.fn().mockReturnValue({ where: deleteWhere }),
      select: vi.fn(),
    } as unknown as import('@/shared/database/drizzle/client').AppDatabase;

    const approve = {
      execute: vi.fn().mockResolvedValue({
        keepWordId: '01KEEP_____________________',
        mergedWordIds: ['01MERGE____________________'],
      }),
    };
    const activity = { safe: vi.fn() };

    const uc = new CreateLemmaMergeUseCase(db, activity as never, approve as never);
    const assertSpy = vi.spyOn(
      await import('../../application/lemma-merge-preflight'),
      'assertLemmaMergeBatchAllowed',
    );
    assertSpy.mockResolvedValue({ keepLemma: 'abe', mergeLemmas: ['abek'] });

    const result = await uc.execute({
      proposerId: '01USER______________________',
      actorRole: ['contributor', 'reviewer'],
      keepWordId: '01KEEP_____________________',
      mergeWordIds: ['01MERGE____________________'],
    });

    expect(result.applied).toBe(true);
    expect(result.status).toBe('approved');
    expect(approve.execute).toHaveBeenCalledOnce();
    expect(activity.safe).not.toHaveBeenCalled();
    assertSpy.mockRestore();
  });
});