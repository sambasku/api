import { eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { lemmaMergeRequests } from '@/shared/database/drizzle/schema';
import { ValidationError } from '@/shared/errors/app-error';
import { assertCanContribute } from '@/modules/word/application/utils/assert-can-contribute';
import { isVerifierRole } from '@/modules/word/application/utils/resolve-publication';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import { assertLemmaMergeBatchAllowed } from './lemma-merge-preflight';
import type { ApproveLemmaMergeUseCase } from './approve-lemma-merge.use-case';
import type { ExplorationGroupNotifier } from '@/modules/wa/application/ports/exploration-group-notifier.port';
import { LEMMA_MERGE_GROUP_EVENT_KEY } from '@/modules/wa/application/ports/exploration-group-notifier.port';

export interface CreateLemmaMergeCommand {
  proposerId: string;
  /** Satu role atau seluruh roles JWT (pakai `isVerifierRole`). */
  actorRole?: string | string[] | null;
  keepWordId: string;
  mergeWordIds: string[];
  reasonText?: string | null;
}

export class CreateLemmaMergeUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly activity: RecordActivityEventUseCase,
    private readonly approve: ApproveLemmaMergeUseCase,
    private readonly groupNotifier?: ExplorationGroupNotifier,
  ) {}

  private async notifyBalaiGroup(
    userId: string,
    applied: boolean,
    keepLemma: string,
    mergeLemmas: string[],
  ): Promise<void> {
    try {
      const jenis = applied ? 'Gabung kata (langsung)' : 'Gabung kata (antrean)';
      const parts = [keepLemma.trim(), ...mergeLemmas.map((l) => l.trim()).filter(Boolean)];
      const name = parts.length > 0 ? parts.join(' + ') : 'tanpa nama';
      await this.groupNotifier?.notify({
        jenis,
        name,
        userId,
        eventKey: LEMMA_MERGE_GROUP_EVENT_KEY,
      });
    } catch {
      // Gagal kirim grup tidak membatalkan usulan / merge.
    }
  }

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
    const { keepLemma, mergeLemmas } = await assertLemmaMergeBatchAllowed(this.db, cmd.keepWordId, mergeIds, {
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
      try {
        const approved = await this.approve.execute({
          requestId: row.id,
          reviewerId: cmd.proposerId,
        });
        await this.notifyBalaiGroup(cmd.proposerId, true, keepLemma, mergeLemmas);
        return {
          id: row.id,
          status: 'approved',
          keepWordId: approved.keepWordId,
          mergeWordIds: approved.mergedWordIds,
          keepLemma,
          applied: true,
        };
      } catch (err) {
        // Gagal apply setelah insert pending → jangan tinggalkan antrean palsu.
        await this.db.delete(lemmaMergeRequests).where(eq(lemmaMergeRequests.id, row.id));
        throw err;
      }
    }

    await this.activity.safe({
      kind: 'lemma_merge_created',
      actorId: cmd.proposerId,
      targetWordId: cmd.keepWordId,
      targetId: row.id,
      dedupeKey: `lemma_merge:${row.id}`,
      payload: keepLemma,
    });
    await this.notifyBalaiGroup(cmd.proposerId, false, keepLemma, mergeLemmas);

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