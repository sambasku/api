import { describe, it, expect, vi } from 'vitest';
import { execBatched, withLibsqlRetry } from '@/shared/database/drizzle/libsql-retry';

const http429 = new Error('SERVER_ERROR: Server returned HTTP status 429');

describe('withLibsqlRetry', () => {
  it('retry 429 lalu sukses', async () => {
    const fn = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(http429)
      .mockResolvedValueOnce(7);
    await expect(withLibsqlRetry(fn)).resolves.toBe(7);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('error non-transient tidak di-retry', async () => {
    const fn = vi
      .fn<() => Promise<number>>()
      .mockRejectedValue(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'));
    await expect(withLibsqlRetry(fn)).rejects.toThrow('SQLITE_CONSTRAINT');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('hormati maxAttempts override', async () => {
    const fn = vi.fn<() => Promise<number>>().mockRejectedValue(http429);
    await expect(
      withLibsqlRetry(fn, { maxAttempts: 2, baseDelayMs: 1 }),
    ).rejects.toThrow(/429/);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('execBatched', () => {
  it('chunk 50 statement per batch + idempoten kosong', async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const stmts = Array.from({ length: 120 }, (_, i) => ({
      sql: 'update t set a = ? where id = ?',
      args: [1, `id${i}`],
    }));
    await execBatched({ batch }, stmts);
    expect(batch).toHaveBeenCalledTimes(3); // 50 + 50 + 20
    expect(batch).toHaveBeenLastCalledWith(stmts.slice(100), 'write');

    await execBatched({ batch }, []);
    expect(batch).toHaveBeenCalledTimes(3);
  });

  it('retry chunk saat 429', async () => {
    const batch = vi.fn().mockRejectedValueOnce(http429).mockResolvedValue([]);
    await execBatched({ batch }, [{ sql: 'update t set a = 1', args: [] }]);
    expect(batch).toHaveBeenCalledTimes(2);
  });
});
