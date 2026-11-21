import { describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { KreatorRepositoryImpl } from '../../infrastructure/kreator.repository.impl';

describe('KreatorRepositoryImpl.findOrCreateKreator', () => {
  it('match by lowered display name tanpa insert baru', async () => {
    const existing = {
      id: '01KREATOR01',
      slug: 'budi-santoso',
      displayName: 'Budi Santoso',
      kind: 'person' as const,
      bio: null,
      originRegion: null,
      linksJson: '[]',
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    };
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existing]),
          }),
        }),
      }),
    } as unknown as AppDatabase;
    const repo = new KreatorRepositoryImpl(db);
    const row = await repo.findOrCreateKreator('  budi santoso ');
    expect(row.id).toBe('01KREATOR01');
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});