import { and, eq, sql } from 'drizzle-orm';
import {
  activityEvents,
  votes,
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

export class ActivityEventRepositoryImpl implements ActivityEventRepository {
  constructor(private readonly db: AppDatabase) {}

  async append(input: AppendActivityEventInput): Promise<AppendResult> {
    try {
      await this.db
        .insert(activityEvents)
        .values({
          kind: input.kind,
          actorId: input.actorId ?? null,
          targetWordId: input.targetWordId ?? null,
          targetId: input.targetId ?? null,
          occurredAt: input.occurredAt ?? new Date(),
          dedupeKey: input.dedupeKey ?? null,
        })
        .onConflictDoNothing({ target: activityEvents.dedupeKey });
      return 'appended';
    } catch (err) {
      // UNIQUE di kolom nullable hanya menyala saat dedupeKey terisi; sisanya
      // error sungguhan (FK, dsb.) dan harus tetap naik.
      const msg = err instanceof Error ? err.message : String(err);
      if (input.dedupeKey && msg.includes('UNIQUE')) return 'duplicate';
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
