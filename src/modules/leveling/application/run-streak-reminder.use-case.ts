import { and, eq, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { notifications, users } from '@/shared/database/drizzle/schema';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type { AppSettingsRepository } from '@/modules/legal/domain/repositories/app-settings.repository';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { NotifyUserUseCase } from '@/modules/device/application/use-cases/notify-user.use-case';
import { wibDateKey, WIB_OFFSET_HOURS } from '../domain/streak';

export const STREAK_REMINDER_ENABLED_KEY = 'streak_reminder_enabled';
export const STREAK_REMINDER_BATCH = 5;
export const STREAK_REMINDER_INACTIVE_MS = 48 * 3600_000;
/** Akun harus verified minimal 3 hari sebelum eligible. */
export const STREAK_REMINDER_MIN_VERIFIED_MS = 3 * 24 * 3600_000;

export function isWibQuietHoursOpen(nowMs: number = Date.now()): boolean {
  const shifted = new Date(nowMs + WIB_OFFSET_HOURS * 3600_000);
  const hour = shifted.getUTCHours();
  return hour >= 8 && hour < 20;
}

/**
 * Cron job: pengingat aktivitas (inbox + FCM), batch kecil per tick.
 * Spek: docs/LEVELING_AND_STREAK_IMPLEMENT.md §9
 */
export class RunStreakReminderUseCase {
  constructor(
    private readonly db: AppDatabase,
    private readonly settings: AppSettingsRepository,
    private readonly recordInbox: RecordInboxNotificationUseCase,
    private readonly notifyUser: NotifyUserUseCase,
  ) {}

  async execute(nowMs: number = Date.now()): Promise<{
    ran: boolean;
    sent: number;
    reason?: string;
  }> {
    const enabled = await this.settings.getValue(STREAK_REMINDER_ENABLED_KEY);
    if (enabled !== '1' && enabled !== 'true') {
      return { ran: false, sent: 0, reason: 'kill_switch_off' };
    }
    if (!isWibQuietHoursOpen(nowMs)) {
      return { ran: false, sent: 0, reason: 'quiet_hours' };
    }

    const dayKey = wibDateKey(nowMs);
    const inactiveBefore = new Date(nowMs - STREAK_REMINDER_INACTIVE_MS);
    const verifiedBefore = new Date(nowMs - STREAK_REMINDER_MIN_VERIFIED_MS);

    // Eligible: aktif pernah, verified ≥3 hari, sepi ≥48 jam, bukan anonim,
    // opt-in notify_streak_reminder. Belum punya streak_reminder hari WIB ini.
    const candidates = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          isNull(users.deletedAt),
          ne(users.id, ANONIM_USER_ID),
          eq(users.emailVerified, true),
          eq(users.notifyStreakReminder, true),
          isNotNull(users.lastSeenAt),
          lt(users.lastSeenAt, inactiveBefore),
          isNotNull(users.emailVerifiedAt),
          lt(users.emailVerifiedAt, verifiedBefore),
          sql`not exists (
            select 1 from ${notifications} n
            where n.user_id = ${users.id}
              and n.type = 'streak_reminder'
              and n.target_kind = 'day'
              and n.target_id = ${dayKey}
          )`,
          sql`not exists (
            select 1 from ${notifications} n
            where n.user_id = ${users.id}
              and n.type = 'streak_reminder'
              and n.created_at >= ${Math.floor((nowMs - STREAK_REMINDER_INACTIVE_MS) / 1000)}
          )`,
        ),
      )
      .orderBy(sql`${users.lastSeenAt} asc`)
      .limit(STREAK_REMINDER_BATCH);

    let sent = 0;
    let failed = 0;
    const title = 'Sudah lama tidak mampir';
    const body =
      'Kalau sempat, isi jejak kecil hari ini ya - usul, tinjau, atau diskusi.';

    for (const row of candidates) {
      try {
        await this.recordInbox.execute({
          userId: row.id,
          type: 'streak_reminder',
          targetKind: 'day',
          targetId: dayKey,
          title,
          body,
          actionKind: 'url',
          actionValue: '/activity',
        });
        await this.notifyUser.execute({
          userId: row.id,
          title,
          body,
          data: { type: 'streak_reminder', day: dayKey },
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `[streak-reminder] gagal user=${row.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return { ran: true, sent, ...(failed > 0 ? { reason: `partial_fail_${failed}` } : {}) };
  }
}
