import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitJinyeReportUseCase } from '../../application/use-cases/submit-jinye-report.use-case';
import type { JinyeReportRepository } from '../../domain/repositories/jinye-report.repository';
import type { JinyeRepository } from '@/modules/jinye/domain/repositories/jinye.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { Jinye } from '@/modules/jinye/domain/entities/jinye.entity';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';

const REPORTER = '01JDREPORTER00000000000001';
const AUTHOR = '01JDAUTHOR0000000000000001';
const JINYE_ID = '01JDJINYE00000000000000001';

const jinye: Jinye = {
  id: JINYE_ID,
  userId: AUTHOR,
  username: 'budi',
  displayName: 'Budi',
  avatarUrl: null,
  userRole: null,
  body: 'halo',
  bodyOriginal: null,
  images: [],
  audio: null,
  repostOfId: null,
  quoteBody: null,
  status: 'published',
  publishedCommentCount: 0,
  repostCount: 0,
  createdAt: new Date('2026-10-20T00:00:00Z'),
  updatedAt: null,
};

function makeDeps(overrides: { jinye?: Jinye | null } = {}) {
  const reports = {
    create: vi.fn().mockResolvedValue({
      id: '01JDCREATED000000000000001',
      targetType: 'jinye',
      targetId: JINYE_ID,
      userId: REPORTER,
      reasonCode: 'spam',
      note: null,
      status: 'open',
      createdAt: new Date('2026-10-25T00:00:00Z'),
    }),
    findOpenByUser: vi.fn().mockResolvedValue(null),
  } as unknown as JinyeReportRepository;

  const jinyeRepo = {
    findById: vi
      .fn()
      .mockResolvedValue('jinye' in overrides ? overrides.jinye : jinye),
    findCommentById: vi.fn().mockResolvedValue(null),
  } as unknown as JinyeRepository;

  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditLogRepository;

  return { reports, jinyeRepo, audit };
}

const baseCmd = {
  targetType: 'jinye' as const,
  targetId: JINYE_ID,
  userId: REPORTER,
  reasonCode: 'spam',
};

describe('SubmitJinyeReportUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('alasan di luar daftar → ValidationError', async () => {
    const { reports, jinyeRepo, audit } = makeDeps();
    await expect(
      new SubmitJinyeReportUseCase(reports, jinyeRepo, audit).execute({
        ...baseCmd,
        reasonCode: 'ngawur',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('alasan other tanpa catatan → ValidationError field note', async () => {
    const { reports, jinyeRepo, audit } = makeDeps();
    const err = await new SubmitJinyeReportUseCase(reports, jinyeRepo, audit)
      .execute({ ...baseCmd, reasonCode: 'other', note: '   ' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).details?.[0]?.field).toBe('note');
  });

  it('tamu (anonim) → ForbiddenError LOGIN_REQUIRED', async () => {
    const { reports, jinyeRepo, audit } = makeDeps();
    await expect(
      new SubmitJinyeReportUseCase(reports, jinyeRepo, audit).execute({
        ...baseCmd,
        userId: ANONIM_USER_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('target tidak tayang → NotFoundError', async () => {
    const { reports, jinyeRepo, audit } = makeDeps({
      jinye: { ...jinye, status: 'taken_down' },
    });
    await expect(
      new SubmitJinyeReportUseCase(reports, jinyeRepo, audit).execute(baseCmd),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('melaporkan jinye sendiri → BadRequest', async () => {
    const { reports, jinyeRepo, audit } = makeDeps();
    const err = await new SubmitJinyeReportUseCase(reports, jinyeRepo, audit)
      .execute({ ...baseCmd, userId: AUTHOR })
      .catch((e: unknown) => e);
    expect((err as { errorCode?: string }).errorCode).toBe('CANNOT_REPORT_OWN');
  });

  it('laporan open duplikat → ConflictError REPORT_OPEN', async () => {
    const { reports, jinyeRepo, audit } = makeDeps();
    (reports.findOpenByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '01JDOPEN000000000000000001',
    });
    await expect(
      new SubmitJinyeReportUseCase(reports, jinyeRepo, audit).execute(baseCmd),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('sukses → create + audit', async () => {
    const { reports, jinyeRepo, audit } = makeDeps();
    const out = await new SubmitJinyeReportUseCase(
      reports,
      jinyeRepo,
      audit,
    ).execute(baseCmd);
    expect(out.id).toBeTruthy();
    expect(reports.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'jinye',
        targetId: JINYE_ID,
        userId: REPORTER,
        reasonCode: 'spam',
      }),
    );
    expect(audit.record).toHaveBeenCalled();
  });
});
