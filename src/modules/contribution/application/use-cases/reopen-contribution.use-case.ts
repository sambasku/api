import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ContributionEntityType } from '../../domain/entities/contribution.entity';
import type { ContributionRepository } from '../../domain/repositories/contribution.repository';

export interface ReopenContributionCommand {
  contributionId: string;
  actorId: string;
  /** admin|root boleh reopen keputusan orang lain */
  actorRole: string;
  requestId?: string | null;
}

export interface ReopenContributionOutcome {
  contributionId: string;
  entityType: ContributionEntityType;
  entityId: string;
  status: 'pending';
  reopenedBy: string;
}

/**
 * Buka ulang keputusan review: status → pending + soft-claim reopened_by.
 * Jejak contribution_reviews tetap (append-only). Decide berikutnya
 * menulis baris review baru dan mengosongkan reopened_by.
 */
export class ReopenContributionUseCase {
  constructor(
    private readonly contributionRepo: ContributionRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: ReopenContributionCommand): Promise<ReopenContributionOutcome> {
    const contrib = await this.contributionRepo.findById(cmd.contributionId);
    if (!contrib) {
      throw new NotFoundError('CONTRIBUTION_NOT_FOUND', 'Kontribusi dengan id tersebut tidak ditemukan');
    }
    if (contrib.status === 'pending') {
      throw new ConflictError(
        'CONTRIBUTION_NOT_REOPENABLE',
        'Kontribusi ini masih menunggu review - tidak perlu dibuka ulang',
      );
    }

    const latest = await this.contributionRepo.findReview(cmd.contributionId);
    if (!latest) {
      throw new ConflictError(
        'CONTRIBUTION_NOT_REOPENABLE',
        'Belum ada keputusan review yang bisa dibuka ulang',
      );
    }

    const elevated = cmd.actorRole === 'admin' || cmd.actorRole === 'root';
    if (!elevated && latest.reviewerId !== cmd.actorId) {
      throw new ForbiddenError(
        'CONTRIBUTION_REOPEN_FORBIDDEN',
        'Hanya verifikator yang memberi keputusan ini yang boleh membuka ulang',
      );
    }

    const outcome = await this.contributionRepo.reopen({
      contributionId: cmd.contributionId,
      actorId: cmd.actorId,
    });

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'reopen',
      entityType: outcome.entityType,
      entityId: outcome.entityId,
      newData: {
        contribution_id: outcome.contributionId,
        status: outcome.status,
        reopened_by: outcome.reopenedBy,
        previous_review_status: latest.status,
      },
      requestId: cmd.requestId ?? null,
    });

    return outcome;
  }
}
