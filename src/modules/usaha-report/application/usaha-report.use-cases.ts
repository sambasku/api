import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UsahaRepository } from '@/modules/usaha/domain/repositories/usaha.repository';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { UsahaReport } from '../domain/usaha-report.entity';
import type { UsahaReportRepository } from '../domain/usaha-report.repository';

const VALID_REASONS = [
  'closed',
  'wrong_location',
  'invalid_contact',
  'misleading',
  'duplicate',
  'abuse',
] as const;

export class UsahaReportUseCases {
  constructor(
    private readonly reports: UsahaReportRepository,
    private readonly usahas: UsahaRepository,
    private readonly audit?: AuditLogRepository,
  ) {}

  /** Lapor info usaha. Wajib login; satu laporan open per usaha per user. */
  async submit(
    userId: string,
    slug: string,
    input: { reasonCode: string; note?: string | null },
  ): Promise<UsahaReport> {
    if (!userId || userId === ANONIM_USER_ID) {
      throw new ForbiddenError(
        'LOGIN_REQUIRED',
        'Masuk dulu ya untuk mengirim laporan',
      );
    }
    if (!(VALID_REASONS as readonly string[]).includes(input.reasonCode)) {
      throw new BadRequestError(
        'REASON_INVALID',
        'Alasan laporan tidak dikenali',
      );
    }
    const usaha = await this.usahas.findBySlug(slug, { publicOnly: true });
    if (!usaha) {
      throw new NotFoundError('USAHA_NOT_FOUND', 'Usaha tidak ditemukan');
    }
    const existing = await this.reports.findOpenByUser(usaha.id, userId);
    if (existing) {
      throw new ConflictError(
        'REPORT_OPEN',
        'Laporan kamu untuk usaha ini masih menunggu tindak lanjut',
      );
    }
    return this.reports.create({
      usahaId: usaha.id,
      userId,
      reasonCode: input.reasonCode,
      note: input.note ?? null,
    });
  }

  list(status?: string) {
    return this.reports.list(status);
  }

  async resolve(
    id: string,
    input: {
      status: 'resolved' | 'dismissed';
      resolution: string;
      resolutionNote?: string | null;
    },
    actorId: string,
    requestId?: string | null,
  ): Promise<void> {
    const row = await this.reports.findById(id);
    if (!row) {
      throw new NotFoundError('REPORT_NOT_FOUND', 'Laporan tidak ditemukan');
    }
    if (row.status !== 'open') {
      throw new ConflictError('NOT_OPEN', 'Laporan sudah ditindaklanjuti');
    }
    await this.reports.resolve({
      id,
      status: input.status,
      resolution: input.resolution,
      resolutionNote: input.resolutionNote ?? null,
      resolvedBy: actorId,
    });
    await this.audit?.record({
      userId: actorId,
      action: 'usaha.report.resolve',
      entityType: 'usaha',
      entityId: row.usahaId,
      newData: {
        report_id: id,
        status: input.status,
        resolution: input.resolution,
      },
      requestId: requestId ?? null,
    });
  }
}
