import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotFoundError, BadRequestError } from '@/shared/errors/app-error';
import { ApproveDiscussionUseCase } from '../../application/use-cases/approve-discussion.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';

const ID = '01JDHELPTRANSL0000000000000';
const USER = '01JDUSERKONTRIB0000000000A';
const ADMIN = '01JDADMINREVIEW00000000000';

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

const stagingImage = {
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
    body: 'Apa arti tulisan di papan ini?',
    linkUrl: null,
    images: [],
    audio: null,
    status: 'pending_review',
    rejectionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    pinnedReplyId: null,
    createdAt: new Date('2026-09-24T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DiscussionRepository> = {}) {
  return {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(makeHelp()),
    list: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(makeHelp({ status: 'published' })),
    setPinnedReply: vi.fn(),
    createReply: vi.fn(),
    findReplyById: vi.fn(),
    listReplies: vi.fn(),
    markReplyDeletedByAuthor: vi.fn(),
    takedownReply: vi.fn(),
    listDistinctReplierUserIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as DiscussionRepository;
}

function makePublicStorage() {
  return {
    providerName: 'github',
    upload: vi.fn().mockResolvedValue({
      path: 'assets/discussions/01.jpg',
      url: 'https://cdn.jsdelivr.net/gh/org/repo@main/assets/discussions/01.jpg',
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

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
}

function makeInbox() {
  return { execute: vi.fn().mockResolvedValue(undefined) } as unknown as RecordInboxNotificationUseCase;
}

describe('ApproveDiscussionUseCase', () => {
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

  it('id hilang → DISCUSSION_NOT_FOUND', async () => {
    const uc = new ApproveDiscussionUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(null) }),
      makePublicStorage(),
      makeImageStorage(),
      makeAudit(),
      makeInbox(),
    );
    await expect(
      uc.execute({ id: ID, actorId: ADMIN }),
    ).rejects.toMatchObject({ errorCode: 'DISCUSSION_NOT_FOUND' });
  });

  it('bukan pending_review → NOT_FOUND', async () => {
    const uc = new ApproveDiscussionUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(makeHelp({ status: 'published' })) }),
      makePublicStorage(),
      makeImageStorage(),
      makeAudit(),
      makeInbox(),
    );
    await expect(uc.execute({ id: ID, actorId: ADMIN })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('teks-only → status published tanpa upload/delete', async () => {
    const repo = makeRepo();
    const publicStorage = makePublicStorage();
    const imageStorage = makeImageStorage();
    const audit = makeAudit();
    const inbox = makeInbox();
    const uc = new ApproveDiscussionUseCase(
      repo,
      publicStorage,
      imageStorage,
      audit,
      inbox,
    );

    const row = await uc.execute({ id: ID, actorId: ADMIN });
    expect(row.status).toBe('published');
    expect(publicStorage.upload).not.toHaveBeenCalled();
    expect(imageStorage.deleteFile).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', entityType: 'discussion' }),
    );
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        type: 'discussion_approved',
        targetKind: 'discussion',
      }),
    );
  });

  it('dengan gambar + censored bytes → upload GitHub + delete ImageKit', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeHelp({ images: [stagingImage] })),
      updateStatus: vi.fn().mockResolvedValue(
        makeHelp({
          status: 'published',
          images: [
            {
              ...stagingImage,
              publicUrl:
                'https://cdn.jsdelivr.net/gh/org/repo@main/assets/discussions/01.jpg',
            },
          ],
        }),
      ),
    });
    const publicStorage = makePublicStorage();
    const imageStorage = makeImageStorage();
    const uc = new ApproveDiscussionUseCase(
      repo,
      publicStorage,
      imageStorage,
      makeAudit(),
      makeInbox(),
    );

    await uc.execute({
      id: ID,
      actorId: ADMIN,
      censoredFiles: [JPEG_BYTES],
      censoredMimeTypes: ['image/jpeg'],
    });

    expect(publicStorage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^assets\/discussions\//),
        mimeType: 'image/jpeg',
      }),
    );
    expect(imageStorage.deleteFile).toHaveBeenCalledWith('file_th_x');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('dengan gambar tanpa censored → fetch staging lalu promote', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeHelp({ images: [stagingImage] })),
      updateStatus: vi.fn().mockResolvedValue(makeHelp({ status: 'published' })),
    });
    const publicStorage = makePublicStorage();
    const imageStorage = makeImageStorage();
    const uc = new ApproveDiscussionUseCase(
      repo,
      publicStorage,
      imageStorage,
      makeAudit(),
      makeInbox(),
    );

    await uc.execute({ id: ID, actorId: ADMIN });

    expect(fetch).toHaveBeenCalledWith(
      stagingImage.url,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(publicStorage.upload).toHaveBeenCalled();
    expect(imageStorage.deleteFile).toHaveBeenCalledWith('file_th_x');
  });

  it('N=2 satu sensor + satu kekerasan → warnings tersimpan per indeks', async () => {
    const img0 = { ...stagingImage, providerFileId: 'file_0' };
    const img1 = {
      ...stagingImage,
      url: 'https://ik.imagekit.io/test/discussions/y.jpg',
      providerFileId: 'file_1',
    };
    const updateStatus = vi.fn().mockResolvedValue(makeHelp({ status: 'published' }));
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeHelp({ images: [img0, img1] })),
      updateStatus,
    });
    const publicStorage = makePublicStorage();
    const uc = new ApproveDiscussionUseCase(
      repo,
      publicStorage,
      makeImageStorage(),
      makeAudit(),
      makeInbox(),
    );

    await uc.execute({
      id: ID,
      actorId: ADMIN,
      censoredFiles: [JPEG_BYTES, new Uint8Array(0)],
      censoredMimeTypes: ['image/jpeg', null],
      imageContentWarnings: [[], ['kekerasan']],
    });

    expect(publicStorage.upload).toHaveBeenCalledTimes(2);
    expect(updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          expect.objectContaining({ contentWarnings: [], publicUrl: expect.any(String) }),
          expect.objectContaining({
            contentWarnings: ['kekerasan'],
            publicUrl: expect.any(String),
          }),
        ],
      }),
    );
  });

  it('content_warnings panjang ≠ N → VALIDATION_ERROR', async () => {
    const uc = new ApproveDiscussionUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(makeHelp({ images: [stagingImage] })) }),
      makePublicStorage(),
      makeImageStorage(),
      makeAudit(),
      makeInbox(),
    );
    await expect(
      uc.execute({
        id: ID,
        actorId: ADMIN,
        imageContentWarnings: [[], ['kekerasan']],
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('censored file invalid → VALIDATION_ERROR / BadRequest', async () => {
    const uc = new ApproveDiscussionUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(makeHelp({ images: [stagingImage] })) }),
      makePublicStorage(),
      makeImageStorage(),
      makeAudit(),
      makeInbox(),
    );
    await expect(
      uc.execute({
        id: ID,
        actorId: ADMIN,
        censoredFiles: [new Uint8Array([1, 2, 3])],
        censoredMimeTypes: ['image/jpeg'],
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
