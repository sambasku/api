import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitPantunReportUseCase } from '../../application/use-cases/submit-pantun-report.use-case';
import type { PantunReportRepository } from '../../domain/repositories/pantun-report.repository';
import type { PantunRepository } from '@/modules/pantun/domain/repositories/pantun.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Pantun } from '@/modules/pantun/domain/entities/pantun.entity';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';

const REPORTER = '01JDREPORTER00000000000001';
const AUTHOR = '01JDAUTHOR0000000000000001';
const PANTUN_ID = '01JDPANTUN0000000000000001';

const pantun: Pantun = {
  id: PANTUN_ID,
  userId: AUTHOR,
  username: 'budi',
  displayName: 'Budi',
  avatarUrl: null,
  userRole: null,
  categoryId: null,
  language: 'id',
  rhymeScheme: 'ABAB',
  lines: ['a', 'b', 'c', 'd'],
  status: 'published',
  createdAt: new Date('2026-10-20T00:00:00Z'),
  updatedAt: null,
};

function makeDeps(overrides: { pantun?: Pantun | null } = {}) {
  const reports = {
    create: vi.fn().mockResolvedValue({
      id: '01JDCREATED000000000000001',
      targetType: 'pantun',
      targetId: PANTUN_ID,
      userId: REPORTER,
      reasonCode: 'spam',
      note: null,
      status: 'open',
      createdAt: new Date('2026-10-25T00:00:00Z'),
    }),
    findOpenByUser: vi.fn().mockResolvedValue(null),
  } as unknown as PantunReportRepository;

  const pantuns = {
    findById: vi.fn().mockResolvedValue('pantun' in overrides ? overrides.pantun : pantun),
    findReplyById: vi.fn().mockResolvedValue(null),
  } as unknown as PantunRepository;

  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditLogRepository;

  return { reports, pantuns, audit };
}

const baseCmd = {
  targetType: 'pantun' as const,
  targetId: PANTUN_ID,
  userId: REPORTER,
  reasonCode: 'spam',
};

describe('SubmitPantunReportUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('alasan di luar daftar → ValidationError', async () => {
    const { reports, pantuns, audit } = makeDeps();
    await expect(
      new SubmitPantunReportUseCase(reports, pantuns, audit).execute({
        ...baseCmd,
        reasonCode: 'ngawur',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('alasan other tanpa catatan → ValidationError field note', async () => {
    const { reports, pantuns, audit } = makeDeps();
    const err = await new SubmitPantunReportUseCase(reports, pantuns, audit)
      .execute({ ...baseCmd, reasonCode: 'other', note: '   ' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).details?.[0]?.field).toBe('note');
  });

  it('tamu (anonim) → ForbiddenError LOGIN_REQUIRED', async () => {
    const { reports, pantuns, audit } = makeDeps();
    await expect(
      new SubmitPantunReportUseCase(reports, pantuns, audit).execute({
        ...baseCmd,
        userId: ANONIM_USER_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('target tidak tayang → NotFoundError', async () => {
    const { reports, pantuns, audit } = makeDeps({
      pantun: { ...pantun, status: 'taken_down' },
    });
    await expect(
      new SubmitPantunReportUseCase(reports, pantuns, audit).execute(baseCmd),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('melaporkan pantun sendiri → BadRequest', async () => {
    const { reports, pantuns, audit } = makeDeps();
    const err = await new SubmitPantunReportUseCase(reports, pantuns, audit)
      .execute({ ...baseCmd, userId: AUTHOR })
      .catch((e: unknown) => e);
    expect((err as { errorCode?: string }).errorCode).toBe('CANNOT_REPORT_OWN');
  });

  it('laporan open duplikat → ConflictError REPORT_OPEN', async () => {
    const { reports, pantuns, audit } = makeDeps();
    (reports.findOpenByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'x',
    });
    const err = await new SubmitPantunReportUseCase(reports, pantuns, audit)
      .execute(baseCmd)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).errorCode).toBe('REPORT_OPEN');
  });

  it('sukses menyimpan laporan + audit', async () => {
    const { reports, pantuns, audit } = makeDeps();
    const row = await new SubmitPantunReportUseCase(reports, pantuns, audit).execute({
      ...baseCmd,
      note: 'spam link',
      requestId: 'req-1',
    });

    expect(row.id).toBeDefined();
    expect(reports.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'pantun',
        targetId: PANTUN_ID,
        userId: REPORTER,
        reasonCode: 'spam',
        note: 'spam link',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'pantun_report', action: 'create' }),
    );
  });
});
