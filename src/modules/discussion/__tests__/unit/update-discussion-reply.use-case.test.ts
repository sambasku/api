import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import { UpdateDiscussionReplyUseCase } from '../../application/use-cases/update-discussion-reply.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { DiscussionReply } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

vi.mock('@/modules/word/application/utils/assert-can-contribute', () => ({
  assertCanContribute: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/moderation/assert-ugc-text-quality-with-strike', () => ({
  assertUgcTextQualityWithStrike: vi.fn(async (text: string) => text),
}));

const REPLY_ID = '01JDREPLY00000000000000001';
const ACTOR = '01JDACTOR00000000000000001';
const OTHER = '01JDOTHER00000000000000001';

function makeReply(overrides: Partial<DiscussionReply> = {}): DiscussionReply {
  return {
    id: REPLY_ID,
    discussionId: '01JDDISC000000000000000001',
    userId: ACTOR,
    username: 'pembalas',
    displayName: 'Ani',
    avatarUrl: null,
    userRole: null,
    body: 'teks lama',
    bodyOriginal: null,
    audio: null,
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-24T01:00:00Z'),
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DiscussionRepository> = {}) {
  return {
    findReplyById: vi.fn().mockResolvedValue(makeReply()),
    updateReplyBodyWithRevision: vi.fn().mockImplementation(async () =>
      makeReply({ body: 'teks baru', isEdited: true, updatedAt: new Date() }),
    ),
    ...overrides,
  } as unknown as DiscussionRepository;
}

describe('UpdateDiscussionReplyUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bukan penulis → 403', async () => {
    const uc = new UpdateDiscussionReplyUseCase(
      makeRepo({
        findReplyById: vi.fn().mockResolvedValue(makeReply({ userId: OTHER })),
      }),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ replyId: REPLY_ID, actorId: ACTOR, body: 'baru' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('non-published → 404', async () => {
    const uc = new UpdateDiscussionReplyUseCase(
      makeRepo({
        findReplyById: vi.fn().mockResolvedValue(makeReply({ status: 'taken_down' })),
      }),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ replyId: REPLY_ID, actorId: ACTOR, body: 'baru' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('teks-only kosong → 400', async () => {
    const uc = new UpdateDiscussionReplyUseCase(
      makeRepo(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({ replyId: REPLY_ID, actorId: ACTOR, body: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('no-op: body sama → tanpa audit update', async () => {
    const audit = { record: vi.fn() };
    const updated = makeReply({ body: 'sama' });
    const uc = new UpdateDiscussionReplyUseCase(
      makeRepo({
        findReplyById: vi.fn().mockResolvedValue(makeReply({ body: 'sama' })),
        updateReplyBodyWithRevision: vi.fn().mockResolvedValue(updated),
      }),
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    const result = await uc.execute({
      replyId: REPLY_ID,
      actorId: ACTOR,
      body: 'sama',
    });
    expect(result.body).toBe('sama');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('ubah body → panggil repo revisi + audit', async () => {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const updateRevision = vi.fn().mockResolvedValue(
      makeReply({ body: 'teks baru', isEdited: true }),
    );
    const uc = new UpdateDiscussionReplyUseCase(
      makeRepo({ updateReplyBodyWithRevision: updateRevision }),
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await uc.execute({ replyId: REPLY_ID, actorId: ACTOR, body: 'teks baru' });
    expect(updateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        replyId: REPLY_ID,
        editorId: ACTOR,
        body: 'teks baru',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entityType: 'discussion_reply' }),
    );
  });
});
