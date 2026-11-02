import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { UpdateCommentUseCase } from '../../application/use-cases/update-comment.use-case';
import type { Comment } from '../../domain/entities/comment.entity';
import type { CommentRepository } from '../../domain/repositories/comment.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn(async (text: string) => text),
}));

const COMMENT_ID = '01JDCOMMENTMAKATN00000000A';
const WORD = '01JDWORDMAKATN0000000000A';
const AUTHOR = '01JDUSERAUTHOR00000000000A';
const ADMIN = '01JDUSERADMIN000000000000A';
const OTHER = '01JDUSEROTHER000000000000A';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: COMMENT_ID,
    wordId: WORD,
    wordLemma: 'makatn',
    userId: AUTHOR,
    username: 'budi',
    displayName: 'budi',
    avatarUrl: null,
    userRole: 'contributor',
    body: 'teks lama',
    bodyOriginal: null,
    audio: null,
    image: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-18T10:00:00Z'),
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

function makeWordRepo(overrides: Partial<WordRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue({
      id: WORD,
      status: 'published',
      lemma: 'makatn',
      createdBy: null,
    }),
    ...overrides,
  } as unknown as WordRepository;
}

function makeRepo(overrides: Partial<CommentRepository> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(makeComment()),
    updateBodyWithRevision: vi.fn().mockImplementation(async () =>
      makeComment({ body: 'teks baru', isEdited: true, updatedAt: new Date() }),
    ),
    ...overrides,
  } as unknown as CommentRepository;
}

describe('UpdateCommentUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bukan penulis → 403', async () => {
    const uc = new UpdateCommentUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makeComment({ userId: OTHER })),
      }),
      makeWordRepo(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ commentId: COMMENT_ID, actorId: AUTHOR, body: 'baru' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('admin bukan penulis → 403', async () => {
    const uc = new UpdateCommentUseCase(
      makeRepo(),
      makeWordRepo(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ commentId: COMMENT_ID, actorId: ADMIN, body: 'baru' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-published → 404', async () => {
    const uc = new UpdateCommentUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makeComment({ status: 'taken_down' })),
      }),
      makeWordRepo(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ commentId: COMMENT_ID, actorId: AUTHOR, body: 'baru' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('teks-only kosong → 400', async () => {
    const uc = new UpdateCommentUseCase(
      makeRepo(),
      makeWordRepo(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ commentId: COMMENT_ID, actorId: AUTHOR, body: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('voice-only: body kosong OK', async () => {
    const updateRevision = vi.fn().mockResolvedValue(
      makeComment({ body: '', audio: { url: 'https://x/a.mp3', mimeType: 'audio/mpeg', fileSize: 1, durationMs: null, provider: 'gh', providerFileId: 'f', sha: null } }),
    );
    const uc = new UpdateCommentUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(
          makeComment({
            body: '',
            audio: {
              url: 'https://x/a.mp3',
              mimeType: 'audio/mpeg',
              fileSize: 1,
              durationMs: null,
              provider: 'gh',
              providerFileId: 'f',
              sha: null,
            },
          }),
        ),
        updateBodyWithRevision: updateRevision,
      }),
      makeWordRepo(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await uc.execute({ commentId: COMMENT_ID, actorId: AUTHOR, body: '   ' });
    expect(updateRevision).toHaveBeenCalled();
  });

  it('no-op: body sama → tanpa audit update', async () => {
    const audit = { record: vi.fn() };
    const updated = makeComment({ body: 'sama' });
    const uc = new UpdateCommentUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makeComment({ body: 'sama' })),
        updateBodyWithRevision: vi.fn().mockResolvedValue(updated),
      }),
      makeWordRepo(),
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    const result = await uc.execute({
      commentId: COMMENT_ID,
      actorId: AUTHOR,
      body: 'sama',
    });
    expect(result.body).toBe('sama');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('ubah body → panggil repo revisi + audit', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const updateRevision = vi.fn().mockResolvedValue(
      makeComment({ body: 'teks baru', isEdited: true }),
    );
    const uc = new UpdateCommentUseCase(
      makeRepo({ updateBodyWithRevision: updateRevision }),
      makeWordRepo(),
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await uc.execute({ commentId: COMMENT_ID, actorId: AUTHOR, body: 'teks baru' });
    expect(updateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: COMMENT_ID,
        editorId: AUTHOR,
        body: 'teks baru',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entityType: 'comment' }),
    );
  });
});
