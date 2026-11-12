import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/app-error';
import type { Jinye } from '../../domain/entities/jinye.entity';
import type { JinyeRepository } from '../../domain/repositories/jinye.repository';

/** Repost polos (toggle create). Tidak makan kuota 1/jam. Depth max 1. */
export class RepostJinyeUseCase {
  constructor(
    private readonly repo: JinyeRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activityEvents?: {
      safe: (cmd: {
        kind: 'jinye_reposted';
        actorId: string;
        targetId: string;
        dedupeKey: string;
      }) => Promise<void>;
    },
  ) {}

  async execute(input: {
    jinyeId: string;
    userId: string;
    requestId?: string | null;
  }): Promise<Jinye> {
    await assertCanContribute(input.userId);

    const original = await this.repo.findById(input.jinyeId);
    if (!original || original.status !== 'published') {
      throw new NotFoundError('JINYE_NOT_FOUND', 'Jinye tidak ditemukan');
    }
    if (original.repostOfId) {
      throw new ValidationError([
        {
          field: 'id',
          message: 'Tidak bisa merepost konten yang sudah berupa repost/quote.',
        },
      ]);
    }
    if (original.userId === input.userId) {
      throw new ForbiddenError(
        'CANNOT_REPOST_OWN',
        'Tidak perlu merepost Jinye milik sendiri.',
      );
    }

    const existing = await this.repo.findPlainRepostByUser(
      original.id,
      input.userId,
    );
    if (existing) {
      throw new ConflictError(
        'ALREADY_REPOSTED',
        'Kamu sudah merepost Jinye ini. Batalkan dulu kalau mau mengulang.',
      );
    }

    const created = await this.repo.create({
      userId: input.userId,
      body: '',
      images: [],
      repostOfId: original.id,
      quoteBody: null,
    });
    await this.repo.adjustRepostCount(original.id, 1);

    await this.auditRepo.record({
      userId: input.userId,
      action: 'create',
      entityType: 'jinye',
      entityId: created.id,
      newData: { kind: 'repost', original_id: original.id },
      requestId: input.requestId ?? null,
    });

    await this.activityEvents?.safe({
      kind: 'jinye_reposted',
      actorId: input.userId,
      targetId: created.id,
      dedupeKey: `jinye_repost:${input.userId}:${original.id}`,
    });

    return created;
  }
}
