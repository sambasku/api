import { describe, expect, it, vi } from 'vitest';
import { ListPublishedJinyeUseCase } from '../../application/use-cases/list-published-jinye.use-case';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const WORD_ID = '01WORD00000000000000000001';

function makeJinye(overrides: Partial<Jinye> = {}): Jinye {
  return {
    id: '01JINYE0000000000000000001',
    userId: '01USER00000000000000000001',
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: null,
    body: 'aku makatn nasi',
    bodyOriginal: null,
    images: [],
    audio: null,
    repostOfId: null,
    quoteBody: null,
    status: 'published',
    publishedCommentCount: 0,
    repostCount: 0,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

describe('ListPublishedJinyeUseCase word_id', () => {
  it('filter by wordId tanpa pin profil', async () => {
    const items = [makeJinye()];
    const repo = {
      list: vi.fn(async () => ({
        items,
        nextCursor: null,
        hasMore: false,
      })),
      getPinnedJinyeId: vi.fn(),
      findById: vi.fn(),
      setPinnedJinyeId: vi.fn(),
    } as unknown as JinyeRepository;

    const out = await new ListPublishedJinyeUseCase(repo).execute({
      limit: 10,
      wordId: WORD_ID,
    });

    expect(repo.list).toHaveBeenCalledWith({
      limit: 10,
      cursor: undefined,
      wordId: WORD_ID,
      status: 'published',
    });
    expect(repo.getPinnedJinyeId).not.toHaveBeenCalled();
    expect(out.items).toHaveLength(1);
    expect(out.pinnedId).toBeNull();
  });
});
