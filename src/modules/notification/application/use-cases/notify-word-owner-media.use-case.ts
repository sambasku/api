import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { WordRepository } from '@/modules/word/domain/repositories/word.repository';
import type { RecordInboxNotificationUseCase } from './record-inbox-notification.use-case';
import type { WordMediaPushCooldownGate } from './word-media-push-cooldown-gate';

export type WordOwnerMediaEntityType = 'example' | 'word_audio';

export interface NotifyWordOwnerMediaCommand {
  entityType: WordOwnerMediaEntityType;
  entityId: string;
  /** Pelaku (kontributor). Sama dengan owner → dilewati. */
  actorId: string;
}

/** Judul per jenis media; body selalu menyebut nama aktor + lemma. */
const TITLE_BY_TYPE: Record<WordOwnerMediaEntityType, string> = {
  example: 'Contoh baru',
  word_audio: 'Pelafalan baru',
};

function bodyFor(entityType: WordOwnerMediaEntityType, actorName: string, lemma: string): string {
  return entityType === 'example'
    ? `${actorName} menambahkan contoh kalimat di "${lemma}".`
    : `${actorName} merekam pelafalan "${lemma}".`;
}

function logError(msg: string, obj: Record<string, unknown>) {
  console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...obj }));
}

/**
 * #133: beri tahu PEMILIK KATA (words.created_by) saat contoh kalimat atau
 * audio pelafalan pada katanya tayang. Inbox + push FCM (cooldown Skip
 * channel `word_media`). Best-effort: kegagalan notif tidak menggagalkan
 * pembuatan konten (preseden ToggleVoteUseCase.notifyWordOwner).
 *
 * Contoh dikirim saat create (langsung published), audio kontributor
 * pending_review sehingga dikirim dari jalur approve review.
 */
export class NotifyWordOwnerMediaUseCase {
  constructor(
    private readonly wordRepo: Pick<WordRepository, 'findWordOwnerByChild'>,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly notifyUser?: NotifyUserUseCase,
    private readonly userRepo?: Pick<UserRepository, 'findById'>,
    private readonly pushCooldown?: WordMediaPushCooldownGate,
  ) {}

  async execute(cmd: NotifyWordOwnerMediaCommand): Promise<void> {
    if (!this.inbox && !this.notifyUser) return;

    try {
      const resolved = await this.wordRepo.findWordOwnerByChild(cmd.entityType, cmd.entityId);
      const ownerUserId = resolved?.ownerUserId;
      if (!resolved || !ownerUserId) return;
      if (ownerUserId === cmd.actorId) return;
      if (ownerUserId === ANONIM_USER_ID || ownerUserId === CSV_IMPORTER_USER_ID) return;

      let actorName = 'Seseorang';
      if (this.userRepo) {
        const actor = await this.userRepo.findById(cmd.actorId);
        if (actor) actorName = actor.displayName?.trim() || actor.username;
      }

      const title = TITLE_BY_TYPE[cmd.entityType];
      const body = bodyFor(cmd.entityType, actorName, resolved.lemma);

      if (this.inbox) {
        await this.inbox.execute({
          userId: ownerUserId,
          type: cmd.entityType === 'example' ? 'word_example' : 'word_audio',
          targetKind: 'word',
          targetId: resolved.wordId,
          actorId: cmd.actorId,
          title,
          body,
          // Satu baris per (owner, type, kata): media berikutnya menimpa.
          refreshOnConflict: true,
          actionKind: 'word',
          actionValue: resolved.wordId,
        });
      }

      if (this.notifyUser) {
        const maySend =
          !this.pushCooldown || (await this.pushCooldown.maySend(ownerUserId));
        if (maySend) {
          await this.notifyUser.execute({
            userId: ownerUserId,
            title,
            body,
            actorId: cmd.actorId,
            data: {
              type: cmd.entityType === 'example' ? 'word_example' : 'word_audio',
              target_kind: 'word',
              target_id: resolved.wordId,
              action_kind: 'word',
              action_value: resolved.wordId,
            },
          });
          await this.pushCooldown?.touchAfterSend(ownerUserId);
        }
      }
    } catch (err) {
      logError('word owner media notify failed', {
        entity_type: cmd.entityType,
        entity_id: cmd.entityId,
        actor_id: cmd.actorId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
