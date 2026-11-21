import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import { meanings } from '@/shared/database/drizzle/schema';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordRepository } from '../../domain/repositories/word.repository';

export interface VerifyMeaningCommand {
  meaningId: string;
  verified: boolean;
  actorId: string;
  requestId?: string | null;
}

/**
 * Verifikator memflip is_verified satu makna lalu rollup lemma
 * (docs/produk/trust-makna-hot-loop.md G1).
 */
export class VerifyMeaningUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: VerifyMeaningCommand): Promise<{ wordId: string }> {
    const [row] = await db
      .select({
        id: meanings.id,
        wordId: meanings.wordId,
        isVerified: meanings.isVerified,
      })
      .from(meanings)
      .where(and(eq(meanings.id, cmd.meaningId), isNull(meanings.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundError('MEANING_NOT_FOUND', 'Makna dengan id tersebut tidak ditemukan');
    }
    if (row.isVerified === cmd.verified) {
      throw new ConflictError(
        cmd.verified ? 'MEANING_ALREADY_VERIFIED' : 'MEANING_ALREADY_UNVERIFIED',
        cmd.verified ? 'Makna ini sudah terverifikasi' : 'Makna ini belum terverifikasi',
      );
    }

    const result = await this.wordRepo.setMeaningVerified(cmd.meaningId, {
      isVerified: cmd.verified,
      verifiedBy: cmd.actorId,
      verifiedAt: new Date(),
      clearNeedsReview: true,
    });
    if (!result) {
      throw new NotFoundError('MEANING_NOT_FOUND', 'Makna dengan id tersebut tidak ditemukan');
    }

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: cmd.verified ? 'verify' : 'unverify',
      entityType: 'meaning',
      entityId: cmd.meaningId,
      oldData: { is_verified: !cmd.verified },
      newData: { is_verified: cmd.verified, word_id: result.wordId },
      requestId: cmd.requestId ?? null,
    });

    return result;
  }
}
