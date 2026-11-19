import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  },
}));

describe('resolveSearchMissPreferVisible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsLimit.mockResolvedValue([{ value: 'true' }]);
  });

  it('kill switch off → false', async () => {
    settingsLimit.mockResolvedValue([{ value: 'false' }]);
    const { resolveSearchMissPreferVisible } = await import(
      '../../application/resolve-auto-visible'
    );
    await expect(
      resolveSearchMissPreferVisible({ term: 'kalintiak' }),
    ).resolves.toBe(false);
  });

  it('quality gagal → false meski flag on', async () => {
    const { resolveSearchMissPreferVisible } = await import(
      '../../application/resolve-auto-visible'
    );
    await expect(
      resolveSearchMissPreferVisible({ term: '!!' }),
    ).resolves.toBe(false);
  });

  it('blocklist kena → false', async () => {
    const blocklist = {
      findActiveWordSet: vi.fn().mockResolvedValue(new Set(['spam'])),
    };
    const { resolveSearchMissPreferVisible } = await import(
      '../../application/resolve-auto-visible'
    );
    await expect(
      resolveSearchMissPreferVisible({ term: 'spam', blocklist }),
    ).resolves.toBe(false);
    expect(blocklist.findActiveWordSet).toHaveBeenCalled();
  });

  it('flag on + term aman + blocklist bersih → true', async () => {
    const blocklist = {
      findActiveWordSet: vi.fn().mockResolvedValue(new Set()),
    };
    const { resolveSearchMissPreferVisible } = await import(
      '../../application/resolve-auto-visible'
    );
    await expect(
      resolveSearchMissPreferVisible({ term: 'kalintiak', blocklist }),
    ).resolves.toBe(true);
  });
});
