import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { JinyeRepository } from '@/modules/jinye/domain/repositories/jinye.repository';
import { JINYE_REPORT_REASONS } from '@/shared/database/drizzle/schema/jinye-reports.schema';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { JinyeReport } from '../../domain/entities/jinye-report.entity';
import type { JinyeReportRepository } from '../../domain/repositories/jinye-report.repository';
import type { JinyeReportTarget } from '@/shared/database/drizzle/schema/jinye-reports.schema';

export interface SubmitJinyeReportCommand {
  targetType: JinyeReportTarget;
  targetId: string;
  userId: string;
  reasonCode: string;
  note?: string | null;
  requestId?: string | null;
}

export class SubmitJinyeReportUseCase {
  constructor(
    private readonly reports: JinyeReportRepository,
    private readonly jinye: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: SubmitJinyeReportCommand): Promise<JinyeReport> {
    if (!cmd.userId || cmd.userId === ANONIM_USER_ID) {
      throw new ForbiddenError(
        'LOGIN_REQUIRED',
        'Masuk dulu ya untuk melaporkan Jinye',
      );
    }

    if (!(JINYE_REPORT_REASONS as readonly string[]).includes(cmd.reasonCode)) {
      throw new ValidationError([
        { field: 'reason_code', message: 'Pilih alasan dari daftar' },
      ]);
    }

    const note = cmd.note?.trim() || null;
    if (cmd.reasonCode === 'other' && !note) {
      throw new ValidationError([
        { field: 'note', message: 'Catatan wajib diisi untuk alasan ini' },
      ]);
    }

    let ownerId: string | null = null;
    if (cmd.targetType === 'jinye') {
      const target = await this.jinye.findById(cmd.targetId);
      if (!target || target.status !== 'published') {
        throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
      }
      ownerId = target.userId;
    } else {
      const target = await this.jinye.findCommentById(cmd.targetId);
      if (!target || target.status !== 'published') {
        throw new NotFoundError(
          'JINYE_COMMENT_NOT_FOUND',
          'Komentar tidak ditemukan',
        );
      }
      ownerId = target.userId;
    }

    if (ownerId === cmd.userId) {
      throw new BadRequestError(
        'CANNOT_REPORT_OWN',
        'Kamu tidak bisa melaporkan kontenmu sendiri',
      );
    }

    const open = await this.reports.findOpenByUser(
      cmd.targetType,
      cmd.targetId,
      cmd.userId,
    );
    if (open) {
      throw new ConflictError(
        'REPORT_OPEN',
        'Laporanmu untuk konten ini masih ditinjau',
      );
    }

    const row = await this.reports.create({
      targetType: cmd.targetType,
      targetId: cmd.targetId,
      userId: cmd.userId,
      reasonCode: cmd.reasonCode,
      note,
    });

    await this.auditRepo.record({
      userId: cmd.userId,
      action: 'create',
      entityType: 'jinye_report',
      entityId: row.id,
      newData: {
        target_type: cmd.targetType,
        target_id: cmd.targetId,
        reason_code: cmd.reasonCode,
        status: 'open',
      },
      requestId: cmd.requestId ?? null,
    });

    return row;
  }
}
