import { describe, it, expect, vi } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { CreateDiscussionReplyAudioUseCase } from '../../application/use-cases/create-discussion-reply-audio.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion, DiscussionReply } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';
import type { PronunciationStoragePort } from '@/modules/word/application/ports/pronunciation-storage.port';

const DISCUSSION_ID = '01JDDISC000000000000000001';
const OWNER = '01JDOWNER00000000000000001';
const ACTOR = '01JDACTOR00000000000000001';
const REPLY_ID = '01JDREPLY00000000000000001';

/** Minimal valid WAV (RIFF....WAVE) for magic-byte check. */
function makeWavBytes(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes[0] = 0x52; // R
  bytes[1] = 0x49; // I
  bytes[2] = 0x46; // F
  bytes[3] = 0x46; // F
  bytes[8] = 0x57; // W
  bytes[9] = 0x41; // A
  bytes[10] = 0x56; // V
  bytes[11] = 0x45; // E
  return bytes;
}

function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: DISCUSSION_ID,
    userId: OWNER,
    username: 'pemilik',
    displayName: 'Pemilik Thread',
    body: 'Apa arti tulisan di papan pasar?',
    linkUrl: null,
    images: [],
    audio: null,
    status: 'published',
    rejectionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    pinnedReplyId: null,
    createdAt: new Date('2026-09-24T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeReply(overrides: Partial<DiscussionReply> = {}): DiscussionReply {
  return {
    id: REPLY_ID,
    discussionId: DISCUSSION_ID,
    userId: ACTOR,
    username: 'pembalas',
    displayName: 'Ani Warga',
    avatarUrl: null,
    userRole: 'contributor',
    body: '',
    bodyOriginal: null,
    audio: {
      url: 'https://cdn.example/a.wav',
      mimeType: 'audio/wav',
      fileSize: 64,
      durationMs: 1200,
      provider: 'github',
      providerFileId: `assets/audio/discussions/${DISCUSSION_ID}/x.wav`,
      sha: 'abc',
    },
    status: 'published',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-09-24T01:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DiscussionRepository> = {}) {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeDiscussion()),
    list: vi.fn(),
    updateStatus: vi.fn(),
    setPinnedReply: vi.fn(),
    createReply: vi.fn().mockResolvedValue(makeReply()),
    findReplyById: vi.fn().mockResolvedValue(makeReply()),
    listReplies: vi.fn(),
    listDistinctReplierUserIds: vi.fn().mockResolvedValue([OWNER]),
    markReplyDeletedByAuthor: vi.fn(),
    takedownReply: vi.fn(),
    ...overrides,
  } as unknown as DiscussionRepository;
}

function makeStorage(
  overrides: Partial<PronunciationStoragePort> = {},
): PronunciationStoragePort {
  return {
    providerName: 'github',
    upload: vi.fn().mockResolvedValue({
      path: `assets/audio/discussions/${DISCUSSION_ID}/x.wav`,
      url: 'https://cdn.example/a.wav',
      sha: 'abc',
      size: 64,
    }),
    delete: vi.fn(),
    ...overrides,
  };
}

describe('CreateDiscussionReplyAudioUseCase', () => {
  it('diskusi hilang → DISCUSSION_NOT_FOUND', async () => {
    const uc = new CreateDiscussionReplyAudioUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(null) }),
      makeStorage(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({
        discussionId: DISCUSSION_ID,
        userId: ACTOR,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('belum published → DISCUSSION_NOT_PUBLISHED', async () => {
    const uc = new CreateDiscussionReplyAudioUseCase(
      makeRepo({
        findById: vi.fn().mockResolvedValue(makeDiscussion({ status: 'pending_review' })),
      }),
      makeStorage(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({
        discussionId: DISCUSSION_ID,
        userId: ACTOR,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('caption terlalu panjang → ValidationError', async () => {
    const uc = new CreateDiscussionReplyAudioUseCase(
      makeRepo(),
      makeStorage(),
      { record: vi.fn() } as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
    );
    await expect(
      uc.execute({
        discussionId: DISCUSSION_ID,
        userId: ACTOR,
        bytes: makeWavBytes(),
        mimeType: 'audio/wav',
        body: 'a'.repeat(501),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('voice-only → upload + createReply + notify "mengirim rekaman suara"', async () => {
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: ACTOR,
        username: 'ani',
        displayName: 'Ani Warga',
      }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const storage = makeStorage();
    const repo = makeRepo();

    const uc = new CreateDiscussionReplyAudioUseCase(
      repo,
      storage,
      audit as unknown as AuditLogRepository,
      { listAllActiveWords: vi.fn().mockResolvedValue([]) } as unknown as CommentBlocklistRepository,
      userRepo as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );

    const result = await uc.execute({
      discussionId: DISCUSSION_ID,
      userId: ACTOR,
      bytes: makeWavBytes(),
      mimeType: 'audio/wav',
      durationMs: 1200,
    });

    expect(result.id).toBe(REPLY_ID);
    expect(storage.upload).toHaveBeenCalled();
    expect(repo.createReply).toHaveBeenCalledWith(
      expect.objectContaining({
        discussionId: DISCUSSION_ID,
        userId: ACTOR,
        body: '',
        audio: expect.objectContaining({
          url: 'https://cdn.example/a.wav',
          mimeType: 'audio/wav',
        }),
      }),
    );
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER,
        body: expect.stringContaining('mengirim rekaman suara'),
      }),
    );
  });
});
