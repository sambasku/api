import { describe, it, expect, vi } from 'vitest';
import { DeletePantunReplyUseCase } from '../../application/use-cases/delete-pantun-reply.use-case';
import { ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { PantunReply } from '../../domain/entities/pantun.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

const AUTHOR = '01JDAUTHOR0000000000000001';
const OTHER = '01JDOTHER00000000000000001';
const REPLY_ID = '01JDREPLY0000000000000001';

function makeReply(overrides: Partial<PantunReply> = {}): PantunReply {
  return {
    id: REPLY_ID,
    parentId: '01JDPANTUN0000000000000001',
    userId: AUTHOR,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    categoryId: null,
    language: 'id',
    rhymeScheme: 'ABAB',
    lines: ['satu', 'dua', 'tiga', 'empat'],
    status: 'published',
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<PantunRepository> = {}) {
  return {
    findReplyById: vi.fn().mockResolvedValue(makeReply()),
    markReplyDeletedByAuthor: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as PantunRepository;
}

const audit = {
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
} as unknown as AuditLogRepository;

describe('DeletePantunReplyUseCase', () => {
  it('penulis menghapus balasan sendiri → soft delete + audit', async () => {
    const repo = makeRepo();
    await new DeletePantunReplyUseCase(repo, audit).execute({
      replyId: REPLY_ID,
      actorId: AUTHOR,
    });

    expect(repo.markReplyDeletedByAuthor).toHaveBeenCalledWith(REPLY_ID, AUTHOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete',
        entityType: 'pantun_reply',
        newData: { status: 'deleted_by_author' },
      }),
    );
  });

  it('bukan penulis → ForbiddenError, bukan 404', async () => {
    const repo = makeRepo();
    const promise = new DeletePantunReplyUseCase(repo, audit).execute({
      replyId: REPLY_ID,
      actorId: OTHER,
    });

    await expect(promise).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.markReplyDeletedByAuthor).not.toHaveBeenCalled();
  });

  it('balasan tidak ada / sudah tidak tayang → NotFoundError', async () => {
    const missing = new DeletePantunReplyUseCase(
      makeRepo({ findReplyById: vi.fn().mockResolvedValue(null) }),
      audit,
    );
    await expect(
      missing.execute({ replyId: REPLY_ID, actorId: AUTHOR }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const deleted = new DeletePantunReplyUseCase(
      makeRepo({
        findReplyById: vi
          .fn()
          .mockResolvedValue(makeReply({ status: 'deleted_by_author' })),
      }),
      audit,
    );
    await expect(
      deleted.execute({ replyId: REPLY_ID, actorId: AUTHOR }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
