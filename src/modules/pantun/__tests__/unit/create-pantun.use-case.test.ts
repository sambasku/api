import { describe, it, expect, vi } from 'vitest';
import { CreatePantunUseCase } from '../../application/use-cases/create-pantun.use-case';
import { CreatePantunReplyUseCase } from '../../application/use-cases/create-pantun-reply.use-case';
import type { PantunRepository } from '../../domain/repositories/pantun.repository';
import type { Pantun, PantunReply } from '../../domain/entities/pantun.entity';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';

const ACTOR = '01JDACTOR00000000000000001';
const PARENT_ID = '01JDPARENT0000000000000001';

const ABAB = ['Pergi berjalan ke Sambas', 'Membeli ikan di pasar', 'Pulang bawa rumbas', 'Hatiku girang bersinar'];

function makePantun(overrides: Partial<Pantun> = {}): Pantun {
  return {
    id: PARENT_ID,
    userId: ACTOR,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    categoryId: null,
    language: 'id',
    rhymeScheme: 'ABAB',
    lines: ABAB,
    status: 'published',
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeReply(overrides: Partial<PantunReply> = {}): PantunReply {
  return {
    id: '01JDREPLY00000000000000001',
    parentId: PARENT_ID,
    userId: ACTOR,
    username: 'budi',
    displayName: 'Budi',
    avatarUrl: null,
    userRole: null,
    categoryId: null,
    language: 'id',
    rhymeScheme: 'ABAB',
    lines: ABAB,
    status: 'published',
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<PantunRepository> = {}) {
  return {
    create: vi.fn().mockImplementation(async (input) =>
      makePantun({ lines: input.lines, rhymeScheme: input.rhymeScheme }),
    ),
    findById: vi.fn().mockResolvedValue(makePantun()),
    list: vi.fn(),
    createReply: vi.fn().mockResolvedValue(makeReply()),
    findReplyById: vi.fn().mockResolvedValue(makeReply()),
    listReplies: vi.fn().mockResolvedValue([]),
    listDistinctReplierUserIds: vi.fn().mockResolvedValue([]),
    markReplyDeletedByAuthor: vi.fn().mockResolvedValue(true),
    takedownReply: vi.fn().mockResolvedValue(true),
    takedown: vi.fn().mockResolvedValue(makePantun({ status: 'taken_down' })),
    ...overrides,
  } as unknown as PantunRepository;
}

const audit = { record: vi.fn().mockResolvedValue(undefined), list: vi.fn() } as unknown as AuditLogRepository;
const blocklist = { listAllActiveWords: vi.fn().mockResolvedValue([]) };

describe('CreatePantunUseCase', () => {
  it('pantun ABAB valid → tersimpan published', async () => {
    const repo = makeRepo();
    const uc = new CreatePantunUseCase(repo, audit, blocklist as never);
    const row = await uc.execute({ userId: ACTOR, lines: ABAB, rhymeScheme: 'ABAB' });
    expect(row.status).toBe('published');
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('3 baris → ditolak', async () => {
    const uc = new CreatePantunUseCase(makeRepo(), audit, blocklist as never);
    await expect(
      uc.execute({ userId: ACTOR, lines: ABAB.slice(0, 3), rhymeScheme: 'ABAB' }),
    ).rejects.toMatchObject({
      details: [expect.objectContaining({ message: expect.stringMatching(/4 baris/) })],
    });
  });

  it('baris kosong → ditolak', async () => {
    const uc = new CreatePantunUseCase(makeRepo(), audit, blocklist as never);
    await expect(
      uc.execute({ userId: ACTOR, lines: [ABAB[0], '', ABAB[2], ABAB[3]], rhymeScheme: 'ABAB' }),
    ).rejects.toMatchObject({
      details: [expect.objectContaining({ message: expect.stringMatching(/baris kosong/i) })],
    });
  });

  it('pola AABB (rima 1-3 tidak pas) → ditolak dengan pesan pasangan', async () => {
    const uc = new CreatePantunUseCase(makeRepo(), audit, blocklist as never);
    const aabb = ['pergi ke pasar', 'membeli gula', 'pulang bawa sasar', 'manis di bibir'];
    await expect(
      uc.execute({ userId: ACTOR, lines: aabb, rhymeScheme: 'ABAB' }),
    ).rejects.toMatchObject({
      details: [expect.objectContaining({ message: expect.stringMatching(/belum berima/) })],
    });
  });

  it('emisi event pantun_created', async () => {
    const safe = vi.fn().mockResolvedValue(undefined);
    const uc = new CreatePantunUseCase(makeRepo(), audit, blocklist as never, undefined, {
      safe,
    } as never);
    await uc.execute({ userId: ACTOR, lines: ABAB, rhymeScheme: 'ABAB' });
    expect(safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pantun_created', actorId: ACTOR }),
    );
  });
});

describe('CreatePantunReplyUseCase', () => {
  it('balasan parent valid → tersimpan', async () => {
    const repo = makeRepo();
    const uc = new CreatePantunReplyUseCase(repo, audit, blocklist as never);
    const row = await uc.execute({
      parentId: PARENT_ID,
      userId: ACTOR,
      lines: ABAB,
      rhymeScheme: 'ABAB',
    });
    expect(row.parentId).toBe(PARENT_ID);
    expect(repo.createReply).toHaveBeenCalledOnce();
  });

  it('emisi event pantun_reply_created', async () => {
    const safe = vi.fn().mockResolvedValue(undefined);
    const uc = new CreatePantunReplyUseCase(
      makeRepo(),
      audit,
      blocklist as never,
      undefined,
      { safe } as never,
    );
    await uc.execute({
      parentId: PARENT_ID,
      userId: ACTOR,
      lines: ABAB,
      rhymeScheme: 'ABAB',
    });
    expect(safe).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pantun_reply_created', actorId: ACTOR }),
    );
  });

  it('parent tidak ada → PANTUN_NOT_FOUND', async () => {
    const uc = new CreatePantunReplyUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(null) }),
      audit,
      blocklist as never,
    );
    await expect(
      uc.execute({ parentId: PARENT_ID, userId: ACTOR, lines: ABAB, rhymeScheme: 'ABAB' }),
    ).rejects.toThrow(/Pantun yang mau dibalas tidak ditemukan/);
  });

  it('parent sudah di-takedown → ditolak', async () => {
    const uc = new CreatePantunReplyUseCase(
      makeRepo({ findById: vi.fn().mockResolvedValue(makePantun({ status: 'taken_down' })) }),
      audit,
      blocklist as never,
    );
    await expect(
      uc.execute({ parentId: PARENT_ID, userId: ACTOR, lines: ABAB, rhymeScheme: 'ABAB' }),
    ).rejects.toThrow(/Pantun yang mau dibalas tidak ditemukan/);
  });

  it('pola tak dikenal tidak pernah lolos: AABB di bawah ABAB ditolak', async () => {
    const uc = new CreatePantunReplyUseCase(makeRepo(), audit, blocklist as never);
    const aabb = ['pergi ke pasar', 'membeli gula', 'pulang bawa sasar', 'manis di bibir'];
    await expect(
      uc.execute({ parentId: PARENT_ID, userId: ACTOR, lines: aabb, rhymeScheme: 'ABAB' }),
    ).rejects.toMatchObject({
      details: [expect.objectContaining({ message: expect.stringMatching(/belum berima/) })],
    });
  });
});

describe('CreatePantunReplyUseCase - notifikasi peserta thread', () => {
  const OWNER = '01JDOWNER00000000000000001';
  const REPLIER2 = '01JDREPLIER20000000000002';
  const REPLIER3 = '01JDREPLIER30000000000003';
  const ACTOR4 = '01JDACTOR4000000000000004';

  function buildWithNotif(opts: {
    priorRepliers: string[];
    maySend?: boolean;
  }) {
    const inbox = { execute: vi.fn().mockResolvedValue(undefined) };
    const notifyUser = { execute: vi.fn().mockResolvedValue(undefined) };
    const pushCooldown = {
      maySend: vi.fn().mockResolvedValue(opts.maySend ?? true),
      touchAfterSend: vi.fn().mockResolvedValue(undefined),
    };
    const userRepo = {
      findById: vi.fn().mockResolvedValue({
        id: ACTOR4,
        username: 'pemantun4',
        displayName: 'Pemantun Empat',
      }),
    };
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makePantun({ userId: OWNER })),
      listDistinctReplierUserIds: vi
        .fn()
        .mockResolvedValue(opts.priorRepliers),
    });
    const uc = new CreatePantunReplyUseCase(
      repo,
      audit,
      blocklist as never,
      undefined,
      undefined,
      userRepo as never,
      inbox as never,
      notifyUser as never,
      pushCooldown as never,
    );
    return { uc, inbox, notifyUser, pushCooldown, repo };
  }

  it('user 4 membalas: pemilik + semua pembalas sebelumnya dapat inbox', async () => {
    const { uc, inbox } = buildWithNotif({
      priorRepliers: [REPLIER2, REPLIER3, OWNER],
    });
    await uc.execute({
      parentId: PARENT_ID,
      userId: ACTOR4,
      lines: ABAB,
      rhymeScheme: 'ABAB',
    });

    const targets = inbox.execute.mock.calls.map(
      (call) => (call[0] as { userId: string; type: string }).userId,
    );
    expect(targets.sort()).toEqual([OWNER, REPLIER2, REPLIER3].sort());
    expect(
      inbox.execute.mock.calls.every(
        (call) =>
          (call[0] as { type: string }).type === 'pantun_reply' &&
          (call[0] as { targetKind: string }).targetKind === 'pantun',
      ),
    ).toBe(true);
  });

  it('aktor tidak menerima notifikasi balasannya sendiri', async () => {
    const { uc, inbox } = buildWithNotif({
      priorRepliers: [ACTOR4, REPLIER2],
    });
    await uc.execute({
      parentId: PARENT_ID,
      userId: ACTOR4,
      lines: ABAB,
      rhymeScheme: 'ABAB',
    });
    const targets = inbox.execute.mock.calls.map(
      (call) => (call[0] as { userId: string }).userId,
    );
    // Aktor keluarkan; pemilik pantun tetap peserta sah.
    expect(targets).not.toContain(ACTOR4);
    expect(targets.sort()).toEqual([OWNER, REPLIER2].sort());
  });

  it('push cooldown aktif → push dilewati, inbox tetap ditulis', async () => {
    const { uc, inbox, notifyUser } = buildWithNotif({
      priorRepliers: [],
      maySend: false,
    });
    await uc.execute({
      parentId: PARENT_ID,
      userId: ACTOR4,
      lines: ABAB,
      rhymeScheme: 'ABAB',
    });
    expect(inbox.execute).toHaveBeenCalled();
    expect(notifyUser.execute).not.toHaveBeenCalled();
  });
});
