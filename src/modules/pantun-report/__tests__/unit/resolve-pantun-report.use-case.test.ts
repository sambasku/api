import { describe, it, expect, vi } from 'vitest';
import { ResolvePantunReportUseCase } from '../../application/use-cases/resolve-pantun-report.use-case';
import type { PantunReportRepository } from '../../domain/repositories/pantun-report.repository';
import type { PantunRepository } from '@/modules/pantun/domain/repositories/pantun.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { TakedownPantunUseCase } from '@/modules/pantun/application/use-cases/takedown-pantun.use-case';
import { TakedownPantunReplyUseCase } from '@/modules/pantun/application/use-cases/takedown-pantun-reply.use-case';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { PantunReportWithTarget } from '../../domain/entities/pantun-report.entity';

const ADMIN = '01JDADMIN00000000000000001';
const REPORT_ID = '01JDREPORT0000000000000001';
const TARGET_ID = '01JDPANTUN0000000000000001';

function makeReport(
  overrides: Partial<PantunReportWithTarget> = {},
): PantunReportWithTarget {
  return {
    id: REPORT_ID,
    targetType: 'pantun',
    targetId: TARGET_ID,
    userId: 'reporter',
    username: 'siti',
    displayName: 'Siti',
    reasonCode: 'spam',
    note: null,
    status: 'open',
    resolution: null,
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: null,
    targetLines: ['a', 'b', 'c', 'd'],
    targetStatus: 'published',
    targetUserId: 'author',
    targetUsername: 'budi',
    targetDisplayName: 'Budi',
    ...overrides,
  };
}

function makeDeps(report: PantunReportWithTarget | null = makeReport()) {
  const reports = {
    findById: vi.fn().mockResolvedValue(report),
    resolve: vi.fn().mockResolvedValue(true),
    resolveAllOpenForTarget: vi.fn().mockResolvedValue(undefined),
  } as unknown as PantunReportRepository;

  const pantunRepo = {
    takedown: vi.fn().mockResolvedValue({ id: TARGET_ID }),
    takedownReply: vi.fn().mockResolvedValue(true),
  } as unknown as PantunRepository;

  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditLogRepository;

  const uc = new ResolvePantunReportUseCase(
    reports,
    new TakedownPantunUseCase(pantunRepo, audit),
    new TakedownPantunReplyUseCase(pantunRepo, audit),
    audit,
  );

  return { reports, pantunRepo, audit, uc };
}

describe('ResolvePantunReportUseCase', () => {
  it('dismissed hanya menutup laporan, konten tetap tayang', async () => {
    const { reports, pantunRepo, uc } = makeDeps();
    await uc.execute({
      id: REPORT_ID,
      resolution: 'dismissed',
      note: 'bukan pelanggaran',
      actorId: ADMIN,
    });

    expect(reports.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ id: REPORT_ID, status: 'dismissed' }),
    );
    expect(pantunRepo.takedown).not.toHaveBeenCalled();
    expect(reports.resolveAllOpenForTarget).not.toHaveBeenCalled();
  });

  it('taken_down menarik pantun lalu tutup semua laporan open target', async () => {
    const { reports, pantunRepo, uc } = makeDeps();
    await uc.execute({
      id: REPORT_ID,
      resolution: 'taken_down',
      note: 'spam terbukti',
      actorId: ADMIN,
    });

    expect(pantunRepo.takedown).toHaveBeenCalledWith(TARGET_ID, ADMIN);
    expect(reports.resolveAllOpenForTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'pantun',
        targetId: TARGET_ID,
        resolvedBy: ADMIN,
      }),
    );
  });

  it('balasan: memakai takedownReply, bukan takedown pantun', async () => {
    const reply = makeReport({ targetType: 'pantun_reply', targetId: '01JDREPLY0000000000000001' });
    const { pantunRepo, uc } = makeDeps(reply);
    await uc.execute({
      id: REPORT_ID,
      resolution: 'taken_down',
      actorId: ADMIN,
    });

    expect(pantunRepo.takedownReply).toHaveBeenCalledWith(
      '01JDREPLY0000000000000001',
      ADMIN,
    );
    expect(pantunRepo.takedown).not.toHaveBeenCalled();
  });

  it('target sudah tidak tayang: takedown dilewati, laporan tetap ditutup', async () => {
    const { reports, pantunRepo, uc } = makeDeps(
      makeReport({ targetStatus: 'taken_down' }),
    );
    await uc.execute({ id: REPORT_ID, resolution: 'taken_down', actorId: ADMIN });

    expect(pantunRepo.takedown).not.toHaveBeenCalled();
    expect(reports.resolveAllOpenForTarget).toHaveBeenCalledTimes(1);
  });

  it('dobel resolve → ConflictError', async () => {
    const { uc } = makeDeps(makeReport({ status: 'resolved' }));
    await expect(
      uc.execute({ id: REPORT_ID, resolution: 'dismissed', actorId: ADMIN }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('laporan tidak ada → NotFoundError', async () => {
    const { uc } = makeDeps(null);
    await expect(
      uc.execute({ id: REPORT_ID, resolution: 'dismissed', actorId: ADMIN }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
