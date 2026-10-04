import { describe, it, expect, vi } from 'vitest';
import { GetPublicActivityUseCase } from '../../application/use-cases/get-public-activity.use-case';
import { NotFoundError } from '@/shared/errors/app-error';
import type { PublicActivityPage } from '../../domain/entities/public-profile.entity';
import type { PublicUserRepository } from '../../domain/repositories/public-user.repository';

/** Helper: bungkus item jadi halaman repo (tanpa cursor). */
const pageOf = (items: unknown[]): PublicActivityPage =>
  ({ items, nextCursor: null, hasMore: false }) as PublicActivityPage;

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
      listRecentApprovedContributions: vi.fn().mockResolvedValue(
        pageOf([
          {
            kind: 'contribution',
            id: '01CONTRIB00000000000000001',
            occurredAt: new Date(now - 1000),
            wordId: 'w1',
            lemma: 'makatn',
            summary: 'Kata: makatn',
          },
        ]),
      ),
      listRecentPublishedComments: vi.fn().mockResolvedValue(
        pageOf([
          {
            kind: 'comment',
            id: '01COMMENT000000000000000001',
            occurredAt: new Date(now),
            wordId: 'w1',
            lemma: 'makatn',
            summary: 'komentar baru',
          },
        ]),
      ),
      listRecentVerifications: vi.fn().mockResolvedValue(
        pageOf([
          {
            kind: 'verification',
            id: '01VERIFI000000000000000001',
            occurredAt: new Date(now - 500),
            wordId: 'w2',
            lemma: 'nasi',
            summary: 'Memverifikasi Kata: nasi',
          },
        ]),
      ),
      listRecentVotes: vi.fn().mockResolvedValue(
        pageOf([
          {
            kind: 'vote',
            id: '01VOTE000000000000000000001',
            occurredAt: new Date(now - 2000),
            wordId: 'w2',
            lemma: 'nasi',
            summary: '"nasi" perlu dicek ulang',
          },
        ]),
      ),
    } as unknown as PublicUserRepository;

    const page = await new GetPublicActivityUseCase(repo).execute('budi');
    expect(page.items).toHaveLength(4);
    expect(page.items.map((i) => i.kind)).toEqual([
      'comment',
      'verification',
      'contribution',
      'vote',
    ]);
    // Mode merge tanpa cursor.
    expect(page.nextCursor).toBeUndefined();
  });

  it('mode terfilter: teruskan limit + cursor ke repo, kembalikan meta cursor', async () => {
    const repo = {
      findPublicByUsername: vi.fn().mockResolvedValue({
        id: 'u1',
        username: 'budi',
        role: 'contributor',
        joinedAt: new Date(),
        avatarUrl: null,
      }),
      listRecentPublishedComments: vi.fn().mockResolvedValue(
        pageOf([
          {
            kind: 'comment',
            id: '01COMMENT000000000000000001',
            occurredAt: new Date(),
            wordId: 'w1',
            lemma: 'makatn',
            summary: 'komentar baru',
          },
        ]),
      ),
    } as unknown as PublicUserRepository;

    const result = await new GetPublicActivityUseCase(repo).execute('budi', {
      kind: 'comment',
      limit: 20,
      cursor: '01COMMENT000000000000000000',
    });

    expect(repo.listRecentPublishedComments).toHaveBeenCalledWith('u1', {
      limit: 20,
      cursor: '01COMMENT000000000000000000',
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
