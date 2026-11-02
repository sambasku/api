import type { UsahaContributionRepository } from '@/modules/usaha-contribution/domain/usaha-contribution.repository';
import type { UsahaClaimRepository } from '@/modules/usaha-claim/domain/usaha-claim.repository';
import type { UsahaListItem } from '../../domain/entities/usaha.entity';
import type { UsahaRepository } from '../../domain/repositories/usaha.repository';

export interface MyUsahaItem extends UsahaListItem {
  pending_changes: number;
}

export interface ListMyUsahaResult {
  items: MyUsahaItem[];
  pending_claim_count: number;
}

/**
 * Usaha Saya (PRD 9): daftar usaha yang dikelola + ringkasan pengajuan
 * pending. Dua query tetap (usaha + counts batch) ditambah hitungan klaim
 * user - JANGAN loop per usaha (rule subrequest).
 */
export class ListMyUsahaUseCase {
  constructor(
    private readonly usahas: UsahaRepository,
    private readonly contributions: UsahaContributionRepository,
    private readonly claims: UsahaClaimRepository,
  ) {}

  async execute(userId: string): Promise<ListMyUsahaResult> {
    // limit 100 = batas wajar pengelola; paginasi tidak perlu untuk MVP.
    const res = await this.usahas.list({ limit: 100, managerId: userId });
    const counts = await this.contributions.pendingCountsByUsaha(
      res.items.map((u) => u.id),
    );
    const pendingClaimCount = await this.claims.countPendingByUser(userId);
    return {
      items: res.items.map((u) => ({
        ...u,
        pending_changes: counts.get(u.id) ?? 0,
      })),
      pending_claim_count: pendingClaimCount,
    };
  }
}
