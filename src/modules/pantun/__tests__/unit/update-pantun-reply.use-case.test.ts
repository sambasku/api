import { describe, it, expect, vi } from 'vitest';
import { UpdatePantunReplyUseCase } from '../../application/use-cases/update-pantun-reply.use-case';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { PantunReply } from '../../domain/entities/pantun.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

const AUTHOR = '01JDAUTHOR0000000000000001';
const OTHER = '01JDOTHER00000000000000001';
const REPLY_ID = '01JDREPLY0000000000000001';

const LINES = ['Pergi berjalan ke Sambas', 'Membeli ikan di pasar', 'Pulang bawa rumbas', 'Hatiku girang bersinar'];
const NEW_LINES = ['Pergi ke pantai Sambas', 'Membeli ikan di pasar', 'Pulang bawa rumbas', 'Hatiku girang bersinar'];

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
    lines: LINES,
    status: 'published',
    isEdited: false,
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<PantunRepository> = {}) {
  return {
    findReplyById: vi.fn().mockResolvedValue(makeReply()),
    updateReplyWithRevision: vi.fn().mockResolvedValue(
      makeReply({ lines: NEW_LINES, isEdited: true, updatedAt: new Date() }),
    ),
    ...overrides,
  } as unknown as PantunRepository;
}

const audit = {
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
} as unknown as AuditLogRepository;

const blocklist = {
  listAllActiveWords: vi.fn().mockResolvedValue([]),
} as unknown as CommentBlocklistRepository;

describe('UpdatePantunReplyUseCase', () => {
  it('penulis mengedit balasan → revision + audit', async () => {
    const repo = makeRepo();
    const result = await new UpdatePantunReplyUseCase(repo, audit, blocklist).execute({
      replyId: REPLY_ID,
      actorId: AUTHOR,
      lines: NEW_LINES,
      rhymeScheme: 'ABAB',
    });

    expect(repo.updateReplyWithRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        replyId: REPLY_ID,
        editorId: AUTHOR,
        previousLines: LINES,
        lines: NEW_LINES,
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entityType: 'pantun_reply' }),
    );
    expect(result.lines).toEqual(NEW_LINES);
  });

  it('bukan penulis → ForbiddenError', async () => {
    const repo = makeRepo();
    await expect(
      new UpdatePantunReplyUseCase(repo, audit, blocklist).execute({
        replyId: REPLY_ID,
        actorId: OTHER,
        lines: NEW_LINES,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.updateReplyWithRevision).not.toHaveBeenCalled();
  });

  it('balasan tidak tayang → NotFoundError', async () => {
    const repo = makeRepo({ findReplyById: vi.fn().mockResolvedValue(null) });
    await expect(
      new UpdatePantunReplyUseCase(repo, audit, blocklist).execute({
        replyId: REPLY_ID,
        actorId: AUTHOR,
        lines: NEW_LINES,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('blocklist → ValidationError (reject, bukan replace)', async () => {
    const repo = makeRepo();
    const bl = {
      listAllActiveWords: vi.fn().mockResolvedValue(['kata terlarang']),
    } as unknown as CommentBlocklistRepository;
    await expect(
      new UpdatePantunReplyUseCase(repo, audit, bl).execute({
        replyId: REPLY_ID,
        actorId: AUTHOR,
        lines: ['ada kata terlarang di sini', 'baris itok baris dua', 'mun kire kire capat nak bemenantu', 'terima lamaranku kalak tanggal dua'],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.updateReplyWithRevision).not.toHaveBeenCalled();
  });

  it('no-op isi sama → tanpa revision', async () => {
    const repo = makeRepo();
    await new UpdatePantunReplyUseCase(repo, audit, blocklist).execute({
      replyId: REPLY_ID,
      actorId: AUTHOR,
      lines: LINES,
      rhymeScheme: 'ABAB',
    });
    expect(repo.updateReplyWithRevision).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
