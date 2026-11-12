import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { TakedownJinyeUseCase } from '@/modules/jinye/application/use-cases/takedown-jinye.use-case';
import { TakedownJinyeCommentUseCase } from '@/modules/jinye/application/use-cases/takedown-jinye-comment.use-case';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { JinyeReportWithTarget } from '../../domain/entities/jinye-report.entity';
import type { JinyeReportRepository } from '../../domain/repositories/jinye-report.repository';

export interface ResolveJinyeReportCommand {
  id: string;
  resolution: 'dismissed' | 'taken_down';
  note?: string | null;
  actorId: string;
  requestId?: string | null;
}

/**
 * Tutup satu laporan. `taken_down` menarik target lalu menutup semua
 * laporan open pada target yang sama.
 */
export class ResolveJinyeReportUseCase {
  constructor(
    private readonly reports: JinyeReportRepository,
    private readonly takedownJinye: TakedownJinyeUseCase,
    private readonly takedownComment: TakedownJinyeCommentUseCase,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: ResolveJinyeReportCommand): Promise<JinyeReportWithTarget> {
    const row = await this.reports.findById(cmd.id);
    if (!row) {
      throw new NotFoundError('JINYE_REPORT_NOT_FOUND', 'Laporan tidak ditemukan');
    }
    if (row.status !== 'open') {
      throw new ConflictError(
        'REPORT_ALREADY_RESOLVED',
        'Laporan ini sudah ditindaklanjuti',
      );
    }

    const note = cmd.note?.trim() || null;

    if (cmd.resolution === 'taken_down') {
      if (row.targetStatus === 'published') {
        if (row.targetType === 'jinye') {
          await this.takedownJinye.execute({
            id: row.targetId,
            actorId: cmd.actorId,
            requestId: cmd.requestId,
          });
        } else {
          await this.takedownComment.execute({
            commentId: row.targetId,
            actorId: cmd.actorId,
            requestId: cmd.requestId,
          });
        }
      }
      await this.reports.resolveAllOpenForTarget({
        targetType: row.targetType,
        targetId: row.targetId,
        resolutionNote: note,
        resolvedBy: cmd.actorId,
      });
    } else {
      const ok = await this.reports.resolve({
        id: cmd.id,
        status: 'dismissed',
        resolution: 'dismissed',
        resolutionNote: note,
        resolvedBy: cmd.actorId,
      });
      if (!ok) {
        throw new ConflictError(
          'REPORT_ALREADY_RESOLVED',
          'Laporan ini sudah ditindaklanjuti',
        );
      }
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'jinye.report.resolve',
      entityType: row.targetType,
      entityId: row.targetId,
      newData: {
        report_id: cmd.id,
        resolution: cmd.resolution,
      },
      requestId: cmd.requestId ?? null,
    });

    const fresh = await this.reports.findById(cmd.id);
    if (!fresh) {
      throw new NotFoundError('JINYE_REPORT_NOT_FOUND', 'Laporan tidak ditemukan');
    }
    return fresh;
  }
}
