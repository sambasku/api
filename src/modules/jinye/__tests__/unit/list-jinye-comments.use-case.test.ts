import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@/shared/errors/app-error';
import { ListJinyeCommentsUseCase } from '../../application/use-cases/list-jinye-comments.use-case';
import type { Jinye, JinyeComment } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

const JINYE_ID = '01JINYE0000000000000000001';

function makeJinye(): Jinye {
  return {
    id: JINYE_ID,
    userId: '01ACTORJINYE00000000000000',
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'halo',
    bodyOriginal: null,
    images: [],
    audio: null,
    repostOfId: null,
    quoteBody: null,
    status: 'published',
    publishedCommentCount: 0,
    repostCount: 0,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: null,
  };
}

function makeComment(
  id: string,
  createdAt: string,
  overrides: Partial<JinyeComment> = {},
): JinyeComment {
  return {
    id,
    jinyeId: JINYE_ID,
    parentId: null,
    userId: '01ACTORJINYE00000000000000',
    username: 'aji',
    displayName: 'Aji',
    avatarUrl: null,
    userRole: 'contributor',
    body: `body-${id}`,
    bodyOriginal: null,
    stickerId: null,
    images: [],
    status: 'published',
    createdAt: new Date(createdAt),
    updatedAt: null,
    ...overrides,
  };
}

describe('ListJinyeCommentsUseCase', () => {
  it('urutkan top-level terbaru di atas; balasan kronologis naik', async () => {
    const parentOld = makeComment('01PARENTOLD00000000000001', '2026-01-01T10:00:00Z');
    const parentNew = makeComment('01PARENTNEW00000000000002', '2026-01-02T10:00:00Z');
    const replyLate = makeComment('01REPLYLATE00000000000003', '2026-01-01T11:00:00Z', {
      parentId: parentOld.id,
    });
    const replyEarly = makeComment('01REPLYEARLY0000000000004', '2026-01-01T10:30:00Z', {
      parentId: parentOld.id,
    });

    // Urutan datar sengaja acak (seperti bisa datang dari query DESC).
    const flat = [replyLate, parentNew, replyEarly, parentOld];

    const repo: JinyeRepository = {
      findById: vi.fn(async () => makeJinye()),
      listCommentsByJinyeId: vi.fn(async () => flat),
    } as unknown as JinyeRepository;

    const useCase = new ListJinyeCommentsUseCase(repo);
    const tops = await useCase.execute(JINYE_ID);

    expect(tops.map((c) => c.id)).toEqual([parentNew.id, parentOld.id]);
    const oldParent = tops.find((c) => c.id === parentOld.id);
    expect(oldParent?.replies?.map((r) => r.id)).toEqual([replyEarly.id, replyLate.id]);
  });

  it('lempar JINYE_NOT_FOUND jika Jinye tidak published', async () => {
    const repo: JinyeRepository = {
      findById: vi.fn(async () => null),
      listCommentsByJinyeId: vi.fn(),
    } as unknown as JinyeRepository;

    const useCase = new ListJinyeCommentsUseCase(repo);
    await expect(useCase.execute(JINYE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});