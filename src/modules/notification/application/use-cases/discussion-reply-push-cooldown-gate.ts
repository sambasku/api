import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import {
  DEFAULT_WORD_COMMENT_PUSH_COOLDOWN_MINUTES,
  WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type { NotificationPushCooldownRepository } from '../../domain/repositories/notification-push-cooldown.repository';

const CHANNEL = 'discussion_reply' as const;

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
 * Gate Skip untuk push balasan Ruang Diskusi.
 * Memakai setting yang sama dengan komentar kosakata
 * (`notification.word_comment_push_cooldown_minutes`); channel terpisah
 * supaya spam di lemma tidak menekan notif Ruang Diskusi (dan sebaliknya).
 */
export class DiscussionReplyPushCooldownGate {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly cooldownRepo: NotificationPushCooldownRepository,
  ) {}

  async resolveMinutes(): Promise<number> {
    return parseCooldownMinutes(await this.settingsRepo.getValue(WORD_COMMENT_PUSH_COOLDOWN_MINUTES_KEY));
  }

  async maySend(userId: string): Promise<boolean> {
    const minutes = await this.resolveMinutes();
    if (minutes <= 0) return true;

    const last = await this.cooldownRepo.get(userId, CHANNEL);
    if (!last) return true;

    const elapsedMs = Date.now() - last.lastPushAt.getTime();
    const windowMs = minutes * 60_000;
    if (elapsedMs >= windowMs) return true;

    log('info', 'push skipped: discussion_reply cooldown aktif', {
      user_id: userId,
      channel: CHANNEL,
      cooldown_minutes: minutes,
      last_push_at: last.lastPushAt.toISOString(),
      remaining_ms: windowMs - elapsedMs,
    });
    return false;
  }

  async touchAfterSend(userId: string): Promise<void> {
    await this.cooldownRepo.touch(userId, CHANNEL);
  }
}
