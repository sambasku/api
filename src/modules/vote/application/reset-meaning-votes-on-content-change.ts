import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/shared/database/drizzle/client';
import {
  activityEvents,
  appSettings,
  meaningVoteCounts,
  meanings,
  voteResetArchives,
  votes,
  words,
} from '@/shared/database/drizzle/schema';
import { generateId } from '@/shared/utils/ulid';
import {
  DEFAULT_VOTE_RESET_ON_EDIT_ENABLED,
  VOTE_RESET_ON_EDIT_ENABLED_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';

export type VoteResetReason =
  | 'suggestion_applied'
  | 'suggestion_selfapply'
  | 'verifier_direct_edit';

export interface ResetMeaningVotesOnContentChangeInput {
  meaningIds: string[];
  wordId: string;
  reason: VoteResetReason;
  actorId: string;
  suggestionId?: string | null;
}

/**
 * G2b: archive vote hidup → hapus → nolkan deck count → unverify makna →
 * hide event vote_meaning → rollup lemma. Hormati kill switch
 * `vote_reset_on_edit_enabled` (default false).
 */
export async function resetMeaningVotesOnContentChange(
  input: ResetMeaningVotesOnContentChangeInput,
): Promise<{ archived: number; meaningsReset: number }> {
  const uniqueMeaningIds = [...new Set(input.meaningIds.filter(Boolean))];
  if (uniqueMeaningIds.length === 0) {
    return { archived: 0, meaningsReset: 0 };
  }

  if (!(await isVoteResetOnEditEnabled())) {
    return { archived: 0, meaningsReset: 0 };
  }

  const batchId = generateId();
  const resetAt = new Date();
  let archived = 0;

  await db.transaction(async (tx) => {
    const liveVotes = await tx
      .select({
        id: votes.id,
        userId: votes.userId,
        entityType: votes.entityType,
        entityId: votes.entityId,
        value: votes.value,
        clientId: votes.clientId,
        createdAt: votes.createdAt,
        updatedAt: votes.updatedAt,
      })
      .from(votes)
      .where(
        and(
          eq(votes.entityType, 'meaning'),
          inArray(votes.entityId, uniqueMeaningIds),
        ),
      );

    if (liveVotes.length > 0) {
      await tx.insert(voteResetArchives).values(
        liveVotes.map((v) => ({
          batchId,
          voteId: v.id,
          userId: v.userId,
          entityType: v.entityType,
          entityId: v.entityId,
          value: v.value,
          clientId: v.clientId,
          votedAt: v.createdAt,
          voteUpdatedAt: v.updatedAt,
          reason: input.reason,
          suggestionId: input.suggestionId ?? null,
          actorId: input.actorId,
          wordId: input.wordId,
          resetAt,
        })),
      );
      archived = liveVotes.length;

      await tx
        .delete(votes)
        .where(
          and(
            eq(votes.entityType, 'meaning'),
            inArray(votes.entityId, uniqueMeaningIds),
          ),
        );
    }

    for (const meaningId of uniqueMeaningIds) {
      await tx
        .insert(meaningVoteCounts)
        .values({ meaningId, total: 0, updatedAt: resetAt })
        .onConflictDoUpdate({
          target: meaningVoteCounts.meaningId,
          set: { total: 0, updatedAt: resetAt },
        });
    }

    await tx
      .update(meanings)
      .set({
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null,
        needsReview: false,
        updatedBy: input.actorId,
        updatedAt: resetAt,
      })
      .where(
        and(inArray(meanings.id, uniqueMeaningIds), isNull(meanings.deletedAt)),
      );

    await tx
      .update(activityEvents)
      .set({ hiddenAt: resetAt })
      .where(
        and(
          eq(activityEvents.kind, 'vote_meaning'),
          inArray(activityEvents.targetId, uniqueMeaningIds),
          isNull(activityEvents.hiddenAt),
        ),
      );

    // Rollup lemma: semua makna published harus verified.
    const rows = await tx
      .select({ isVerified: meanings.isVerified })
      .from(meanings)
      .where(
        and(
          eq(meanings.wordId, input.wordId),
          eq(meanings.status, 'published'),
          isNull(meanings.deletedAt),
        ),
      );
    const allVerified = rows.length > 0 && rows.every((r) => r.isVerified === true);
    await tx
      .update(words)
      .set(
        allVerified
          ? { isVerified: true }
          : { isVerified: false, verifiedBy: null, verifiedAt: null },
      )
      .where(and(eq(words.id, input.wordId), isNull(words.deletedAt)));
  });

  return { archived, meaningsReset: uniqueMeaningIds.length };
}

async function isVoteResetOnEditEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, VOTE_RESET_ON_EDIT_ENABLED_KEY))
    .limit(1);
  if (!row) return DEFAULT_VOTE_RESET_ON_EDIT_ENABLED;
  return row.value === 'true';
}

/** Helper tes: paksa evaluasi tanpa DB settings (di-mock lewat spy bila perlu). */
export const __test = { isVoteResetOnEditEnabled };
