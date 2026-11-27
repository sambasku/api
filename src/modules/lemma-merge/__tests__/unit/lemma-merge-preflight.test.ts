import { describe, expect, it, vi } from 'vitest';
import { assertLemmaMergeBatchAllowed } from '../../application/lemma-merge-preflight';

describe('assertLemmaMergeBatchAllowed', () => {
  it('menolak batch kosong setelah filter keep', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as import('@/shared/database/drizzle/client').AppDatabase;

    await expect(
      assertLemmaMergeBatchAllowed(db, '01KEEP_____________________', ['01KEEP_____________________']),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });
});