import { describe, it, expect, vi } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import {
  CreateKaryaCommentUseCase,
  DeleteKaryaCommentUseCase,
  ListKaryaCommentsUseCase,
  TakedownKaryaCommentUseCase,
  UpdateKaryaCommentUseCase,
} from '../../application/use-cases/karya-comment.use-cases';
import type { KaryaCommentRepository } from '../../domain/karya-comment';
import { toKaryaCommentWire } from '../../presentation/v1/karya-comment.controller';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

const KARYA_ID = '01KARYA000000000000000001';
const USER_ID = '01USER00000000000000000001';
const COMMENT_ID = '01COMMENT000000000000000001';

const baseComment = {
  id: COMMENT_ID,
  karyaId: KARYA_ID,
  userId: USER_ID,
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  userRole: null,
  authorDeletedAt: null,
  stickerId: null,
  audio: null,
  image: null,
  body: 'Komentar karya keren!',
  status: 'published' as const,
  isEdited: false,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  updatedAt: null,
};

type MockFn = ReturnType<typeof vi.fn>;

function makeRepo(over: Record<string, MockFn> = {}): KaryaCommentRepository {
  return {
    createComment: vi.fn().mockResolvedValue(baseComment),
    findCommentById: vi.fn().mockResolvedValue(baseComment),
    listComments: vi.fn().mockResolvedValue({ items: [baseComment], nextCursor: null, hasMore: false }),
    updateCommentWithRevision: vi.fn().mockResolvedValue(baseComment),
    markCommentDeletedByAuthor: vi.fn().mockResolvedValue(true),
    takedownComment: vi.fn().mockResolvedValue(true),
    karyaTargetExists: vi.fn().mockResolvedValue(true),
    ...over,
  } as unknown as KaryaCommentRepository;
}

function makeAudit(): AuditLogRepository {
  return { record: vi.fn() } as unknown as AuditLogRepository;
}

function makeBlocklist(words: string[] = []): CommentBlocklistRepository {
  return {
    listAllActiveWords: vi.fn().mockResolvedValue(words),
  } as unknown as CommentBlocklistRepository;
}

// ---------------------------------------------------------------- list

describe('ListKaryaCommentsUseCase', () => {
  it('memanggil repo.listComments dengan filter status published', async () => {
    const repo = makeRepo();
    const uc = new ListKaryaCommentsUseCase(repo);
    const result = await uc.execute(KARYA_ID, undefined, 20);
    expect(repo.listComments).toHaveBeenCalledWith(KARYA_ID, {
      status: 'published',
      cursor: undefined,
      limit: 20,
    });
    expect(result.items).toHaveLength(1);
  });

  it('meneruskan cursor ke repo', async () => {
    const repo = makeRepo();
    const uc = new ListKaryaCommentsUseCase(repo);
    await uc.execute(KARYA_ID, 'somecursor', 10);
    expect(repo.listComments).toHaveBeenCalledWith(KARYA_ID, {
      status: 'published',
      cursor: 'somecursor',
      limit: 10,
    });
  });
});

// ---------------------------------------------------------------- create

describe('CreateKaryaCommentUseCase', () => {
  it('membuat komentar dan emit activity event', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const blocklist = makeBlocklist();
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreateKaryaCommentUseCase(repo, audit, blocklist, undefined, activityEvents as never);

    const result = await uc.execute({ karyaId: KARYA_ID, userId: USER_ID, body: 'Komentar karya keren!' });
    expect(result.id).toBe(COMMENT_ID);
    expect(repo.createComment).toHaveBeenCalled();
    expect(activityEvents.safe).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'karya_comment_created',
      actorId: USER_ID,
      targetId: COMMENT_ID,
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      entityType: 'karya_comment',
    }));
  });

  it('lempar NotFoundError bila karya tidak ditemukan', async () => {
    const repo = makeRepo({ karyaTargetExists: vi.fn().mockResolvedValue(false) });
    const uc = new CreateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ karyaId: KARYA_ID, userId: USER_ID, body: 'Komentar karya keren!' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lempar ValidationError bila body kosong', async () => {
    const repo = makeRepo();
    const uc = new CreateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ karyaId: KARYA_ID, userId: USER_ID, body: '   ' }),
    ).rejects.toThrow(ValidationError);
  });

  it('lempar ValidationError bila body > 1000 karakter', async () => {
    const repo = makeRepo();
    const uc = new CreateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ karyaId: KARYA_ID, userId: USER_ID, body: 'a'.repeat(1001) }),
    ).rejects.toThrow(ValidationError);
  });

  it('terapkan blocklist dan simpan body_original', async () => {
    const repo = makeRepo({ createComment: vi.fn().mockImplementation(async (input) => ({ ...baseComment, ...input })) });
    const blocklist = makeBlocklist(['badword']);
    const uc = new CreateKaryaCommentUseCase(repo, makeAudit(), blocklist);
    await uc.execute({ karyaId: KARYA_ID, userId: USER_ID, body: 'Ini badword sekali' });
    const call = (repo.createComment as MockFn).mock.calls[0][0];
    expect(call.bodyOriginal).toBe('Ini badword sekali');
    expect(call.body).not.toContain('badword');
  });

  it('bodyOriginal null bila tidak ada kata terblokir', async () => {
    const repo = makeRepo({ createComment: vi.fn().mockImplementation(async (input) => ({ ...baseComment, ...input })) });
    const uc = new CreateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await uc.execute({ karyaId: KARYA_ID, userId: USER_ID, body: 'Komentar bersih' });
    const call = (repo.createComment as MockFn).mock.calls[0][0];
    expect(call.bodyOriginal).toBeNull();
  });
});

// ---------------------------------------------------------------- update

describe('UpdateKaryaCommentUseCase', () => {
  it('update komentar milik sendiri berhasil', async () => {
    const repo = makeRepo();
    const uc = new UpdateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    const result = await uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit komentar' });
    expect(repo.updateCommentWithRevision).toHaveBeenCalledWith(expect.objectContaining({
      commentId: COMMENT_ID,
      editorId: USER_ID,
    }));
    expect(result).toBeDefined();
  });

  it('lempar ForbiddenError bila bukan pemilik', async () => {
    const repo = makeRepo({ findCommentById: vi.fn().mockResolvedValue({ ...baseComment, userId: 'OTHER_USER' }) });
    const uc = new UpdateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('lempar NotFoundError bila komentar tidak ada', async () => {
    const repo = makeRepo({ findCommentById: vi.fn().mockResolvedValue(null) });
    const uc = new UpdateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lempar NotFoundError bila komentar sudah dihapus', async () => {
    const repo = makeRepo({
      findCommentById: vi.fn().mockResolvedValue({ ...baseComment, status: 'deleted_by_author' }),
    });
    const uc = new UpdateKaryaCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit' }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------- delete

describe('DeleteKaryaCommentUseCase', () => {
  it('hapus komentar berhasil', async () => {
    const repo = makeRepo();
    const uc = new DeleteKaryaCommentUseCase(repo);
    await expect(uc.execute(COMMENT_ID, USER_ID)).resolves.toBeUndefined();
    expect(repo.markCommentDeletedByAuthor).toHaveBeenCalledWith(COMMENT_ID, USER_ID);
  });

  it('lempar NotFoundError bila komentar tidak ada atau bukan miliknya', async () => {
    const repo = makeRepo({ markCommentDeletedByAuthor: vi.fn().mockResolvedValue(false) });
    const uc = new DeleteKaryaCommentUseCase(repo);
    await expect(uc.execute(COMMENT_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------- takedown

describe('TakedownKaryaCommentUseCase', () => {
  it('takedown berhasil dan tercatat di audit', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const uc = new TakedownKaryaCommentUseCase(repo, audit);
    await expect(uc.execute(COMMENT_ID, 'ADMIN1')).resolves.toBeUndefined();
    expect(repo.takedownComment).toHaveBeenCalledWith(COMMENT_ID, 'ADMIN1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'takedown',
      entityType: 'karya_comment',
      entityId: COMMENT_ID,
    }));
  });

  it('lempar NotFoundError bila komentar tidak ada', async () => {
    const repo = makeRepo({ takedownComment: vi.fn().mockResolvedValue(false) });
    const uc = new TakedownKaryaCommentUseCase(repo, makeAudit());
    await expect(uc.execute(COMMENT_ID, 'ADMIN1')).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------- wire

describe('toKaryaCommentWire', () => {
  it('is_verifier true untuk role admin/verifikator', () => {
    const wire = toKaryaCommentWire({ ...baseComment, userRole: 'admin' });
    expect(wire.karya_id).toBe(KARYA_ID);
    expect(wire.user.is_verifier).toBe(true);
  });

  it('is_verifier false untuk user biasa', () => {
    const wire = toKaryaCommentWire({ ...baseComment, userRole: 'contributor' });
    expect(wire.user.is_verifier).toBe(false);
  });

  it('is_verifier false dan identitas dikosongkan bila akun terhapus', () => {
    const wire = toKaryaCommentWire({
      ...baseComment,
      userRole: 'admin',
      authorDeletedAt: new Date('2026-11-02T00:00:00Z'),
    });
    expect(wire.user.is_verifier).toBe(false);
    expect(wire.user.username).toBeNull();
  });
});
