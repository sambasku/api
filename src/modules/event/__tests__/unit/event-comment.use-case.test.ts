import { describe, it, expect, vi } from 'vitest';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import {
  CreateEventCommentUseCase,
  DeleteEventCommentUseCase,
  ListEventCommentsUseCase,
  UpdateEventCommentUseCase,
} from '../../application/use-cases/event-comment.use-cases';
import type { EventRepository } from '../../domain/repositories/event.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CommentBlocklistRepository } from '@/modules/comment-blocklist/domain/repositories/comment-blocklist.repository';

const EVENT_ID = '01EVENT0000000000000000001';
const USER_ID = '01USER00000000000000000001';
const COMMENT_ID = '01COMMENT000000000000000001';

const baseComment = {
  id: COMMENT_ID,
  eventId: EVENT_ID,
  userId: USER_ID,
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  userRole: null,
  authorDeletedAt: null,
  body: 'Komentar acara keren!',
  status: 'published' as const,
  isEdited: false,
  createdAt: new Date('2026-11-01T10:00:00Z'),
  updatedAt: null,
};

type MockFn = ReturnType<typeof vi.fn>;

function makeRepo(over: Record<string, MockFn> = {}): EventRepository {
  return {
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    setPlaces: vi.fn(),
    placesOf: vi.fn().mockResolvedValue([]),
    categoryRef: vi.fn().mockResolvedValue({ id: 'budaya', name: 'Budaya' }),
    villageRef: vi.fn().mockResolvedValue(null),
    listCategories: vi.fn().mockResolvedValue([]),
    validPlaceIds: vi.fn().mockResolvedValue(new Set<string>()),
    existingSlugs: vi.fn().mockResolvedValue(new Set<string>()),
    // comment methods
    createComment: vi.fn().mockResolvedValue(baseComment),
    findCommentById: vi.fn().mockResolvedValue(baseComment),
    listComments: vi.fn().mockResolvedValue({ items: [baseComment], nextCursor: null, hasMore: false }),
    updateCommentWithRevision: vi.fn().mockResolvedValue(baseComment),
    markCommentDeletedByAuthor: vi.fn().mockResolvedValue(true),
    takedownComment: vi.fn().mockResolvedValue(true),
    eventTargetExists: vi.fn().mockResolvedValue(true),
    ...over,
  } as unknown as EventRepository;
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

describe('ListEventCommentsUseCase', () => {
  it('memanggil repo.listComments dengan filter status published', async () => {
    const repo = makeRepo();
    const uc = new ListEventCommentsUseCase(repo);
    const result = await uc.execute(EVENT_ID, undefined, 20);
    expect(repo.listComments).toHaveBeenCalledWith(EVENT_ID, {
      status: 'published',
      cursor: undefined,
      limit: 20,
    });
    expect(result.items).toHaveLength(1);
  });

  it('meneruskan cursor ke repo', async () => {
    const repo = makeRepo();
    const uc = new ListEventCommentsUseCase(repo);
    await uc.execute(EVENT_ID, 'somecursor', 10);
    expect(repo.listComments).toHaveBeenCalledWith(EVENT_ID, {
      status: 'published',
      cursor: 'somecursor',
      limit: 10,
    });
  });
});

// ---------------------------------------------------------------- create

describe('CreateEventCommentUseCase', () => {
  it('membuat komentar dan emit activity event', async () => {
    const repo = makeRepo();
    const audit = makeAudit();
    const blocklist = makeBlocklist();
    const activityEvents = { safe: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreateEventCommentUseCase(repo, audit, blocklist, undefined, activityEvents as never);

    const result = await uc.execute({ eventId: EVENT_ID, userId: USER_ID, body: 'Komentar acara keren!' });
    expect(result.id).toBe(COMMENT_ID);
    expect(repo.createComment).toHaveBeenCalled();
    expect(activityEvents.safe).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'event_comment_created',
      actorId: USER_ID,
      targetId: COMMENT_ID,
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      entityType: 'event_comment',
    }));
  });

  it('lempar NotFoundError bila acara tidak ditemukan', async () => {
    const repo = makeRepo({ eventTargetExists: vi.fn().mockResolvedValue(false) });
    const uc = new CreateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ eventId: EVENT_ID, userId: USER_ID, body: 'Komentar acara keren!' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lempar BadRequestError bila body kosong', async () => {
    const repo = makeRepo();
    const uc = new CreateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ eventId: EVENT_ID, userId: USER_ID, body: '   ' }),
    ).rejects.toThrow(BadRequestError);
  });

  it('lempar BadRequestError bila body > 1000 karakter', async () => {
    const repo = makeRepo();
    const uc = new CreateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ eventId: EVENT_ID, userId: USER_ID, body: 'a'.repeat(1001) }),
    ).rejects.toThrow(BadRequestError);
  });

  it('terapkan blocklist dan simpan body_original', async () => {
    const repo = makeRepo({ createComment: vi.fn().mockImplementation(async (input) => ({ ...baseComment, ...input })) });
    const blocklist = makeBlocklist(['badword']);
    const uc = new CreateEventCommentUseCase(repo, makeAudit(), blocklist);
    await uc.execute({ eventId: EVENT_ID, userId: USER_ID, body: 'Ini badword sekali' });
    const call = (repo.createComment as MockFn).mock.calls[0][0];
    expect(call.bodyOriginal).toBe('Ini badword sekali');
    expect(call.body).not.toContain('badword');
  });

  it('bodyOriginal null bila tidak ada kata terblokir', async () => {
    const repo = makeRepo({ createComment: vi.fn().mockImplementation(async (input) => ({ ...baseComment, ...input })) });
    const uc = new CreateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await uc.execute({ eventId: EVENT_ID, userId: USER_ID, body: 'Komentar bersih' });
    const call = (repo.createComment as MockFn).mock.calls[0][0];
    expect(call.bodyOriginal).toBeNull();
  });
});

// ---------------------------------------------------------------- update

describe('UpdateEventCommentUseCase', () => {
  it('update komentar milik sendiri berhasil', async () => {
    const repo = makeRepo();
    const uc = new UpdateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    const result = await uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit komentar' });
    expect(repo.updateCommentWithRevision).toHaveBeenCalledWith(expect.objectContaining({
      commentId: COMMENT_ID,
      editorId: USER_ID,
    }));
    expect(result).toBeDefined();
  });

  it('lempar ForbiddenError bila bukan pemilik', async () => {
    const repo = makeRepo({ findCommentById: vi.fn().mockResolvedValue({ ...baseComment, userId: 'OTHER_USER' }) });
    const uc = new UpdateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('lempar NotFoundError bila komentar tidak ada', async () => {
    const repo = makeRepo({ findCommentById: vi.fn().mockResolvedValue(null) });
    const uc = new UpdateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lempar NotFoundError bila komentar sudah dihapus', async () => {
    const repo = makeRepo({
      findCommentById: vi.fn().mockResolvedValue({ ...baseComment, status: 'deleted_by_author' }),
    });
    const uc = new UpdateEventCommentUseCase(repo, makeAudit(), makeBlocklist());
    await expect(
      uc.execute({ commentId: COMMENT_ID, userId: USER_ID, body: 'Edit' }),
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------- delete

describe('DeleteEventCommentUseCase', () => {
  it('hapus komentar berhasil', async () => {
    const repo = makeRepo();
    const uc = new DeleteEventCommentUseCase(repo);
    await expect(uc.execute(COMMENT_ID, USER_ID)).resolves.toBeUndefined();
    expect(repo.markCommentDeletedByAuthor).toHaveBeenCalledWith(COMMENT_ID, USER_ID);
  });

  it('lempar NotFoundError bila komentar tidak ada atau bukan miliknya', async () => {
    const repo = makeRepo({ markCommentDeletedByAuthor: vi.fn().mockResolvedValue(false) });
    const uc = new DeleteEventCommentUseCase(repo);
    await expect(uc.execute(COMMENT_ID, USER_ID)).rejects.toThrow(NotFoundError);
  });
});
