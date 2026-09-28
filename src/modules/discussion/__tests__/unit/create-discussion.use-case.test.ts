import { describe, it, expect, vi } from 'vitest';
import { ValidationError } from '@/shared/errors/app-error';
import { CreateDiscussionUseCase } from '../../application/use-cases/create-discussion.use-case';
import type { DiscussionRepository } from '../../domain/repositories/discussion.repository';
import type { Discussion } from '../../domain/entities/discussion.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { discussionUploadTokenQuerySchema } from '../../presentation/v1/validators/discussion.validator';

const ID = '01JDHELPTRANSL0000000000000';
const USER = '01JDUSERKONTRIB0000000000A';

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
    body: 'Apa arti tulisan di papan ini?',
    linkUrl: null,
    images: [],
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
    create: vi.fn().mockResolvedValue(makeHelp()),
    findById: vi.fn(),
    list: vi.fn(),
    updateStatus: vi.fn(),
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

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogRepository;
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
  it('tanpa body → VALIDATION_ERROR', async () => {
    const uc = new CreateDiscussionUseCase(makeRepo(), makeAudit());
    await expect(
      uc.execute({ userId: USER, body: '   ', images: [] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('body > 1000 → VALIDATION_ERROR', async () => {
    const uc = new CreateDiscussionUseCase(makeRepo(), makeAudit());
    await expect(
      uc.execute({ userId: USER, body: 'a'.repeat(1001), images: [] }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('images 5 item → VALIDATION_ERROR', async () => {
    const uc = new CreateDiscussionUseCase(makeRepo(), makeAudit());
    await expect(
      uc.execute({
        userId: USER,
        body: 'Deskripsi wajib',
        linkUrl: null,
        images: [image, image, image, image, image],
      }),
    ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('teks saja → create pending_review + audit', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const uc = new CreateDiscussionUseCase(repo, audit);
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
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        action: 'create',
        entityType: 'discussion',
      }),
    );
  });

  it('create → blast inbox+push ke verifikator, skip penulis', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const MOD_A = '01JDMODERATORAAAA000000000A';
    const MOD_B = '01JDMODERATORBBBB000000000B';
    const userRepo = {
      listActiveIdsByRoles: vi.fn().mockResolvedValue([MOD_A, MOD_B, USER]),
    };
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreateDiscussionUseCase(
      repo,
      audit,
      userRepo as never,
      inbox as never,
      notifyUser as never,
    );
    await uc.execute({
      userId: USER,
      body: 'Apa arti tulisan di papan ini?',
      images: [],
    });

    expect(userRepo.listActiveIdsByRoles).toHaveBeenCalledWith([
      'reviewer',
      'admin',
      'root',
      'editor',
    ]);
    expect(inbox.execute).toHaveBeenCalledTimes(2);
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOD_A,
        type: 'discussion_pending_review',
        targetKind: 'discussion',
        targetId: ID,
        actorId: USER,
        actionKind: 'discussion',
        actionValue: ID,
      }),
    );
    expect(inbox.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: MOD_B }),
    );
    expect(inbox.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER }),
    );
    expect(notifyUser.execute).toHaveBeenCalledTimes(2);
    expect(notifyUser.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOD_A,
        title: 'Diskusi menunggu tinjauan',
        data: expect.objectContaining({
          type: 'discussion_pending_review',
          target_id: ID,
        }),
      }),
    );
  });

  it('gambar saja (tanpa body) → VALIDATION_ERROR', async () => {
    const uc = new CreateDiscussionUseCase(makeRepo(), makeAudit());
    await expect(
      uc.execute({ userId: USER, body: '', images: [image] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('deskripsi + gambar → lolos', async () => {
    const repo = makeRepo();
    const uc = new CreateDiscussionUseCase(repo, makeAudit());
    await uc.execute({ userId: USER, body: 'Tolong jelaskan foto ini', images: [image] });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Tolong jelaskan foto ini',
        linkUrl: null,
        images: [expect.objectContaining({ url: image.url })],
      }),
    );
  });

  it('link http (bukan https) → VALIDATION_ERROR', async () => {
    const uc = new CreateDiscussionUseCase(makeRepo(), makeAudit());
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
    const repo = makeRepo();
    const uc = new CreateDiscussionUseCase(repo, makeAudit());
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
