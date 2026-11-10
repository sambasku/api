import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
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
import { isUniqueViolationOn } from '@/shared/database/drizzle/sqlite-errors';
import { generateId } from '@/shared/utils/ulid';
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
        targetWordId = await resolveContributionWordId(
          this.db,
          mapped,
          input.targetId,
        );
      }
    }

    // #56: verifikasi kata = puncak cerita kata itu. Event usulan
    // (contribution_submitted / word_created pengusul) utk kata yang sama
    // ditandai superseded → feed home 1 baris, profil tetap memuat riwayat.
    // Payload beku membawa nama pengusul (copy "Memverifikasi usulan X: ...").
    if (input.kind === 'word_verified' && targetWordId) {
      return this.db.transaction(async (tx) => {
        const payload = input.proposedByName
          ? `Memverifikasi usulan ${input.proposedByName}: {lemma}`
          : (input.payload ?? null);
        const eventId = generateId();
        const values = {
          id: eventId,
          kind: input.kind,
          actorId: input.actorId ?? null,
          targetWordId,
          targetId: input.targetId ?? null,
          occurredAt: input.occurredAt ?? new Date(),
          dedupeKey: input.dedupeKey ?? null,
          payload,
          hiddenAt: input.hidden ? new Date() : null,
        };
        // ponytail: Turso/libsql staging menolak ON CONFLICT…RETURNING
        // ("Failed query"). INSERT polos + catch unique; id dari client.
        let resolvedId = eventId;
        try {
          await tx.insert(activityEvents).values(values);
        } catch (err) {
          if (!isUniqueViolationOn(err, 'dedupe')) throw err;
          if (!input.dedupeKey) return 'duplicate';
          await tx
            .update(activityEvents)
            .set({
              hiddenAt: input.hidden ? new Date() : null,
              ...(payload !== null ? { payload } : {}),
            })
            .where(eq(activityEvents.dedupeKey, input.dedupeKey));
          const [existing] = await tx
            .select({ id: activityEvents.id })
            .from(activityEvents)
            .where(eq(activityEvents.dedupeKey, input.dedupeKey))
            .limit(1);
          if (!existing) return 'duplicate';
          resolvedId = existing.id;
        }
        await tx
          .update(activityEvents)
          .set({ supersededAt: new Date() })
          .where(
            and(
              eq(activityEvents.targetWordId, targetWordId),
              inArray(activityEvents.kind, [
                'contribution_submitted',
                'word_created',
              ]),
              isNull(activityEvents.supersededAt),
              // jangan supersede event verifikasi itu sendiri
              ne(activityEvents.id, resolvedId),
            ),
          );
        return 'appended';
      });
    }

    const values = {
      id: generateId(),
      kind: input.kind,
      actorId: input.actorId ?? null,
      targetWordId,
      targetId: input.targetId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      dedupeKey: input.dedupeKey ?? null,
      payload: input.payload ?? null,
      hiddenAt: input.hidden ? new Date() : null,
    };
    // Re-append event tersembunyi (dedupe key sama) = tampilkan lagi;
    // waktu kejadian TIDAK di-reset (sejarah beku). Payload ikut ditimpa:
    // flip arah vote dengan dedupe key sama menimpa copy.
    const conflictSet = {
      hiddenAt: input.hidden ? new Date() : null,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    };

    // ponytail: JANGAN ON CONFLICT + RETURNING - Turso staging gagal keduanya
    // (DO UPDATE RETURNING lalu DO NOTHING RETURNING). INSERT polos + catch
    // unique + UPDATE by dedupe = efek sama, SQL paling sederhana.
    if (input.dedupeKey) {
      try {
        await this.db.insert(activityEvents).values(values);
      } catch (err) {
        if (!isUniqueViolationOn(err, 'dedupe')) throw err;
        await this.db
          .update(activityEvents)
          .set(conflictSet)
          .where(eq(activityEvents.dedupeKey, input.dedupeKey));
      }
      return 'appended';
    }

    try {
      await this.db.insert(activityEvents).values(values);
      return 'appended';
    } catch (err) {
      if (isUniqueViolationOn(err, 'dedupe')) return 'duplicate';
      throw err;
    }
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

  async hidePlacePhoto(placeId: string, url: string): Promise<void> {
    await this.db
      .update(activityEvents)
      .set({ hiddenAt: new Date() })
      .where(
        and(
          eq(activityEvents.kind, 'place_photo_added'),
          eq(activityEvents.targetId, placeId),
          sql`instr(${activityEvents.dedupeKey}, ${url}) > 0`,
          sql`${activityEvents.hiddenAt} is null`,
        ),
      );
  }

  async syncVoteVisibility(
    actorId: string,
    targetType: 'word' | 'comment' | 'meaning',
    targetId: string,
  ): Promise<void> {
    const kind: ActivityEventKind =
      targetType === 'word'
        ? 'vote_word'
        : targetType === 'meaning'
          ? 'vote_meaning'
          : 'vote_comment';
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
