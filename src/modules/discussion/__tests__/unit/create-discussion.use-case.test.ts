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
};

function makeHelp(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: ID,
    userId: USER,
    username: 'peminta',
    displayName: 'peminta',
    body: 'Apa arti tulisan di papan ini?',
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
  it('tanpa body dan tanpa gambar → VALIDATION_ERROR', async () => {
    const uc = new CreateDiscussionUseCase(makeRepo(), makeAudit());
    await expect(
      uc.execute({ userId: USER, body: null, images: [] }),
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
        body: null,
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
      images: [],
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        body: 'Apa arti tulisan di papan ini?',
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

  it('gambar saja (tanpa body) → lolos', async () => {
    const repo = makeRepo({
      create: vi.fn().mockResolvedValue(makeHelp({ body: null, images: [image] })),
    });
    const uc = new CreateDiscussionUseCase(repo, makeAudit());
    await uc.execute({ userId: USER, body: null, images: [image] });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: null, images: [expect.objectContaining({ url: image.url })] }),
    );
  });
});
