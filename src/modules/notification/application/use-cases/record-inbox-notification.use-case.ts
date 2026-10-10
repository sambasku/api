import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import { CSV_IMPORTER_USER_ID } from '@/shared/constants/csv-importer';
import type {
  InboxNotificationType,
  NotificationActionKind,
  NotificationTargetKind,
} from '../../domain/entities/notification.entity';
import { inboxCopyFor } from '../../domain/entities/notification.entity';
import type { NotificationRepository } from '../../domain/repositories/notification.repository';

export interface RecordInboxNotificationCommand {
  userId: string;
  type: InboxNotificationType;
  targetKind: NotificationTargetKind;
  targetId: string;
  /** Menimpa salinan bawaan, misalnya menyertakan nama aktor. */
  title?: string;
  /** Menimpa salinan bawaan, misalnya menyertakan lemma. */
  body?: string;
  /** Tipe body eksplisit: plain | html | md | webview. Default dari inboxCopyFor(type). */
  bodyType?: 'plain' | 'html' | 'md' | 'webview';
  /** Takedown ulang pada kata yang sama: tulis ulang dan tandai belum dibaca. */
  refreshOnConflict?: boolean;
  /** Pelaku aksi; jika sama dengan userId, notifikasi diri sendiri dilewati. */
  actorId?: string;
  /** CTA tap (#19). */
  actionKind?: NotificationActionKind | null;
  actionValue?: string | null;
}

function logError(obj: Record<string, unknown>, msg: string) {
  console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...obj }));
}

// Tulis baris inbox setelah keputusan review. Best-effort: gagal insert
// tidak menggagalkan approve/reject (preseden NotifyUserUseCase / FCM).
// Anonim dan pengimpor CSV tidak punya inbox (user sistem).
export class RecordInboxNotificationUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(cmd: RecordInboxNotificationCommand): Promise<void> {
    if (
      !cmd.userId ||
      cmd.userId === ANONIM_USER_ID ||
      cmd.userId === CSV_IMPORTER_USER_ID
    ) {
      return;
    }
    // Aksi sendiri → tidak perlu notifikasi (mis. verifikator menyetujui kontribusi sendiri)
    if (cmd.actorId && cmd.actorId === cmd.userId) return;

    const copy = inboxCopyFor(cmd.type);
    const input = {
      userId: cmd.userId,
      type: cmd.type,
      title: cmd.title?.trim() ? cmd.title.trim() : copy.title,
      body: cmd.body?.trim() ? cmd.body.trim() : copy.body,
      bodyType: cmd.bodyType ?? copy.bodyType,
      targetKind: cmd.targetKind,
      targetId: cmd.targetId,
      actionKind: cmd.actionKind ?? null,
      actionValue: cmd.actionValue ?? null,
    };
    try {
      if (cmd.refreshOnConflict) {
        await this.notificationRepo.upsertUnread(input);
      } else {
        await this.notificationRepo.create(input);
      }
    } catch (err) {
      logError(
        {
          user_id: cmd.userId,
          type: cmd.type,
          target_id: cmd.targetId,
          error: err instanceof Error ? err.message : String(err),
        },
        'inbox notification insert failed',
      );
    }
  }
}
