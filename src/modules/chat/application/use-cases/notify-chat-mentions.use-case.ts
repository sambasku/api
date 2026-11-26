import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { NotificationPushCooldownRepository } from '@/modules/notification/domain/repositories/notification-push-cooldown.repository';
import type { NotificationRepository } from '@/modules/notification/domain/repositories/notification.repository';
import { ANONIM_USERNAME } from '@/shared/constants/anonim';
import type { ChatMessage } from '../../domain/entities/chat-message.entity';

/** Batas mention unik per pesan: jaga subrequest (inbox + push per penerima). */
export const CHAT_MENTION_MAX_PER_MESSAGE = 3;
/** Satu push mention per penerima per jendela ini. Inbox tetap selalu masuk. */
export const CHAT_MENTION_PUSH_COOLDOWN_SECONDS = 60;

const CHAT_MENTION_TITLE = 'Kamu disebut di chat';
const CHAT_MENTION_SNIPPET_MAX = 80;
const MENTION_REGEX = /@([a-zA-Z0-9_.-]{3,30})/g;

function log(level: 'warn' | 'error', msg: string, obj: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...obj });
  if (level === 'error') console.error(line);
  else console.warn(line);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncateSnippet(text: string, max = CHAT_MENTION_SNIPPET_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

/**
 * Username unik dari teks chat. Titik/strip di akhir dibuang supaya
 * "@budi." (akhir kalimat) tetap cocok ke "budi".
 */
export function extractChatMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_REGEX)) {
    const username = match[1].replace(/[.-]+$/, '');
    if (username.length < 3 || username === ANONIM_USERNAME) continue;
    found.add(username);
  }
  return [...found];
}

export interface ResolveChatMentionsInput {
  body: string | null | undefined;
  /** Body sebelum edit; username yang sudah ada di sini tidak dinotifikasi ulang. */
  previousBody?: string | null;
  authorUsername: string | null;
  replyToId: string | null;
  replyUsername: string | null;
}

/**
 * Username yang berhak dinotifikasi: bukan penulis, bukan mention lama
 * (edit), bukan auto-mention hasil reply, maksimal
 * [CHAT_MENTION_MAX_PER_MESSAGE].
 */
export function resolveChatMentionUsernames(input: ResolveChatMentionsInput): string[] {
  const body = input.body ?? '';
  const previous = new Set(extractChatMentions(input.previousBody).map((u) => u.toLowerCase()));
  const author = input.authorUsername?.toLowerCase() ?? null;

  // Reply menyisipkan "@username " otomatis di awal (mobile startReply).
  // Itu bukan mention manual, jadi tidak memicu notif (keputusan #360).
  let autoReply: string | null = null;
  const replyName = input.replyUsername?.trim();
  if (input.replyToId && replyName) {
    const auto = new RegExp(`^@${escapeRegex(replyName)}(?![a-zA-Z0-9_.-])`, 'i');
    if (auto.test(body.trimStart())) autoReply = replyName.toLowerCase();
  }

  return extractChatMentions(body)
    .filter((u) => {
      const lower = u.toLowerCase();
      return lower !== author && lower !== autoReply && !previous.has(lower);
    })
    .slice(0, CHAT_MENTION_MAX_PER_MESSAGE);
}

/**
 * Notifikasi mention di chat publik (#360): inbox `chat_mention` + push.
 *
 * - Satu query penerima (`findMentionableByUsernames`), bukan N+1.
 * - Idempoten lewat `executeIfNew` (unique user+type+target): edit pesan
 *   tidak menggandakan inbox, dan push hanya jalan saat baris inbox baru.
 * - Push dibatasi 1 per penerima per 60 detik; inbox tidak dibatasi.
 * - Best-effort: gagal tidak membatalkan kirim chat ([safe]).
 */
export class NotifyChatMentionsUseCase {
  constructor(
    private readonly userRepo: Pick<UserRepository, 'findMentionableByUsernames'>,
    private readonly inbox: Pick<RecordInboxNotificationUseCase, 'executeIfNew'>,
    private readonly notifyUser: Pick<NotifyUserUseCase, 'execute'>,
    private readonly cooldownRepo: NotificationPushCooldownRepository,
    private readonly notificationRepo: Pick<NotificationRepository, 'deleteByTarget'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async notify(message: ChatMessage, previousBody?: string | null): Promise<void> {
    if (message.deletedAt || (message.kind !== 'text' && message.kind !== 'sticker')) return;

    const usernames = resolveChatMentionUsernames({
      body: message.body,
      previousBody,
      authorUsername: message.username,
      replyToId: message.replyToId,
      replyUsername: message.replyUsername,
    });
    if (usernames.length === 0) return;

    const found = await this.userRepo.findMentionableByUsernames(usernames);
    const recipients = found.filter((u) => u.id !== message.userId);
    if (recipients.length === 0) return;

    const actorName = message.displayName?.trim() || message.username || 'Seseorang';
    const body = `${actorName} menyebutmu di chat: ${truncateSnippet(message.body ?? '')}`;

    for (const recipient of recipients) {
      try {
        const inserted = await this.inbox.executeIfNew({
          userId: recipient.id,
          type: 'chat_mention',
          targetKind: 'chat',
          targetId: message.id,
          actorId: message.userId,
          title: CHAT_MENTION_TITLE,
          body,
          actionKind: 'chat',
          actionValue: message.id,
        });
        if (!inserted) continue;
        if (!(await this.mayPush(recipient.id))) continue;

        await this.notifyUser.execute({
          userId: recipient.id,
          title: CHAT_MENTION_TITLE,
          body,
          actorId: message.userId,
          data: {
            type: 'chat_mention',
            target_kind: 'chat',
            target_id: message.id,
            action_kind: 'chat',
            action_value: message.id,
          },
        });
        await this.cooldownRepo.touch(recipient.id, 'chat_mention', this.now());
      } catch (err) {
        log('warn', 'chat mention notify failed', {
          user_id: recipient.id,
          message_id: message.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /** Best-effort: tidak pernah melempar ke alur kirim/edit chat. */
  async safe(message: ChatMessage, previousBody?: string | null): Promise<void> {
    try {
      await this.notify(message, previousBody);
    } catch (err) {
      log('error', 'chat mention failed', {
        message_id: message.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Pesan dihapus: inbox mention ke pesan itu ikut dihapus (best-effort). */
  async clear(messageId: string): Promise<void> {
    try {
      await this.notificationRepo.deleteByTarget({
        type: 'chat_mention',
        targetKind: 'chat',
        targetId: messageId,
      });
    } catch (err) {
      log('warn', 'chat mention clear failed', {
        message_id: messageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async mayPush(userId: string): Promise<boolean> {
    const last = await this.cooldownRepo.get(userId, 'chat_mention');
    if (!last) return true;
    const elapsedMs = this.now().getTime() - last.lastPushAt.getTime();
    return elapsedMs >= CHAT_MENTION_PUSH_COOLDOWN_SECONDS * 1000;
  }
}
