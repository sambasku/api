import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { lemmaMergeRequests } from '@/shared/database/drizzle/schema';
import { ConflictError, NotFoundError } from '@/shared/errors/app-error';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';

export interface RejectLemmaMergeCommand {
  requestId: string;
  reviewerId: string;
  reviewNote?: string | null;
}

export class RejectLemmaMergeUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly activity: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: RejectLemmaMergeCommand): Promise<{ requestId: string; status: 'rejected' }> {
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

    const now = new Date();
    await this.db
      .update(lemmaMergeRequests)
      .set({
        status: 'rejected',
        reviewedBy: cmd.reviewerId,
        reviewedAt: now,
        reviewNote: cmd.reviewNote?.trim() || null,
        updatedAt: now,
      })
      .where(eq(lemmaMergeRequests.id, cmd.requestId));

    await this.activity.safe({
      kind: 'lemma_merge_created',
      actorId: req.proposerId,
      targetWordId: req.keepWordId,
      targetId: req.id,
      dedupeKey: `lemma_merge:${req.id}`,
      hidden: true,
    });

    return { requestId: req.id, status: 'rejected' };
  }
}