import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import { NotFoundError } from '@/shared/errors/app-error';
import type { UgcAbuseEventRepository } from '@/shared/moderation/ugc-abuse-event.repository';
import type {
  AnonAbuseSubject,
  UgcAnonAbuseRepository,
} from '@/shared/moderation/ugc-anon-abuse.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin cabut mute kontribusi (akun atau IP/device anon).
 *
 * Policy menghitung ulang skor rolling di setiap sinyal baru, jadi hapus mute
 * saja tidak cukup: satu sinyal berikutnya langsung memicu mute lagi. Karena
 * itu dicatat event `admin_lift` berbobot `-skor30d` (event terbaru ikut semua
 * jendela 24h/7d/30d, jadi ketiganya turun ke <= 0).
 * ponytail: saat event positif lama keluar dari jendela 30 hari, skor bisa
 * sementara negatif (lebih longgar). Upgrade: policy hanya hitung event setelah
 * `admin_lift` terakhir.
 */
export class LiftAbuseMuteUseCase {
  constructor(
    private readonly abuseRepo: UgcAbuseEventRepository,
    private readonly anonRepo: UgcAnonAbuseRepository,
    private readonly userRepo: UserRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async liftUser(cmd: { userId: string; actorId: string; requestId?: string | null }) {
    const user = await this.userRepo.findById(cmd.userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError('USER_NOT_FOUND', 'Pengguna tidak ditemukan');
    }
    const score30d = await this.abuseRepo.sumWeightSince(cmd.userId, new Date(Date.now() - 30 * DAY_MS));
    const previousMutedUntil = user.contributeMutedUntil?.toISOString() ?? null;

    await this.userRepo.setContributeMutedUntil(cmd.userId, null);
    await this.abuseRepo.record({
      userId: cmd.userId,
      signal: 'admin_lift',
      weight: -Math.max(score30d, 0),
      meta: { previous_score_30d: score30d, previous_muted_until: previousMutedUntil },
    });
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'lift_contribute_mute',
      entityType: 'user',
      entityId: cmd.userId,
      oldData: { contribute_muted_until: previousMutedUntil, score_30d: score30d },
      newData: { contribute_muted_until: null, score_30d: Math.min(score30d, 0) },
      requestId: cmd.requestId ?? null,
    });
    return { id: cmd.userId, previousScore30d: score30d };
  }

  async liftAnon(cmd: { subject: AnonAbuseSubject; actorId: string; requestId?: string | null }) {
    const score30d = await this.anonRepo.sumWeightSince(cmd.subject, new Date(Date.now() - 30 * DAY_MS));
    const previousMutedUntil = (await this.anonRepo.getMutedUntil(cmd.subject))?.toISOString() ?? null;

    const removed = await this.anonRepo.deleteMute(cmd.subject);
    await this.anonRepo.record({
      subject: cmd.subject,
      signal: 'admin_lift',
      weight: -Math.max(score30d, 0),
      meta: { previous_score_30d: score30d, previous_muted_until: previousMutedUntil },
    });
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'lift_anon_mute',
      entityType: 'anon_subject',
      entityId: `${cmd.subject.kind}:${cmd.subject.key}`,
      oldData: { muted_until: previousMutedUntil, score_30d: score30d },
      newData: { muted_until: null, score_30d: Math.min(score30d, 0) },
      requestId: cmd.requestId ?? null,
    });
    return { removed, previousScore30d: score30d };
  }
}
