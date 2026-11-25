import type { AppDatabase } from '@/shared/database/drizzle/client';
import { lemmaMergeRequests } from '@/shared/database/drizzle/schema';
import { ValidationError } from '@/shared/errors/app-error';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { assertLemmaMergeBatchAllowed } from './lemma-merge-preflight';
import type { ApproveLemmaMergeUseCase } from './approve-lemma-merge.use-case';

export interface CreateLemmaMergeCommand {
  proposerId: string;
  actorRole?: string | null;
  keepWordId: string;
  mergeWordIds: string[];
  reasonText?: string | null;
}

export class CreateLemmaMergeUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly activity: RecordActivityEventUseCase,
    private readonly approve: ApproveLemmaMergeUseCase,
  ) {}

  async execute(cmd: CreateLemmaMergeCommand): Promise<{
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    keepWordId: string;
    mergeWordIds: string[];
    keepLemma: string;
    applied: boolean;
  }> {
    await assertCanContribute(cmd.proposerId);

    const mergeIds = [...new Set(cmd.mergeWordIds.filter((id) => id !== cmd.keepWordId))];
    if (mergeIds.length === 0) {
      throw new ValidationError([
        { field: 'merge_word_ids', message: 'Pilih minimal satu entri untuk digabung' },
      ]);
    }

    const verifier = isVerifierRole(cmd.actorRole ?? '');
    const { keepLemma } = await assertLemmaMergeBatchAllowed(this.db, cmd.keepWordId, mergeIds, {
      requirePublishedKeep: !verifier,
      proposerId: cmd.proposerId,
    });

    if (!verifier && (!cmd.reasonText || cmd.reasonText.trim().length < 10)) {
      throw new ValidationError([
        { field: 'reason_text', message: 'Jelaskan singkat kenapa entri ini satu kata (min 10 karakter)' },
      ]);
    }

    const [row] = await this.db
      .insert(lemmaMergeRequests)
      .values({
        proposerId: cmd.proposerId,
        keepWordId: cmd.keepWordId,
        mergeWordIds: mergeIds,
        status: 'pending',
        reasonText: cmd.reasonText?.trim() || null,
      })
      .returning();

    if (verifier) {
      const approved = await this.approve.execute({
        requestId: row.id,
        reviewerId: cmd.proposerId,
      });
      return {
        id: row.id,
        status: 'approved',
        keepWordId: approved.keepWordId,
        mergeWordIds: approved.mergedWordIds,
        keepLemma,
        applied: true,
      };
    }

    await this.activity.safe({
      kind: 'lemma_merge_created',
      actorId: cmd.proposerId,
      targetWordId: cmd.keepWordId,
      targetId: row.id,
      dedupeKey: `lemma_merge:${row.id}`,
      payload: keepLemma,
    });

    return {
      id: row.id,
      status: 'pending',
      keepWordId: cmd.keepWordId,
      mergeWordIds: mergeIds,
      keepLemma,
      applied: false,
    };
  }
}