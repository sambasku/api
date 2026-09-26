import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import {
  DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES,
  REVIEW_APPROVE_PUSH_COOLDOWN_MINUTES_KEY,
  REVIEW_REJECT_PUSH_COOLDOWN_MINUTES_KEY,
} from '@/modules/legal/domain/entities/app-setting.entity';
import type {
  NotificationPushCooldownRepository,
  ReviewPushCooldownChannel,
} from '../../domain/repositories/notification-push-cooldown.repository';

function log(level: 'info' | 'warn', msg: string, obj: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...obj });
  if (level === 'warn') console.warn(line);
  else console.log(line);
}

function parseCooldownMinutes(raw: string | null): number {
  if (raw == null || raw === '') return DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return DEFAULT_REVIEW_PUSH_COOLDOWN_MINUTES;
  return n;
}

/**
 * Gate Skip: push pertama langsung; selama cooldown menit berikutnya di-skip.
 * Inbox tidak memakai gate ini.
 */
export class ReviewPushCooldownGate {
  constructor(
    private readonly settingsRepo: AppSettingsRepository,
    private readonly cooldownRepo: NotificationPushCooldownRepository,
  ) {}

  channelForDecision(decision: 'approve' | 'reject'): ReviewPushCooldownChannel {
    return decision === 'approve' ? 'contribution_approved' : 'contribution_rejected';
  }

  async resolveMinutes(decision: 'approve' | 'reject'): Promise<number> {
    const key =
      decision === 'approve'
        ? REVIEW_APPROVE_PUSH_COOLDOWN_MINUTES_KEY
        : REVIEW_REJECT_PUSH_COOLDOWN_MINUTES_KEY;
    return parseCooldownMinutes(await this.settingsRepo.getValue(key));
  }

  /** true = boleh kirim push FCM sekarang. */
  async maySend(userId: string, decision: 'approve' | 'reject'): Promise<boolean> {
    const minutes = await this.resolveMinutes(decision);
    if (minutes <= 0) return true;

    const channel = this.channelForDecision(decision);
    const last = await this.cooldownRepo.get(userId, channel);
    if (!last) return true;

    const elapsedMs = Date.now() - last.lastPushAt.getTime();
    const windowMs = minutes * 60_000;
    if (elapsedMs >= windowMs) return true;

    log('info', 'push skipped: review cooldown aktif', {
      user_id: userId,
      channel,
      cooldown_minutes: minutes,
      last_push_at: last.lastPushAt.toISOString(),
      remaining_ms: windowMs - elapsedMs,
    });
    return false;
  }

  async touchAfterSend(userId: string, decision: 'approve' | 'reject'): Promise<void> {
    await this.cooldownRepo.touch(userId, this.channelForDecision(decision));
  }
}
