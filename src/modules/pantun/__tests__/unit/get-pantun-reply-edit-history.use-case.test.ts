import { describe, it, expect, vi } from 'vitest';
import { GetPantunReplyEditHistoryUseCase } from '../../application/use-cases/get-pantun-reply-edit-history.use-case';
import { NotFoundError } from '@/shared/errors/app-error';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { PantunReply } from '../../domain/entities/pantun.entity';

const REPLY_ID = '01JDREPLY0000000000000001';

function makeReply(overrides: Partial<PantunReply> = {}): PantunReply {
  return {
    id: REPLY_ID,
    parentId: '01JDPANTUN0000000000000001',
    userId: '01JDAUTHOR0000000000000001',
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    categoryId: null,
    language: 'id',
    rhymeScheme: 'ABAB',
    lines: ['a', 'b', 'c', 'd'],
    status: 'published',
    isEdited: true,
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: new Date('2026-10-26T00:00:00Z'),
    ...overrides,
  };
}

describe('GetPantunReplyEditHistoryUseCase', () => {
  it('published → current + revisions newest-first', async () => {
    const repo = {
      findReplyById: vi.fn().mockResolvedValue(makeReply()),
      listReplyRevisions: vi.fn().mockResolvedValue([
        {
          id: 'rev2',
          replyId: REPLY_ID,
          editorId: '01JDAUTHOR0000000000000001',
          rhymeScheme: 'ABAB',
          lines: ['lama', 'b', 'c', 'd'],
          createdAt: new Date('2026-10-26T12:00:00Z'),
        },
      ]),
    } as unknown as PantunRepository;

    const result = await new GetPantunReplyEditHistoryUseCase(repo).execute(REPLY_ID);

    expect(result.current.lines).toEqual(['a', 'b', 'c', 'd']);
    expect(result.revisions).toHaveLength(1);
    expect(result.revisions[0].lines[0]).toBe('lama');
  });

  it('taken_down → NotFoundError', async () => {
    const repo = {
      findReplyById: vi.fn().mockResolvedValue(makeReply({ status: 'taken_down' })),
      listReplyRevisions: vi.fn(),
    } as unknown as PantunRepository;

    await expect(
      new GetPantunReplyEditHistoryUseCase(repo).execute(REPLY_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.listReplyRevisions).not.toHaveBeenCalled();
  });
});
