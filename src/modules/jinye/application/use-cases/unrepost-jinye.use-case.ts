import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

/** Batalkan repost polos milik actor. */
export class UnrepostJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'jinye_reposted';
        actorId: string;
        targetId: string;
        dedupeKey: string;
        hidden: true;
      }) => Promise<void>;
    },
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    requestId?: string | null;
  }): Promise<void> {
    const repost = await this.repo.findPlainRepostByUser(
      input.jinyeId,
      input.userId,
    );
    if (!repost) {
      throw new NotFoundError(
        'JINYE_REPOST_NOT_FOUND',
        'Repost tidak ditemukan',
      );
    }

    const ok = await this.repo.markDeletedByAuthor(repost.id, input.userId);
    if (!ok) {
      throw new NotFoundError(
        'JINYE_REPOST_NOT_FOUND',
        'Repost tidak ditemukan',
      );
    }
    if (repost.repostOfId) {
      await this.repo.adjustRepostCount(repost.repostOfId, -1);
    }

    await this.auditRepo.record({
      userId: input.userId,
      action: 'delete',
      entityType: 'jinye',
      entityId: repost.id,
      newData: { kind: 'unrepost', original_id: input.jinyeId },
      requestId: input.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_reposted',
      actorId: input.userId,
      targetId: repost.id,
      dedupeKey: `jinye_repost:${input.userId}:${input.jinyeId}`,
      hidden: true,
    });
  }
}
