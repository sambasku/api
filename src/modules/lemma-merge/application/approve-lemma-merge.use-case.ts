import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { lemmaMergeRequests } from '@/shared/database/drizzle/schema';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import { LEMMA_MERGE_TX_OPTIONS } from '@/modules/word/application/utils/merge-word-entries-options';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { assertLemmaMergeBatchAllowed } from './lemma-merge-preflight';

export interface ApproveLemmaMergeCommand {
  requestId: string;
  reviewerId: string;
  reviewNote?: string | null;
}

export class ApproveLemmaMergeUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly wordRepo: WordRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly activity: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: ApproveLemmaMergeCommand): Promise<{
    requestId: string;
    keepWordId: string;
    mergedWordIds: string[];
    keepLemma: string;
  }> {
    const [req] = await this.db
      .select()
      .from(lemmaMergeRequests)
      .where(eq(lemmaMergeRequests.id, cmd.requestId))
      .limit(1);
    if (!req) {
      throw new NotFoundError('LEMMA_MERGE_NOT_FOUND', 'Usulan gabung tidak ditemukan');
    }
    if (req.status !== 'pending') {
      throw new ConflictError('LEMMA_MERGE_ALREADY_PROCESSED', 'Usulan ini sudah diproses');
    }

    const mergeIds = req.mergeWordIds ?? [];
    const { keepLemma } = await assertLemmaMergeBatchAllowed(this.db, req.keepWordId, mergeIds, {
      requirePublishedKeep: false,
    });

    const now = new Date();
    const result = await this.wordRepo.mergeWordEntries(req.keepWordId, mergeIds, cmd.reviewerId, {
      ...LEMMA_MERGE_TX_OPTIONS,
    });

    await this.db
      .update(lemmaMergeRequests)
      .set({
        status: 'approved',
        reviewedBy: cmd.reviewerId,
        reviewedAt: now,
        reviewNote: cmd.reviewNote?.trim() || null,
        updatedAt: now,
      })
      .where(eq(lemmaMergeRequests.id, cmd.requestId));

    await this.auditRepo.record({
      userId: cmd.reviewerId,
      action: 'lemma_merge_approve',
      entityType: 'word',
      entityId: result.keepWordId,
      newData: {
        lemma: keepLemma,
        merge_request_id: req.id,
        merged_word_ids: result.mergedWordIds,
      },
      requestId: null,
    });

    await this.activity.safe({
      kind: 'lemma_merge_applied',
      actorId: cmd.reviewerId,
      targetWordId: result.keepWordId,
      targetId: req.id,
      dedupeKey: `lemma_merge_applied:${req.id}`,
      payload: keepLemma,
    });

    return {
      requestId: req.id,
      keepWordId: result.keepWordId,
      mergedWordIds: result.mergedWordIds,
      keepLemma,
    };
  }
}