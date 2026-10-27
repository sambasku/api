import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { TakedownPantunUseCase } from '@/modules/pantun/application/use-cases/takedown-pantun.use-case';
import { TakedownPantunReplyUseCase } from '@/modules/pantun/application/use-cases/takedown-pantun-reply.use-case';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { PantunReportWithTarget } from '../../domain/entities/pantun-report.entity';
import type { PantunReportRepository } from '../../domain/repositories/pantun-report.repository';

export interface ResolvePantunReportCommand {
  id: string;
  resolution: 'dismissed' | 'taken_down';
  note?: string | null;
  actorId: string;
  requestId?: string | null;
}

/**
 * Tutup satu laporan. `taken_down` juga menarik target lalu menutup semua
 * laporan open pada target yang sama (satu target bisa dilaporkan banyak orang).
 */
export class ResolvePantunReportUseCase {
  constructor(
    private readonly reports: PantunReportRepository,
    private readonly takedownPantun: TakedownPantunUseCase,
    private readonly takedownReply: TakedownPantunReplyUseCase,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: ResolvePantunReportCommand): Promise<PantunReportWithTarget> {
    const row = await this.reports.findById(cmd.id);
    if (!row) {
      throw new NotFoundError('PANTUN_REPORT_NOT_FOUND', 'Laporan tidak ditemukan');
    }
    if (row.status !== 'open') {
      throw new ConflictError(
        'REPORT_ALREADY_RESOLVED',
        'Laporan ini sudah ditindaklanjuti',
      );
    }

    const note = cmd.note?.trim() || null;

    if (cmd.resolution === 'taken_down') {
      // Target mungkin sudah ditarik lewat route admin lain: jangan 404,
      // cukup tutup sisa laporan open.
      if (row.targetStatus === 'published') {
        if (row.targetType === 'pantun') {
          await this.takedownPantun.execute({
            id: row.targetId,
            actorId: cmd.actorId,
            requestId: cmd.requestId,
          });
        } else {
          await this.takedownReply.execute({
            replyId: row.targetId,
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
      action: 'pantun.report.resolve',
      entityType: row.targetType,
      entityId: row.targetId,
      newData: {
        report_id: cmd.id,
        resolution: cmd.resolution,
      },
      requestId: cmd.requestId ?? null,
    });

    const updated = await this.reports.findById(cmd.id);
    return updated ?? row;
  }
}
