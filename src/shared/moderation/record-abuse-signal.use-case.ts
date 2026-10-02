import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { UserRepository } from '@/modules/auth/domain/repositories/user.repository';
import type { RefreshTokenRepository } from '@/modules/auth/domain/repositories/refresh-token.repository';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import {
  type RecordUgcAbuseEventInput,
  type UgcAbuseEventRepository,
  type UgcAbuseSignal,
  UGC_ABUSE_WEIGHTS,
} from './ugc-abuse-event.repository';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface RecordAbuseSignalCommand extends Omit<RecordUgcAbuseEventInput, 'weight'> {
  /** Override bobot default signal. */
  weight?: number;
  requestId?: string | null;
  /**
   * Aktor untuk audit/inbox saat policy memicu pause/deactivate.
   * Default: user yang sama (aksi otomatis).
   */
  systemActorId?: string;
}

/**
 * Catat sinyal abuse lalu evaluasi policy progresif:
 * score≥3/24h → mute 1 jam
 * score≥6/7d → mute 24 jam
 * score≥10/30d → can_contribute=false
 * 2x policy_pause/90d atau score≥20/30d → is_active=false
 */
export class RecordAbuseSignalUseCase {
  constructor(
    private readonly abuseRepo: UgcAbuseEventRepository,
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
  ) {}

  async execute(cmd: RecordAbuseSignalCommand): Promise<void> {
    if (!cmd.userId || cmd.userId === ANONIM_USER_ID) return;

    const signal = cmd.signal;
    const weight = cmd.weight ?? UGC_ABUSE_WEIGHTS[signal] ?? 0;

    await this.abuseRepo.record({
      userId: cmd.userId,
      signal,
      weight,
      entityType: cmd.entityType,
      entityId: cmd.entityId,
      meta: cmd.meta,
    });

    // Event policy_* hanya jejak - jangan re-evaluate agar tidak loop.
    if (signal.startsWith('policy_')) return;

    await this.evaluatePolicy(cmd.userId, cmd.systemActorId ?? cmd.userId, cmd.requestId ?? null);
  }

  private async evaluatePolicy(
    userId: string,
    actorId: string,
    requestId: string | null,
  ): Promise<void> {
    const now = Date.now();
    const score24h = await this.abuseRepo.sumWeightSince(userId, new Date(now - DAY_MS));
    const score7d = await this.abuseRepo.sumWeightSince(userId, new Date(now - 7 * DAY_MS));
    const score30d = await this.abuseRepo.sumWeightSince(userId, new Date(now - 30 * DAY_MS));
    const pauseCount90d = await this.abuseRepo.countSignalSince(
      userId,
      'policy_pause',
      new Date(now - 90 * DAY_MS),
    );

    if (score30d >= 20 || pauseCount90d >= 2) {
      await this.deactivate(userId, actorId, requestId);
      return;
    }

    if (score30d >= 10) {
      await this.pauseContribute(userId, actorId, requestId);
      return;
    }

    if (score7d >= 6) {
      await this.muteUntil(userId, new Date(now + DAY_MS), actorId, requestId, '24h');
      return;
    }

    if (score24h >= 3) {
      await this.muteUntil(userId, new Date(now + HOUR_MS), actorId, requestId, '1h');
    }
  }

  private async muteUntil(
    userId: string,
    until: Date,
    actorId: string,
    requestId: string | null,
    label: string,
  ): Promise<void> {
    const gate = await this.userRepo.getContributeGate(userId);
    if (!gate || !gate.isActive || !gate.canContribute) return;

    const current = gate.contributeMutedUntil;
    if (current && current.getTime() >= until.getTime()) return;

    await this.userRepo.setContributeMutedUntil(userId, until);
    await this.abuseRepo.record({
      userId,
      signal: 'policy_mute',
      weight: 0,
      meta: { muted_until: until.toISOString(), window: label },
    });
    await this.auditRepo.record({
      userId: actorId,
      action: 'auto_mute_contribute',
      entityType: 'user',
      entityId: userId,
      newData: {
        contribute_muted_until: until.toISOString(),
        window: label,
        automated: true,
      },
      requestId,
    });
  }

  private async pauseContribute(
    userId: string,
    actorId: string,
    requestId: string | null,
  ): Promise<void> {
    const gate = await this.userRepo.getContributeGate(userId);
    if (!gate || gate.canContribute === false) return;

    await this.userRepo.setCanContribute(userId, false);
    await this.abuseRepo.record({
      userId,
      signal: 'policy_pause',
      weight: 0,
      meta: { automated: true },
    });
    await this.auditRepo.record({
      userId: actorId,
      action: 'auto_pause_contribute',
      entityType: 'user',
      entityId: userId,
      newData: { can_contribute: false, automated: true },
      requestId,
    });
    await this.inbox?.execute({
      userId,
      type: 'contribution_paused',
      targetKind: 'word',
      targetId: userId,
      actorId,
    });
  }

  private async deactivate(
    userId: string,
    actorId: string,
    requestId: string | null,
  ): Promise<void> {
    const gate = await this.userRepo.getContributeGate(userId);
    if (!gate || !gate.isActive) return;

    // Root tidak di-auto-deactivate (parity SetUserActive).
    const user = await this.userRepo.findById(userId);
    if (!user || user.roles.includes('root')) return;

    await this.userRepo.setIsActive(userId, false);
    await this.refreshTokenRepo.revokeAllForUser(userId);
    await this.abuseRepo.record({
      userId,
      signal: 'policy_deactivate',
      weight: 0,
      meta: { automated: true },
    });
    await this.auditRepo.record({
      userId: actorId,
      action: 'auto_deactivate',
      entityType: 'user',
      entityId: userId,
      oldData: { is_active: true },
      newData: { is_active: false, automated: true },
      requestId,
    });
  }
}

/** Helper fire-and-forget aman di use case (jangan gagalkan create jika policy error). */
export async function safeRecordAbuseSignal(
  recorder: RecordAbuseSignalUseCase | undefined,
  cmd: RecordAbuseSignalCommand,
): Promise<void> {
  if (!recorder) return;
  try {
    await recorder.execute(cmd);
  } catch {
    // best-effort - abuse ledger tidak boleh memutus alur utama
  }
}

export type { UgcAbuseSignal };
