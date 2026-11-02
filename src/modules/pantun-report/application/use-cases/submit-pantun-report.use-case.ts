import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { PantunRepository } from '@/modules/pantun/domain/repositories/pantun.repository';
import { PANTUN_REPORT_REASONS } from '@/shared/database/drizzle/schema/pantun-reports.schema';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { PantunReport } from '../../domain/entities/pantun-report.entity';
import type { PantunReportRepository } from '../../domain/repositories/pantun-report.repository';
import type { PantunReportTarget } from '@/shared/database/drizzle/schema/pantun-reports.schema';

export interface SubmitPantunReportCommand {
  targetType: PantunReportTarget;
  targetId: string;
  userId: string;
  reasonCode: string;
  note?: string | null;
  requestId?: string | null;
}

export class SubmitPantunReportUseCase {
  constructor(
    private readonly reports: PantunReportRepository,
    private readonly pantuns: PantunRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: SubmitPantunReportCommand): Promise<PantunReport> {
    if (!cmd.userId || cmd.userId === ANONIM_USER_ID) {
      throw new ForbiddenError(
        'LOGIN_REQUIRED',
        'Masuk dulu ya untuk melaporkan pantun',
      );
    }

    if (!(PANTUN_REPORT_REASONS as readonly string[]).includes(cmd.reasonCode)) {
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

    const target =
      cmd.targetType === 'pantun'
        ? await this.pantuns.findById(cmd.targetId)
        : await this.pantuns.findReplyById(cmd.targetId);

    if (!target || target.status !== 'published') {
      throw new NotFoundError(
        cmd.targetType === 'pantun' ? 'PANTUN_NOT_FOUND' : 'PANTUN_REPLY_NOT_FOUND',
        cmd.targetType === 'pantun'
          ? 'Pantun tidak ditemukan'
          : 'Balasan tidak ditemukan',
      );
    }

    if (target.userId === cmd.userId) {
      throw new BadRequestError(
        'CANNOT_REPORT_OWN',
        'Kamu tidak bisa melaporkan pantunmu sendiri',
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
        'Laporanmu untuk pantun ini masih ditinjau',
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
      entityType: 'pantun_report',
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
