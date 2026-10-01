import { describe, it, expect, vi } from 'vitest';
import { GetPublicActivityUseCase } from '../../application/use-cases/get-public-activity.use-case';
import { NotFoundError } from '@/shared/errors/app-error';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';

describe('GetPublicActivityUseCase', () => {
  it('404 jika user tidak ada', async () => {
    const repo = {
      findPublicByUsername: vi.fn().mockResolvedValue(null),
    } as unknown as PublicUserRepository;
    const uc = new GetPublicActivityUseCase(repo);
    await expect(uc.execute('tidakada')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('merge 4 sumber, urut occurred_at desc, potong 20', async () => {
    const now = Date.now();
    const repo = {
      findPublicByUsername: vi.fn().mockResolvedValue({
        id: 'u1',
        username: 'budi',
        role: 'contributor',
        joinedAt: new Date(),
        avatarUrl: null,
      }),
      listRecentApprovedContributions: vi.fn().mockResolvedValue([
        {
          kind: 'contribution',
          occurredAt: new Date(now - 1000),
          wordId: 'w1',
          lemma: 'makatn',
          summary: 'Kata: makatn',
        },
      ]),
      listRecentPublishedComments: vi.fn().mockResolvedValue([
        {
          kind: 'comment',
          occurredAt: new Date(now),
          wordId: 'w1',
          lemma: 'makatn',
          summary: 'komentar baru',
        },
      ]),
      listRecentVerifications: vi.fn().mockResolvedValue([
        {
          kind: 'verification',
          occurredAt: new Date(now - 500),
          wordId: 'w2',
          lemma: 'nasi',
          summary: 'Memverifikasi Kata: nasi',
        },
      ]),
      listRecentVotes: vi.fn().mockResolvedValue([
        {
          kind: 'vote',
          occurredAt: new Date(now - 2000),
          wordId: 'w2',
          lemma: 'nasi',
          summary: '"nasi" perlu dicek ulang',
        },
      ]),
    } as unknown as PublicUserRepository;
    const items = await new GetPublicActivityUseCase(repo).execute('budi');
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.kind)).toEqual([
      'comment',
      'verification',
      'contribution',
      'vote',
    ]);
  });
});
