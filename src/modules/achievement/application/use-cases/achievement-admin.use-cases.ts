import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { Achievement } from '../../domain/entities/achievement.entity';
import type { AchievementRepository, GrantResult } from '../../domain/repositories/achievement.repository';

/**
 * Admin create achievement. Validasi grammar dilakukan Zod di presentation;
 * use case fokus bisnis: kode unik + audit.
 */
export class CreateAchievementUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(input: Parameters<AchievementRepository['create']>[0]): Promise<Achievement> {
    const existing = await this.repo.findByCode(input.code);
    if (existing) {
      throw new ConflictError(
        'ACHIEVEMENT_CODE_ALREADY_EXISTS',
        `Kode achievement "${input.code}" sudah dipakai`,
      );
    }
    const created = await this.repo.create(input);
    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'create',
      entityType: 'achievement',
      entityId: created.id,
      newData: { code: created.code, title: created.title, reward_type: created.rewardType },
    });
    return created;
  }
}

/** Admin update achievement (code immutable). */
export class UpdateAchievementUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(input: Parameters<AchievementRepository['update']>[0]): Promise<Achievement> {
    const updated = await this.repo.update(input);
    if (!updated) {
      throw new NotFoundError('ACHIEVEMENT_NOT_FOUND', 'Achievement tidak ditemukan');
    }
    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'update',
      entityType: 'achievement',
      entityId: updated.id,
      newData: { title: updated.title, is_active: updated.isActive },
    });
    return updated;
  }
}

/** Admin soft delete achievement. Award yang sudah ada tetap (riwayat). */
export class DeleteAchievementUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(input: { id: string; actorId: string; requestId?: string | null }): Promise<void> {
    const ok = await this.repo.softDelete(input.id, input.actorId);
    if (!ok) {
      throw new NotFoundError('ACHIEVEMENT_NOT_FOUND', 'Achievement tidak ditemukan');
    }
    await this.auditRepo?.record({
      userId: input.actorId,
      action: 'delete',
      entityType: 'achievement',
      entityId: input.id,
      newData: null,
      requestId: input.requestId ?? null,
    });
  }
}

/**
 * Manual grant oleh admin: user spesifik by username.
 * Idempotent (UNIQUE achievement_id+user_id) - user yang sudah punya
 * dilewati, bukan error.
 */
export class GrantAchievementUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: {
    achievementId: string;
    usernames: string[];
    actorId: string;
    requestId?: string | null;
  }): Promise<GrantResult> {
    const achievement = await this.repo.findById(cmd.achievementId);
    if (!achievement) {
      throw new NotFoundError('ACHIEVEMENT_NOT_FOUND', 'Achievement tidak ditemukan');
    }
    // Resolusi username -> user id dalam satu batch (repo query IN).
    const resolved = await this.repo.resolveUsernames(cmd.usernames);
    const missing = cmd.usernames.filter((u) => !resolved.has(u.toLowerCase()));

    // Satu INSERT multi-baris (UNIQUE + onConflictDoNothing): user yang
    // sudah punya award otomatis ter-skip - jumlahnya = inserted.length.
    const inserted = await this.repo.insertAwards(
      [...resolved.values()].map((user) => ({
        achievementId: achievement.id,
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        matchedAt: new Date(),
        context: { granted_by: cmd.actorId, reason: 'manual' },
      })),
      'admin',
    );
    const awarded = inserted.length;
    const skipped = resolved.size - awarded;

    if (awarded > 0) {
      await this.inbox?.executeBatch(
        inserted.map((row) => ({
          userId: row.userId,
          type: 'achievement_awarded' as const,
          targetKind: 'achievement' as const,
          targetId: achievement.id,
          title: 'Pencapaian baru!',
          body: `Kamu mendapat "${achievement.title}" - cek profil kamu ya.`,
        })),
      );
    }
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'grant',
      entityType: 'achievement',
      entityId: achievement.id,
      newData: { awarded, skipped, missing },
      requestId: cmd.requestId ?? null,
    });
    return { awarded, skipped, missing };
  }
}

/**
 * Revoke (soft delete) satu award user. Bila award itu adalah border
 * aktif user, border ikut dilepas supaya tidak menampilkan aset yang
 * sudah dicabut.
 */
export class RevokeUserAchievementUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: { awardId: string; actorId: string; requestId?: string | null }): Promise<void> {
    const ok = await this.repo.revokeAward(cmd.awardId, cmd.actorId);
    if (!ok) {
      throw new NotFoundError('ACHIEVEMENT_NOT_FOUND', 'Award tidak ditemukan');
    }
    await this.auditRepo?.record({
      userId: cmd.actorId,
      action: 'revoke',
      entityType: 'user_achievement',
      entityId: cmd.awardId,
      newData: null,
      requestId: cmd.requestId ?? null,
    });
  }
}

/**
 * Preview kriteria: jumlah + sampel pemenuh (tanpa menulis award).
 * Dipakai admin sebelum backfill / saat menyusun kriteria.
 */
export class PreviewAchievementUseCase {
  constructor(private readonly repo: AchievementRepository) {}

  async execute(achievementId: string, sampleLimit = 10) {
    const achievement = await this.repo.findById(achievementId);
    if (!achievement) {
      throw new NotFoundError('ACHIEVEMENT_NOT_FOUND', 'Achievement tidak ditemukan');
    }
    const total = await this.repo.countUnawardedCandidates(achievementId, achievement.criteria);
    const sampleRows = await this.repo.findUnawardedCandidates(achievementId, achievement.criteria, sampleLimit);
    return {
      total,
      sample: sampleRows.map((r) => ({
        username: r.username,
        displayName: r.displayName,
        matchedAt: r.matchedAt.toISOString(),
      })),
    };
  }
}

/**
 * Set/lepas border profil aktif. Validasi kepemilikan: award id harus
 * milik user dan reward_type-nya profile_border.
 */
export class SetActiveBorderUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: { userId: string; borderId: string | null; requestId?: string | null }): Promise<{ activeBorderId: string | null }> {
    if (cmd.borderId === null) {
      await this.repo.setActiveBorder(cmd.userId, null);
      return { activeBorderId: null };
    }
    const owned = await this.repo.findOwnedAwardById(cmd.userId, cmd.borderId);
    if (!owned || owned.rewardType !== 'profile_border') {
      throw new ForbiddenError(
        'ACHIEVEMENT_BORDER_NOT_OWNED',
        'Bingkai itu bukan milik kamu atau bukan bingkai profil',
      );
    }    await this.repo.setActiveBorder(cmd.userId, cmd.borderId);
    await this.auditRepo?.record({
      userId: cmd.userId,
      action: 'set_active_border',
      entityType: 'user_achievement',
      entityId: cmd.borderId,
      newData: { code: owned.code },
      requestId: cmd.requestId ?? null,
    });
    return { activeBorderId: cmd.borderId };
  }
}
