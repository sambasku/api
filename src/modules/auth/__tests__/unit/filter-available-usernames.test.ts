import { describe, it, expect, vi } from 'vitest';
import { filterAvailableUsernames } from '../../infrastructure/filter-available-usernames';
import type { AppDatabase } from '@/shared/database/drizzle/client';

describe('filterAvailableUsernames', () => {
  it('membuang kandidat yang sudah ada di DB (satu SELECT batch)', async () => {
    const where = vi.fn().mockResolvedValue([{ username: 'budi00' }, { username: 'alif00' }]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as AppDatabase;

    const available = await filterAvailableUsernames(db, [
      'budi00',
      'budi00_google',
      'alif00',
      'sitiok',
    ]);

    expect(select).toHaveBeenCalledTimes(1);
    expect(available).toEqual(['budi00_google', 'sitiok']);
  });

  it('mengembalikan semua bila belum ada yang diambil', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as AppDatabase;

    const available = await filterAvailableUsernames(db, ['sitiok', 'sitiok_google']);
    expect(available).toEqual(['sitiok', 'sitiok_google']);
  });

  it('dedupe + skip string kosong', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as unknown as AppDatabase;

    const available = await filterAvailableUsernames(db, ['sitiok', '', 'sitiok']);
    expect(available).toEqual(['sitiok']);
  });
});
