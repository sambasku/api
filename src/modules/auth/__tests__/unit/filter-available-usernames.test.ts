import { describe, it, expect, vi } from 'vitest';
import { filterAvailableUsernames } from '../../infrastructure/filter-available-usernames';
import type { AppDatabase } from '@/shared/database/drizzle/client';

function mockDb(taken: string[], held: string[]) {
  const whereTaken = vi.fn().mockResolvedValue(taken.map((username) => ({ username })));
  const whereHeld = vi
    .fn()
    .mockResolvedValue(held.map((oldUsername) => ({ oldUsername })));
  const from = vi
    .fn()
    .mockReturnValueOnce({ where: whereTaken })
    .mockReturnValueOnce({ where: whereHeld });
  const select = vi.fn().mockReturnValue({ from });
  return { select } as unknown as AppDatabase;
}

describe('filterAvailableUsernames', () => {
  it('membuang kandidat yang sudah ada di users atau di-hold', async () => {
    const db = mockDb(['budi00', 'alif00'], ['sitiok']);

    const available = await filterAvailableUsernames(db, [
      'budi00',
      'budi00_google',
      'alif00',
      'sitiok',
      'wargaok',
    ]);

    expect(available).toEqual(['budi00_google', 'wargaok']);
  });

  it('mengembalikan semua bila belum ada yang diambil', async () => {
    const db = mockDb([], []);
    const available = await filterAvailableUsernames(db, ['sitiok', 'sitiok_google']);
    expect(available).toEqual(['sitiok', 'sitiok_google']);
  });

  it('dedupe + skip string kosong', async () => {
    const db = mockDb([], []);
    const available = await filterAvailableUsernames(db, ['sitiok', '', 'sitiok']);
    expect(available).toEqual(['sitiok']);
  });
});
