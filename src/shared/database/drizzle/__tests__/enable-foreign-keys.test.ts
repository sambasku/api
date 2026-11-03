import { describe, it, expect, vi } from 'vitest';
import {
  enableForeignKeys,
  isTransientLibsqlError,
} from '@/shared/database/drizzle/enable-foreign-keys';

describe('isTransientLibsqlError', () => {
  it('mengenali LibsqlError HTTP 525 dari stack cron staging', () => {
    expect(
      isTransientLibsqlError(
        new Error('SERVER_ERROR: Server returned HTTP status 525'),
      ),
    ).toBe(true);
  });

  it('TIDAK menandai constraint SQLite', () => {
    expect(
      isTransientLibsqlError(
        new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'),
      ),
    ).toBe(false);
  });
});

describe('enableForeignKeys', () => {
  it('sukses di attempt pertama - satu execute', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await enableForeignKeys({ execute }, { softFail: false, retryDelayMs: 0 });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
  });

  it('retry transient lalu sukses', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('SERVER_ERROR: Server returned HTTP status 525'))
      .mockResolvedValueOnce({ rows: [] });
    await enableForeignKeys({ execute }, { softFail: false, retryDelayMs: 0 });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('Workers softFail: habis retry tetap resolve tanpa throw', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new Error('SERVER_ERROR: Server returned HTTP status 525'));
    const log = vi.fn();
    await enableForeignKeys(
      { execute },
      { softFail: true, retryDelayMs: 0, maxAttempts: 3, log },
    );
    expect(execute).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('Node softFail false: throw setelah retry habis', async () => {
    const err = new Error('SERVER_ERROR: Server returned HTTP status 525');
    const execute = vi.fn().mockRejectedValue(err);
    await expect(
      enableForeignKeys({ execute }, { softFail: false, retryDelayMs: 0, maxAttempts: 2 }),
    ).rejects.toBe(err);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('error non-transient: tidak retry, throw segera', async () => {
    const err = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
    const execute = vi.fn().mockRejectedValue(err);
    await expect(
      enableForeignKeys({ execute }, { softFail: false, retryDelayMs: 0, maxAttempts: 3 }),
    ).rejects.toBe(err);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
