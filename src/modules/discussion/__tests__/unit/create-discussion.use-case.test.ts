import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import { CreateDiscussionUseCase } from '../../application/use-cases/create-discussion.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { discussionUploadTokenQuerySchema } from '../../presentation/v1/validators/discussion.validator';

const ID = '01JDHELPTRANSL0000000000000';
const USER = '01JDUSERKONTRIB0000000000A';

/** Minimal valid 1x1 JPEG */
const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4, 0x00, 0x14,
  0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
]);

const PUBLIC_URL =
  'https://cdn.jsdelivr.net/gh/org/repo@main/assets/discussions/01.jpg';

const image = {
  url: 'https://ik.imagekit.io/test/discussions/x.jpg',
  providerFileId: 'file_th_x',
  publicUrl: null as string | null,
  contentWarnings: [] as string[],
};

function makeHelp(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: ID,
    userId: USER,
    username: 'peminta',
    displayName: 'peminta',
    avatarUrl: null,
    userRole: null,
    body: 'Apa arti tulisan di papan ini?',
    bodyOriginal: null,
    linkUrl: null,
    images: [],
    audio: null,
    status: 'published',
    rejectionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    pinnedReplyId: null,
    lastReplyAt: null,
    publishedReplyCount: 0,
    createdAt: new Date('2026-09-24T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DiscussionRepository> = {}) {
  return {
    create: vi.fn().mockResolvedValue(makeHelp()),
    findById: vi.fn(),
    list: vi.fn(),
    updateStatus: vi.fn(),
    setPinnedReply: vi.fn(),
    createReply: vi.fn(),
    findReplyById: vi.fn(),
    listReplies: vi.fn(),
    markReplyDeletedByAuthor: vi.fn(),
    markDiscussionDeletedByAuthor: vi.fn(),
    updateDiscussionBodyWithRevision: vi.fn(),
    listDiscussionRevisions: vi.fn().mockResolvedValue([]),
    takedownReply: vi.fn(),
    listDistinctReplierUserIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as DiscussionRepository;
}

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
}

function makePublicStorage() {
  return {
    providerName: 'github',
    upload: vi.fn().mockResolvedValue({
      path: 'assets/discussions/01.jpg',
      url: PUBLIC_URL,
      sha: 'abc',
      size: 100,
    }),
    delete: vi.fn(),
  } as unknown as PublicImageStoragePort;
}

function makeImageStorage() {
  return {
    providerName: 'imagekit',
    createUploadCredentials: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  } as unknown as ImageStoragePort;
}

function makeUc(
  repo = makeRepo(),
  audit = makeAudit(),
  publicStorage = makePublicStorage(),
  imageStorage = makeImageStorage(),
  activityEvents?: Pick<RecordActivityEventUseCase, 'safe'>,
) {
  return {
    repo,
    audit,
    publicStorage,
    imageStorage,
    activityEvents,
    uc: new CreateDiscussionUseCase(
      repo,
      audit,
      publicStorage,
      imageStorage,
      activityEvents,
    ),
  };
}

describe('discussionUploadTokenQuerySchema', () => {
  it('folder selain /discussions → gagal', () => {
    const parsed = discussionUploadTokenQuerySchema.safeParse({ folder: '/bug-reports' });
    expect(parsed.success).toBe(false);
  });

  it('folder /discussions → lolos', () => {
    const parsed = discussionUploadTokenQuerySchema.safeParse({
      folder: '/discussions',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('CreateDiscussionUseCase', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => JPEG_BYTES.buffer.slice(0),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tanpa body → VALIDATION_ERROR', async () => {
    const { uc } = makeUc();
    await expect(
      uc.execute({ userId: USER, body: '   ', images: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('body > 1000 → VALIDATION_ERROR', async () => {
    const { uc } = makeUc();
    await expect(
      uc.execute({ userId: USER, body: 'a'.repeat(1001), images: [] }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('images 5 item → VALIDATION_ERROR', async () => {
    const { uc } = makeUc();
    await expect(
      uc.execute({
        userId: USER,
        body: 'Deskripsi wajib',
        linkUrl: null,
        images: [image, image, image, image, image],
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('teks saja → create published + activity + audit, tanpa blast moderasi', async () => {
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const { uc, repo, audit, publicStorage, imageStorage } = makeUc(
      makeRepo(),
      makeAudit(),
      makePublicStorage(),
      makeImageStorage(),
      activityEvents,
    );
    await uc.execute({
      userId: USER,
      body: 'Apa arti tulisan di papan ini?',
      linkUrl: null,
      images: [],
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        body: 'Apa arti tulisan di papan ini?',
        linkUrl: null,
        images: [],
      }),
    );
    expect(publicStorage.upload).not.toHaveBeenCalled();
    expect(imageStorage.deleteFile).not.toHaveBeenCalled();
    expect(activityEvents.safe).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'discussion_created',
        actorId: USER,
        targetId: ID,
        dedupeKey: `discussion:${ID}`,
        payload: 'Apa arti tulisan di papan ini?',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        action: 'create',
        entityType: 'discussion',
        newData: expect.objectContaining({ status: 'published' }),
      }),
    );
  });

  it('gambar → promote lalu create dengan publicUrl', async () => {
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const { uc, repo, publicStorage, imageStorage } = makeUc(
      makeRepo(),
      makeAudit(),
      makePublicStorage(),
      makeImageStorage(),
      activityEvents,
    );
    await uc.execute({
      userId: USER,
      body: 'Tolong jelaskan foto ini',
      images: [image],
    });
    expect(publicStorage.upload).toHaveBeenCalledTimes(1);
    expect(imageStorage.deleteFile).toHaveBeenCalledWith('file_th_x');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Tolong jelaskan foto ini',
        images: [
          expect.objectContaining({
            url: image.url,
            providerFileId: image.providerFileId,
            publicUrl: PUBLIC_URL,
          }),
        ],
      }),
    );
    expect(activityEvents.safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'discussion_created', actorId: USER }),
    );
  });

  it('gambar saja (tanpa body) → VALIDATION_ERROR', async () => {
    const { uc } = makeUc();
    await expect(
      uc.execute({ userId: USER, body: '', images: [image] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('link http (bukan https) → VALIDATION_ERROR', async () => {
    const { uc } = makeUc();
    await expect(
      uc.execute({
        userId: USER,
        body: 'Lihat tautan ini',
        linkUrl: 'http://example.com/x',
        images: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('link https → tersimpan', async () => {
    const { uc, repo } = makeUc();
    await uc.execute({
      userId: USER,
      body: 'Lihat tautan ini',
      linkUrl: 'https://example.com/artikel',
      images: [],
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Lihat tautan ini',
        linkUrl: 'https://example.com/artikel',
      }),
    );
  });
});
