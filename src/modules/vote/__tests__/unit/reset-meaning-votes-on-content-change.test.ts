import { beforeEach, describe, expect, it, vi } from 'vitest';

const transactionMock = vi.fn();
const settingsLimit = vi.fn();

vi.mock('@/shared/database/drizzle/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: settingsLimit,
        }),
      }),
    }),
    transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock('@/shared/utils/ulid', () => ({
  generateId: () => '01BATCHRESETVOTEARCHIVE00001',
}));

describe('resetMeaningVotesOnContentChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsLimit.mockResolvedValue([{ value: 'true' }]);
  });

  it('meaningIds kosong → no-op tanpa transaksi', async () => {
    const { resetMeaningVotesOnContentChange } = await import(
      '../../application/reset-meaning-votes-on-content-change'
    );
    const result = await resetMeaningVotesOnContentChange({
      meaningIds: [],
      wordId: '01WORD',
      reason: 'suggestion_applied',
      actorId: '01ACTOR',
    });
    expect(result).toEqual({ archived: 0, meaningsReset: 0, batchId: null });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('kill switch off → no-op tanpa transaksi', async () => {
    settingsLimit.mockResolvedValue([{ value: 'false' }]);
    const { resetMeaningVotesOnContentChange } = await import(
      '../../application/reset-meaning-votes-on-content-change'
    );
    const result = await resetMeaningVotesOnContentChange({
      meaningIds: ['01MEANING'],
      wordId: '01WORD',
      reason: 'suggestion_selfapply',
      actorId: '01ACTOR',
    });
    expect(result).toEqual({ archived: 0, meaningsReset: 0, batchId: null });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('kill switch on → masuk transaksi', async () => {
    settingsLimit.mockResolvedValue([{ value: 'true' }]);
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: async () => [],
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async () => undefined,
          }),
        }),
        delete: () => ({ where: async () => undefined }),
        update: () => ({ set: () => ({ where: async () => undefined }) }),
      };
      // First select (votes) empty; second select (rollup) empty
      let selectCalls = 0;
      tx.select = () => ({
        from: () => ({
          where: async () => {
            selectCalls += 1;
            return selectCalls === 1 ? [] : [];
          },
        }),
      });
      await fn(tx);
    });

    const { resetMeaningVotesOnContentChange } = await import(
      '../../application/reset-meaning-votes-on-content-change'
    );
    const result = await resetMeaningVotesOnContentChange({
      meaningIds: ['01MEANING'],
      wordId: '01WORD',
      reason: 'verifier_direct_edit',
      actorId: '01ACTOR',
    });
    expect(result.meaningsReset).toBe(1);
    expect(result.archived).toBe(0);
    expect(transactionMock).toHaveBeenCalled();
  });
});
