import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import {
  VOTING_WARGA_DISPLAY_NAME,
  VOTING_WARGA_NET_THRESHOLD,
  VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD,
  VOTING_WARGA_USER_ID,
} from '@/shared/constants/voting-warga';
import {
  AUTO_VERIFY_BY_VOTE_ENABLED_KEY,
  DEFAULT_VOTING_WARGA_NET_THRESHOLD,
  DEFAULT_VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD,
  VOTING_WARGA_NET_THRESHOLD_KEY,
  VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import { resetMeaningVotesOnContentChange } from '../reset-meaning-votes-on-content-change';

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
  | {
      action: 'unverify_reset';
      wordId: string;
      batchId: string | null;
      archived: number;
    };

type MeaningTrustState = {
  meaningId: string;
  wordId: string;
  lemma: string;
  status: string;
  isVerified: boolean;
  needsReview: boolean;
  createdBy: string | null;
};

/**
 * Setelah toggle vote makna:
 * - belum verified: quorum +N → auto_verified; quorum -N → auto_rejected
 * - sudah verified + quorum -N → archive+unverify+reset vote (menunggu pengecekan)
 * Kill switch `auto_verify_by_vote_enabled` mematikan semua aksi di atas.
 * Ambang N dari app_settings (fallback konstanta TS = 5).
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
    if (state.status !== 'published') return { action: 'none' };

    const enabled = await this.isAutoVerifyEnabled();
    if (!enabled) return { action: 'none' };

    const { netThreshold, uniqueThreshold } = await this.resolveThresholds();
    const net = cmd.upvotes - cmd.downvotes;
    const uniqueVoters = cmd.upvotes + cmd.downvotes;
    if (uniqueVoters < uniqueThreshold) return { action: 'none' };

    if (!state.isVerified) {
      if (net >= netThreshold) {
        return this.autoVerify(cmd, state, net, uniqueVoters, netThreshold);
      }
      if (net <= -netThreshold) {
        return this.autoReject(cmd, state, net, uniqueVoters, netThreshold);
      }
      return { action: 'none' };
    }

    // Sudah verified: quorum jelek → commit history + unverify + reset vote.
    if (net > -netThreshold) return { action: 'none' };

    return this.unverifyAndResetVotes(cmd, state, net, uniqueVoters, netThreshold);
  }

  private async unverifyAndResetVotes(
    cmd: ApplyMeaningVoteTrustCommand,
    state: MeaningTrustState,
    net: number,
    uniqueVoters: number,
    netThreshold: number,
  ): Promise<ApplyMeaningVoteTrustResult> {
    const reset = await resetMeaningVotesOnContentChange({
      meaningIds: [cmd.meaningId],
      wordId: state.wordId,
      reason: 'voting_warga_dispute',
      actorId: VOTING_WARGA_USER_ID,
      skipEditKillSwitch: true,
    });

    if (reset.meaningsReset === 0) return { action: 'none' };

    await this.auditRepo
      ?.record({
        userId: VOTING_WARGA_USER_ID,
        action: 'unverify_by_vote_quorum',
        entityType: 'meaning',
        entityId: cmd.meaningId,
        oldData: {
          is_verified: true,
          needs_review: state.needsReview,
        },
        newData: {
          is_verified: false,
          needs_review: false,
          word_id: state.wordId,
          net,
          unique_voters: uniqueVoters,
          threshold_n: netThreshold,
          trigger_actor_id: cmd.actorId,
          batch_id: reset.batchId,
          archived_votes: reset.archived,
        },
        requestId: cmd.requestId ?? null,
      })
      .catch(() => undefined);

    await this.notifyMeaningCreator({
      userId: state.createdBy,
      wordId: state.wordId,
      lemma: state.lemma,
      type: 'meaning_needs_review',
      title: 'Makna kembali menunggu pengecekan',
      body: `Makna di "${state.lemma}" dapat banyak downvote setelah terverifikasi. Centang dicabut, skor vote di-reset - menunggu pengecekan lagi.`,
    });

    return {
      action: 'unverify_reset',
      wordId: state.wordId,
      batchId: reset.batchId,
      archived: reset.archived,
    };
  }

  private async autoVerify(
    cmd: ApplyMeaningVoteTrustCommand,
    state: MeaningTrustState,
    net: number,
    uniqueVoters: number,
    netThreshold: number,
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
          threshold_n: netThreshold,
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
    state: MeaningTrustState,
    net: number,
    uniqueVoters: number,
    netThreshold: number,
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
          threshold_n: netThreshold,
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

  private async resolveThresholds(): Promise<{
    netThreshold: number;
    uniqueThreshold: number;
  }> {
    const [netRaw, uniqueRaw] = await Promise.all([
      this.settingsRepo.getValue(VOTING_WARGA_NET_THRESHOLD_KEY),
      this.settingsRepo.getValue(VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD_KEY),
    ]);
    return {
      netThreshold: parsePositiveInt(
        netRaw,
        DEFAULT_VOTING_WARGA_NET_THRESHOLD || VOTING_WARGA_NET_THRESHOLD,
      ),
      uniqueThreshold: parsePositiveInt(
        uniqueRaw,
        DEFAULT_VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD ||
          VOTING_WARGA_UNIQUE_VOTERS_THRESHOLD,
      ),
    };
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
    } catch {
      // Notifikasi gagal tidak boleh gagalkan quorum.
    }
  }
}

function parsePositiveInt(raw: string | null | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}
