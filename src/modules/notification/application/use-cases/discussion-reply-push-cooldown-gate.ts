import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import {
  DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES,
  WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type {
  NotificationPushCooldownChannel,
  NotificationPushCooldownRepository,
} from '../../domain/repositories/notification-push-cooldown.repository';

/** Channel yang di-throttle lewat setting cooldown komentar. */
export type ReplyPushCooldownChannel = Extract<
  NotificationPushCooldownChannel,
  'discussion_reply' | 'pantun_reply'
>;

function log(level: 'info' | 'warn', msg: string, obj: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...obj });
  if (level === 'warn') console.warn(line);
  else console.log(line);
}

function parseCooldownMinutes(raw: string | null): number {
  if (raw == null || raw === '') return DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES;
  return n;
}

/**
 * Gate Skip untuk push balasan thread (Ruang Diskusi dan pantun).
 * Memakai setting yang sama dengan komentar kosakata
 * (`notification.word_comment_push_cooldown_minutes`); channel terpisah
 * supaya spam di satu modul tidak menekan notif modul lain.
 */
export class ReplyPushCooldownGate {
  constructor(
    readonly settingsRepo: AppSettingsRepository,
    private readonly cooldownRepo: NotificationPushCooldownRepository,
    private readonly channel: ReplyPushCooldownChannel = 'discussion_reply',
  ) {}

  async resolveMinutes(): Promise<number> {
    return parseCooldownMinutes(
      await this.settingsRepo.getValue(WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY),
    );
  }

  async maySend(userId: string): Promise<boolean> {
    const minutes = await this.resolveMinutes();
    if (minutes <= 0) return true;
    const last = await this.cooldownRepo.get(userId, this.channel);
    if (!last) return true;
    const elapsedMinutes = (Date.now() - last.lastPushAt.getTime()) / 60_000;
    if (elapsedMinutes >= minutes) return true;
    log('info', 'push skipped: cooldown aktif', {
      user_id: userId,
      channel: this.channel,
      last_push_at: last.lastPushAt.toISOString(),
      minutes,
    });
    return false;
  }

  async touchAfterSend(userId: string): Promise<void> {
    try {
      await this.cooldownRepo.touch(userId, this.channel);
    } catch (err) {
      log('warn', 'push cooldown touch failed', {
        user_id: userId,
        channel: this.channel,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** Alias lama - jangan ubah call-site diskusi sekaligus (diff kecil). */
export { ReplyPushCooldownGate as DiscussionReplyPushCooldownGate };
