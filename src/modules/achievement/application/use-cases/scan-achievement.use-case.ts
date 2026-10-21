import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { RecordInboxNotificationUseCase } from '@/modules/notification/application/use-cases/record-inbox-notification.use-case';
import type { Achievement, AchievementCandidate } from '../../domain/entities/achievement.entity';
import type { AchievementRepository } from '../../domain/repositories/achievement.repository';
import { findAchievementSource } from '../../domain/achievement-registry';

export interface ScanAchievementResult {
  scanned: number;
  awarded: number;
}

/**
 * Scan satu achievement: cari user yang memenuhi kriteria dan BELUM punya
 * award, lalu berikan (idempotent).
 *
 * Idempotensi berlapis:
 * 1. Query kandidat = anti-join (sudah punya award dibuang di SQL).
 * 2. `insertAward` pakai UNIQUE(achievement_id, user_id) + onConflictDoNothing.
 * Jadi scan dua kali untuk achievement sama = 0 award baru.
 *
 * Subrequest: 1 query kandidat + 1 query award per batch. Target <= 3 per
 * putaran cron (aturan join-bukan-n-panggilan).
 */
export class ScanAchievementUseCase {
  constructor(
    private readonly repo: AchievementRepository,
    private readonly inbox?: RecordInboxNotificationUseCase,
    private readonly auditRepo?: AuditLogRepository,
  ) {}

  async execute(cmd: {
    achievement: Achievement;
    limit?: number;
    actorId?: string;
    requestId?: string | null;
    /**
     * Kandidat hasil batch scan (sudah di-fetch pemanggil). Kalau diisi,
     * repo tidak di-query lagi - dipakai scan cron yang ambil semua
     * kandidat dalam satu roundtrip.
     */
    candidates?: AchievementCandidate[];
  }): Promise<ScanAchievementResult> {
    const { achievement } = cmd;
    const source = findAchievementSource(achievement.criteria.source);
    // Sumber manual tidak punya kondisi - tidak pernah discan.
    if (!source || source.manualOnly) {
      return { scanned: 0, awarded: 0 };
    }

    const limit = cmd.limit ?? 1000;
    const candidates =
      cmd.candidates ??
      (await this.repo.findUnawardedCandidates(achievement.id, achievement.criteria, limit));
    if (candidates.length === 0) {
      return { scanned: 0, awarded: 0 };
    }

    // Satu INSERT multi-baris (UNIQUE + onConflictDoNothing) = 1 subrequest.
    // Kandidat dari anti-join mestinya semua baru; baris yang benar-benar
    // ter-insert jadi sumber notifikasi supaya yang kalah race tidak
    // menerima notifikasi palsu.
    const inserted = await this.repo.insertAwards(
      candidates.map((candidate) => ({
        achievementId: achievement.id,
        userId: candidate.userId,
        username: candidate.username,
        displayName: candidate.displayName,
        matchedAt: candidate.matchedAt,
        context: {
          source: achievement.criteria.source,
          matched_at: candidate.matchedAt.toISOString(),
        },
      })),
      'scan',
    );
    const awarded = inserted.length;

    // Satu INSERT multi-baris notifikasi inbox = 1 subrequest.
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

    if (cmd.actorId) {
      await this.auditRepo?.record({
        userId: cmd.actorId,
        action: 'scan',
        entityType: 'achievement',
        entityId: achievement.id,
        newData: { scanned: candidates.length, awarded },
        requestId: cmd.requestId ?? null,
      });
    }

    return { scanned: candidates.length, awarded };
  }
}
