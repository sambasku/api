import { describe, expect, it, vi } from 'vitest';
vi.mock('@/shared/logging/logger', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { isWaNotifyEnabled } from '../../application/wa-notify-gate';

function repo(value: string | null | Error) {
  return {
    getValue: vi.fn(async () => {
      if (value instanceof Error) throw value;
      return value;
    }),
  };
}

describe('isWaNotifyEnabled', () => {
  it.each(['true', 'TRUE', ' True '])('true untuk %j', async (v) => {
    expect(await isWaNotifyEnabled(repo(v))).toBe(true);
  });

  it.each(['false', 'FALSE', '1', 'yes', 'on', ''])('false untuk %j', async (v) => {
    expect(await isWaNotifyEnabled(repo(v))).toBe(false);
  });

  it('false bila baris belum ada (migration belum jalan)', async () => {
    expect(await isWaNotifyEnabled(repo(null))).toBe(false);
  });

  it('false (fail-closed) bila query settings error, tidak melempar', async () => {
    expect(await isWaNotifyEnabled(repo(new Error('db down')))).toBe(false);
  });

  it('membaca key wa_group_notify_enabled', async () => {
    const r = repo('true');
    await isWaNotifyEnabled(r);
    expect(r.getValue).toHaveBeenCalledWith('wa_group_notify_enabled');
  });
});
