import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { WordVotePushCooldownGate } from '@/modules/notification/application/use-cases/word-vote-push-cooldown-gate';
import type { RecordActivityEventUseCase } from '@/modules/activity/application/use-cases/record-activity-event.use-case';
import type {
  ToggleVoteResult,
  VoteRepository,
  VoteTargetType,
} from '../../domain/repositories/vote.repository';

export interface ToggleVoteCommand {
  userId: string;
  targetType: VoteTargetType;
  targetId: string;
  value: 1 | -1;
  /** Dari JWT azp - atribusi klien */
  clientId?: string | null;
}

const WORD_VOTE_TITLE = 'Vote baru';

function wordVoteBody(
  displayName: string,
  lemma: string,
  value: 1 | -1,
): string {
  const arah = value === 1 ? 'upvote' : 'downvote';
  return `${displayName} memberi ${arah} pada "${lemma}".`;
}

// Toggle vote (08-api-upvote-downvote.md): vote searah kedua kali = batal,
// beda arah = replace - server yang memutuskan, client hanya mengirim arah
// yang dipilih user. TANPA audit (KEPUTUSAN PRODUK: volume tinggi, bukan
// aksi admin; analitik cukup dari tabel votes sendiri).
//
// KEPUTUSAN PRODUK: target `discussion` (pertanyaan) upvote-only -
// downvote ditolak (komunitas minta jawaban, bukan konten yang di-downvote).
//
// Setelah cast (bukan unvote): inbox + push ke pemilik kata induk (best-effort),
// cooldown Skip per user (default 3 menit). Inbox tidak di-throttle.
export class ToggleVoteUseCase {
  constructor(
    private readonly voteRepo: VoteRepository,
    private readonly userRepo?: UserRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly pushCooldown?: WordVotePushCooldownGate,
    private readonly activityEvents?: RecordActivityEventUseCase,
  ) {}

  async execute(cmd: ToggleVoteCommand): Promise<ToggleVoteResult> {
    if (cmd.targetType === 'discussion' && cmd.value === -1) {
      throw new ValidationError([
        {
          field: 'value',
          message: 'Pertanyaan diskusi hanya bisa di-upvote',
        },
      ]);
    }

    const target = { entityType: cmd.targetType, entityId: cmd.targetId };

    // Eksistensi target hanya dicek di endpoint tulis ini - vote ke target
    // yang sudah dihapus → 404 (endpoint counts sengaja tidak mengecek).
    if (!(await this.voteRepo.targetExists(target))) {
      throw new NotFoundError('VOTE_TARGET_NOT_FOUND', 'Target vote tidak ditemukan atau sudah dihapus');
    }

    const result = await this.voteRepo.toggle(
      cmd.userId,
      target,
      cmd.value,
      cmd.clientId ?? null,
    );

    if (result.myVote !== null) {
      // Event feed: vote tayang sebagai aktivitas. targetWordId diresolve
      // best-effort; vote comment punya wordId lewat komentar induk.
      if (this.activityEvents && (cmd.targetType === 'word' || cmd.targetType === 'comment')) {
        const resolved = await this.voteRepo
          .resolveWordOwnerForVoteTarget({ entityType: cmd.targetType, entityId: cmd.targetId })
          .catch(() => null);
        if (resolved?.wordId) {
          await this.activityEvents.safe({
            kind: cmd.targetType === 'word' ? 'vote_word' : 'vote_comment',
            actorId: cmd.userId,
            targetWordId: resolved.wordId,
            targetId: cmd.targetId,
            // Satu event per user+target terakhir: flip arah menimpa copy.
            dedupeKey: `vote:${cmd.userId}:${cmd.targetType}:${cmd.targetId}`,
          });
        }
      }
      await this.notifyWordOwner({
        actorId: cmd.userId,
        targetType: cmd.targetType,
        targetId: cmd.targetId,
        value: result.myVote,
      });
    } else if (this.activityEvents && (cmd.targetType === 'word' || cmd.targetType === 'comment')) {
      // Unvote: baris vote dihapus hard - event feed-nya disembunyikan
      // (bukan dihapus; submit ulang menampilkan kembali, lihat dedupeKey).
      await this.activityEvents.safeVoteVisibility(
        cmd.userId,
        cmd.targetType,
        cmd.targetId,
      );
    }

    return result;
  }

  private async notifyWordOwner(input: {
    actorId: string;
    targetType: VoteTargetType;
    targetId: string;
    value: 1 | -1;
  }): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;

    try {
      const resolved = await this.voteRepo.resolveWordOwnerForVoteTarget({
        entityType: input.targetType,
        entityId: input.targetId,
      });
      if (!resolved?.ownerUserId) return;
      if (resolved.ownerUserId === input.actorId) return;
      if (
        resolved.ownerUserId === ANONIM_USER_ID ||
        resolved.ownerUserId === CSV_IMPORTER_USER_ID
      ) {
        return;
      }

      let displayName = 'Seseorang';
      if (this.userRepo) {
        const actor = await this.userRepo.findById(input.actorId);
        if (actor) {
          displayName = actor.displayName?.trim() || actor.username;
        }
      }

      const title = WORD_VOTE_TITLE;
      const body = wordVoteBody(displayName, resolved.lemma, input.value);

      if (this.inbox) {
        await this.inbox.execute({
          userId: resolved.ownerUserId,
          type: 'word_vote',
          targetKind: 'word',
          targetId: resolved.wordId,
          actorId: input.actorId,
          title,
          body,
          refreshOnConflict: true,
          actionKind: 'word',
          actionValue: resolved.wordId,
        });
      }

      if (this.notifyUser) {
        const maySend =
          !this.pushCooldown || (await this.pushCooldown.maySend(resolved.ownerUserId));
        if (maySend) {
          await this.notifyUser.execute({
            userId: resolved.ownerUserId,
            title,
            body,
            actorId: input.actorId,
            data: {
              type: 'word_vote',
              target_kind: 'word',
              target_id: resolved.wordId,
              action_kind: 'word',
              action_value: resolved.wordId,
            },
          });
          await this.pushCooldown?.touchAfterSend(resolved.ownerUserId);
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: 'word vote notify failed',
          target_type: input.targetType,
          target_id: input.targetId,
          actor_id: input.actorId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
