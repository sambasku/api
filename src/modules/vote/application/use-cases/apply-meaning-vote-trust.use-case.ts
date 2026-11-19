import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import {
  VOTING_WARGA_DISPLAY_NAME,
  VOTING_WARGA_NEEDS_REVIEW_NET,
  VOTING_WARGA_NET_THRESHOLD,
  VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD,
  VOTING_WARGA_USER_ID,
} from '@/shared/constants/voting-warga';
import { AUTO_VERIFY_BY_VOTE_ENABLED_KEY } from '@/modules/legal/domain/entities/app-setting.entity';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';

export interface ApplyMeaningVoteTrustCommand {
  meaningId: string;
  upvotes: number;
  downvotes: number;
  /** Actor vote terakhir (audit/log saja; verified_by = Voting Warga). */
  actorId: string;
  requestId?: string | null;
}

export type ApplyMeaningVoteTrustResult =
  | { action: 'none' }
  | { action: 'auto_verified'; wordId: string }
  | { action: 'auto_rejected'; wordId: string; wordRejected: boolean }
  | { action: 'needs_review'; wordId: string };

/**
 * Setelah toggle vote makna:
 * - belum verified: quorum +5 → auto_verified; quorum -5 → auto_rejected
 * - sudah verified + net jelek → needs_review (tidak cabut centang)
 * Kill switch `auto_verify_by_vote_enabled` mematikan verif **dan** tolak.
 */
export class ApplyMeaningVoteTrustUseCase {
  constructor(
    private readonly wordRepo: WordRepository,
    private readonly settingsRepo: AppSettingsRepository,
    private readonly auditRepo?: AuditLogRepository,
    private readonly activityEvents?: RecordActivityEventUseCase,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
  ) {}

  async execute(cmd: ApplyMeaningVoteTrustCommand): Promise<ApplyMeaningVoteTrustResult> {
    const state = await this.wordRepo.findMeaningTrustState(cmd.meaningId);
    if (!state) return { action: 'none' };
    // Hanya makna tayang yang ikut quorum.
    if (state.status !== 'published') return { action: 'none' };

    const net = cmd.upvotes - cmd.downvotes;
    // Satu baris vote per user → unique voters = up + down.
    const uniqueVoters = cmd.upvotes + cmd.downvotes;

    if (!state.isVerified) {
      const enabled = await this.isAutoVerifyEnabled();
      if (!enabled || uniqueVoters < VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD) {
        return { action: 'none' };
      }

      if (net >= VOTING_WARGA_NET_THRESHOLD) {
        return this.autoVerify(cmd, state, net, uniqueVoters);
      }

      if (net <= VOTING_WARGA_NEEDS_REVIEW_NET) {
        return this.autoReject(cmd, state, net, uniqueVoters);
      }

      return { action: 'none' };
    }

    // Sudah verified: net jelek → needs_review (sticky sampai tim / reset-edit).
    if (net > VOTING_WARGA_NEEDS_REVIEW_NET || state.needsReview) {
      return { action: 'none' };
    }

    const flagged = await this.wordRepo.setMeaningNeedsReview(
      cmd.meaningId,
      true,
      VOTING_WARGA_USER_ID,
    );
    if (!flagged?.changed) return { action: 'none' };

    await this.auditRepo
      ?.record({
        userId: VOTING_WARGA_USER_ID,
        action: 'flag_needs_review',
        entityType: 'meaning',
        entityId: cmd.meaningId,
        oldData: { needs_review: false },
        newData: {
          needs_review: true,
          word_id: flagged.wordId,
          net,
          unique_voters: uniqueVoters,
          trigger_actor_id: cmd.actorId,
        },
        requestId: cmd.requestId ?? null,
      })
      .catch(() => undefined);

    await this.notifyMeaningCreator({
      userId: state.createdBy,
      wordId: flagged.wordId,
      lemma: state.lemma,
      type: 'meaning_needs_review',
      title: 'Makna perlu ditinjau ulang',
      body: `Makna di "${state.lemma}" dapat banyak downvote setelah terverifikasi. Tim kami cek lagi.`,
    });

    return { action: 'needs_review', wordId: flagged.wordId };
  }

  private async autoVerify(
    cmd: ApplyMeaningVoteTrustCommand,
    state: {
      meaningId: string;
      wordId: string;
      lemma: string;
      createdBy: string | null;
    },
    net: number,
    uniqueVoters: number,
  ): Promise<ApplyMeaningVoteTrustResult> {
    const verified = await this.wordRepo.setMeaningVerified(cmd.meaningId, {
      isVerified: true,
      verifiedBy: VOTING_WARGA_USER_ID,
      verifiedAt: new Date(),
      clearNeedsReview: true,
    });
    if (!verified) return { action: 'none' };

    await this.auditRepo
      ?.record({
        userId: VOTING_WARGA_USER_ID,
        action: 'verify',
        entityType: 'meaning',
        entityId: cmd.meaningId,
        oldData: { is_verified: false },
        newData: {
          is_verified: true,
          word_id: verified.wordId,
          net,
          unique_voters: uniqueVoters,
          trigger_actor_id: cmd.actorId,
        },
        requestId: cmd.requestId ?? null,
      })
      .catch(() => undefined);

    await this.activityEvents?.safe({
      kind: 'word_verified',
      actorId: VOTING_WARGA_USER_ID,
      targetWordId: verified.wordId,
      targetId: cmd.meaningId,
      dedupeKey: `word_verified:${verified.wordId}:meaning:${cmd.meaningId}`,
      payload: `"${state.lemma}" diverifikasi lewat ${VOTING_WARGA_DISPLAY_NAME}`,
    });

    await this.notifyMeaningCreator({
      userId: state.createdBy,
      wordId: verified.wordId,
      lemma: state.lemma,
      type: 'meaning_auto_verified',
      title: 'Makna terverifikasi warga',
      body: `Makna di "${state.lemma}" sudah terverifikasi lewat ${VOTING_WARGA_DISPLAY_NAME}.`,
    });

    return { action: 'auto_verified', wordId: verified.wordId };
  }

  private async autoReject(
    cmd: ApplyMeaningVoteTrustCommand,
    state: {
      meaningId: string;
      wordId: string;
      lemma: string;
      createdBy: string | null;
    },
    net: number,
    uniqueVoters: number,
  ): Promise<ApplyMeaningVoteTrustResult> {
    const rejected = await this.wordRepo.rejectMeaningByCommunityVote(
      cmd.meaningId,
      VOTING_WARGA_USER_ID,
    );
    if (!rejected) return { action: 'none' };

    await this.auditRepo
      ?.record({
        userId: VOTING_WARGA_USER_ID,
        action: 'reject',
        entityType: 'meaning',
        entityId: cmd.meaningId,
        oldData: { status: 'published', is_verified: false },
        newData: {
          status: 'rejected',
          word_id: rejected.wordId,
          word_rejected: rejected.wordRejected,
          net,
          unique_voters: uniqueVoters,
          trigger_actor_id: cmd.actorId,
        },
        requestId: cmd.requestId ?? null,
      })
      .catch(() => undefined);

    await this.notifyMeaningCreator({
      userId: state.createdBy,
      wordId: rejected.wordId,
      lemma: state.lemma,
      type: 'meaning_auto_rejected',
      title: 'Makna ditolak warga',
      body: rejected.wordRejected
        ? `Makna di "${state.lemma}" ditolak lewat ${VOTING_WARGA_DISPLAY_NAME}. Kata ditarik dari tayang.`
        : `Makna di "${state.lemma}" ditolak lewat ${VOTING_WARGA_DISPLAY_NAME}.`,
    });

    return {
      action: 'auto_rejected',
      wordId: rejected.wordId,
      wordRejected: rejected.wordRejected,
    };
  }

  private async isAutoVerifyEnabled(): Promise<boolean> {
    const raw = await this.settingsRepo.getValue(AUTO_VERIFY_BY_VOTE_ENABLED_KEY);
    return raw === 'true';
  }

  private async notifyMeaningCreator(input: {
    userId: string | null;
    wordId: string;
    lemma: string;
    type: 'meaning_auto_verified' | 'meaning_needs_review' | 'meaning_auto_rejected';
    title: string;
    body: string;
  }): Promise<void> {
    if (!input.userId) return;
    if (
      input.userId === ANONIM_USER_ID ||
      input.userId === CSV_IMPORTER_USER_ID ||
      input.userId === VOTING_WARGA_USER_ID
    ) {
      return;
    }
    try {
      if (this.inbox) {
        await this.inbox.execute({
          userId: input.userId,
          type: input.type,
          targetKind: 'word',
          targetId: input.wordId,
          actorId: VOTING_WARGA_USER_ID,
          title: input.title,
          body: input.body,
          refreshOnConflict: true,
          actionKind: 'word',
          actionValue: input.wordId,
        });
      }
      if (this.notifyUser) {
        await this.notifyUser.execute({
          userId: input.userId,
          title: input.title,
          body: input.body,
          actorId: VOTING_WARGA_USER_ID,
          data: {
            type: input.type,
            target_kind: 'word',
            target_id: input.wordId,
            action_kind: 'word',
            action_value: input.wordId,
          },
        });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'meaning vote trust notify failed',
          type: input.type,
          word_id: input.wordId,
          user_id: input.userId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
