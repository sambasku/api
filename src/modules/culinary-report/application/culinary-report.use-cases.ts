import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { CulinaryRepository } from '@/modules/culinary/domain/repositories/culinary.repository';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/errors/app-error';
import type { CulinaryReport } from '../domain/culinary-report.entity';
import type { CulinaryReportRepository } from '../domain/culinary-report.repository';
import { CULINARY_REPORT_REASONS } from '@/shared/database/drizzle/schema/culinary-reports.schema';

const VALID_REASONS = CULINARY_REPORT_REASONS;

export interface SubmitCulinaryReportInput {
  targetType: 'cuisine' | 'place';
  /** Slug publik target (bukan id internal). */
  slug: string;
  reasonCode: string;
  note?: string | null;
}

export class CulinaryReportUseCases {
  constructor(
    private readonly reports: CulinaryReportRepository,
    private readonly culinary: CulinaryRepository,
    private readonly audit?: AuditLogRepository,
  ) {}

  async submit(
    userId: string,
    input: SubmitCulinaryReportInput,
  ): Promise<CulinaryReport> {
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
        [{ field: 'reason_code', message: 'Pilih alasan dari daftar' }],
      );
    }
    const target =
      input.targetType === 'cuisine'
        ? await this.culinary.findCuisineBySlug(input.slug, { publicOnly: true })
        : await this.culinary.findPlaceBySlug(input.slug, { publicOnly: true });
    if (!target) {
      throw new NotFoundError('TARGET_NOT_FOUND', 'Data tidak ditemukan');
    }
    const open = await this.reports.findOpenByUser(
      input.targetType,
      target.id,
      userId,
    );
    if (open) {
      throw new ConflictError(
        'REPORT_OPEN',
        'Laporanmu untuk data ini masih ditinjau',
      );
    }
    return this.reports.create({
      targetType: input.targetType,
      targetId: target.id,
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
      action: 'culinary.report.resolve',
      entityType: row.targetType === 'cuisine' ? 'cuisine' : 'culinary_place',
      entityId: row.targetId,
      newData: {
        report_id: id,
        status: input.status,
        resolution: input.resolution,
      },
      requestId: requestId ?? null,
    });
  }
}
