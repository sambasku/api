import { and, eq, sql } from 'drizzle-orm';
import {
  activityEvents,
  examples,
  meanings,
  pronunciations,
  votes,
  wordAudios,
  wordImages,
} from '@/shared/database/drizzle/schema';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import type {
  ActivityEventKind,
  AppendActivityEventInput,
} from '../domain/entities/activity-event.entity';
import type {
  ActivityEventRepository,
  AppendResult,
} from '../domain/repositories/activity-event.repository';

/** EntityType kontribusi anak -> wordId induknya. */
export async function resolveContributionWordId(
  db: AppDatabase,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  switch (entityType) {
    case 'word':
      return entityId;
    case 'word_image': {
      const [r] = await db
        .select({ wordId: wordImages.wordId })
        .from(wordImages)
        .where(eq(wordImages.id, entityId))
        .limit(1);
      return r?.wordId ?? null;
    }
    case 'word_audio': {
      const [r] = await db
        .select({ wordId: wordAudios.wordId })
        .from(wordAudios)
        .where(eq(wordAudios.id, entityId))
        .limit(1);
      return r?.wordId ?? null;
    }
    case 'pronunciation': {
      const [r] = await db
        .select({ wordId: pronunciations.wordId })
        .from(pronunciations)
        .where(eq(pronunciations.id, entityId))
        .limit(1);
      return r?.wordId ?? null;
    }
    case 'example': {
      const [r] = await db
        .select({ wordId: meanings.wordId })
        .from(examples)
        .innerJoin(meanings, eq(meanings.id, examples.meaningId))
        .where(eq(examples.id, entityId))
        .limit(1);
      return r?.wordId ?? null;
    }
    default:
      return null;
  }
}

export class ActivityEventRepositoryImpl implements ActivityEventRepository {
  constructor(private readonly db: AppDatabase) {}

  async append(input: AppendActivityEventInput): Promise<AppendResult> {
    return this.db.transaction(async (tx) => {
      // Kontribusi anak: targetId = id baris anak; wordId induk diresolve di
      // sini supaya semua caller cukup kirim entityId.
      let targetWordId = input.targetWordId ?? null;
      if (targetWordId === null && input.kind.startsWith('contribution_')) {
        const entityType: Record<string, string> = {
          contribution_image: 'word_image',
          contribution_audio: 'word_audio',
          contribution_pron: 'pronunciation',
          contribution_example: 'example',
        };
        const mapped = entityType[input.kind];
        if (mapped && input.targetId) {
          targetWordId = await resolveContributionWordId(tx as unknown as AppDatabase, mapped, input.targetId);
        }
      }
      const rows = await tx
        .insert(activityEvents)
        .values({
          kind: input.kind,
          actorId: input.actorId ?? null,
          targetWordId,
          targetId: input.targetId ?? null,
          occurredAt: input.occurredAt ?? new Date(),
          dedupeKey: input.dedupeKey ?? null,
          hiddenAt: input.hidden ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: activityEvents.dedupeKey,
          // Re-append event tersembunyi (dedupe key sama) = tampilkan lagi;
          // waktu kejadian TIDAK di-reset (sejarah beku).
          set: { hiddenAt: input.hidden ? new Date() : null },
        })
        .returning({ id: activityEvents.id });
      return rows.length > 0 ? 'appended' : 'duplicate';
    });
  }

  async setHidden(
    kind: ActivityEventKind,
    actorId: string,
    targetId: string,
    hidden: boolean,
  ): Promise<void> {
    await this.db
      .update(activityEvents)
      .set({ hiddenAt: hidden ? new Date() : null })
      .where(
        and(
          eq(activityEvents.kind, kind),
          eq(activityEvents.actorId, actorId),
          eq(activityEvents.targetId, targetId),
          // Isi null saat unhide supaya idempoten; saat hide biarkan apa adanya
          // (event sudah tersembunyi tidak perlu di-stamp ulang).
          hidden ? sql`${activityEvents.hiddenAt} is null` : sql`${activityEvents.hiddenAt} is not null`,
        ),
      );
  }

  async syncVoteVisibility(
    actorId: string,
    targetType: 'word' | 'comment',
    targetId: string,
  ): Promise<void> {
    const kind: ActivityEventKind = targetType === 'word' ? 'vote_word' : 'vote_comment';
    const [vote] = await this.db
      .select({ id: votes.id })
      .from(votes)
      .where(
        and(
          eq(votes.userId, actorId),
          eq(votes.entityType, targetType),
          eq(votes.entityId, targetId),
        ),
      )
      .limit(1);
    // Cari event vote terbaru aktif milik pasangan ini (bisa ada dua event:
    // up lalu down saat flip; keduanya disinkron agar hanya yang cocok tayang).
    const events = await this.db
      .select({ id: activityEvents.id, hiddenAt: activityEvents.hiddenAt })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.kind, kind),
          eq(activityEvents.actorId, actorId),
          eq(activityEvents.targetId, targetId),
        ),
      );
    if (events.length === 0) return;
    for (const ev of events) {
      const shouldHide = !vote;
      if (shouldHide !== (ev.hiddenAt !== null)) {
        await this.db
          .update(activityEvents)
          .set({ hiddenAt: shouldHide ? new Date() : null })
          .where(eq(activityEvents.id, ev.id));
      }
    }
  }
}
