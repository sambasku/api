import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  usahaClaims,
  type UsahaClaimStatus,
} from '@/shared/database/drizzle/schema/usaha-claims.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  UsahaClaim,
  UsahaClaimWithUsaha,
} from '../domain/usaha-claim.entity';
import type { UsahaClaimRepository } from '../domain/usaha-claim.repository';

type Row = typeof usahaClaims.$inferSelect;

function mapRow(row: Row): UsahaClaim {
  return {
    id: row.id,
    usahaId: row.usahaId,
    userId: row.userId,
    contactEvidence: row.contactEvidence,
    note: row.note ?? null,
    status: row.status,
    rejectReasonCode: row.rejectReasonCode ?? null,
    rejectReasonText: row.rejectReasonText ?? null,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

export class UsahaClaimRepositoryImpl implements UsahaClaimRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    usahaId: string;
    userId: string;
    contactEvidence: string;
    note?: string | null;
  }): Promise<UsahaClaim> {
    const id = generateId();
    await this.db.insert(usahaClaims).values({
      id,
      usahaId: input.usahaId,
      userId: input.userId,
      contactEvidence: input.contactEvidence,
      note: input.note ?? null,
      status: 'pending',
    });
    const created = await this.findById(id);
    if (!created) throw new Error('Klaim create gagal - row tidak ketemu');
    return created;
  }

  async findById(id: string): Promise<UsahaClaim | null> {
    const [row] = await this.db
      .select()
      .from(usahaClaims)
      .where(eq(usahaClaims.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findPendingByUser(
    usahaId: string,
    userId: string,
  ): Promise<UsahaClaim | null> {
    const [row] = await this.db
      .select()
      .from(usahaClaims)
      .where(
        and(
          eq(usahaClaims.usahaId, usahaId),
          eq(usahaClaims.userId, userId),
          eq(usahaClaims.status, 'pending'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<UsahaClaimWithUsaha[]> {
    const rows = await this.db
      .select({
        claim: usahaClaims,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(usahaClaims)
      .innerJoin(usahas, eq(usahas.id, usahaClaims.usahaId))
      .where(eq(usahaClaims.userId, userId))
      .orderBy(desc(usahaClaims.createdAt))
      .limit(50);
    return rows.map((r) => ({
      ...mapRow(r.claim),
      usahaName: r.usahaName,
      usahaSlug: r.usahaSlug,
    }));
  }

  async listByStatus(status: UsahaClaimStatus): Promise<UsahaClaimWithUsaha[]> {
    const rows = await this.db
      .select({
        claim: usahaClaims,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(usahaClaims)
      .innerJoin(usahas, eq(usahas.id, usahaClaims.usahaId))
      .where(eq(usahaClaims.status, status))
      .orderBy(desc(usahaClaims.createdAt))
      .limit(100);
    return rows.map((r) => ({
      ...mapRow(r.claim),
      usahaName: r.usahaName,
      usahaSlug: r.usahaSlug,
    }));
  }

  async listPendingForUsaha(usahaId: string): Promise<UsahaClaimWithUsaha[]> {
    return this.listByStatusForUsaha(usahaId, 'pending');
  }

  private async listByStatusForUsaha(
    usahaId: string,
    status: UsahaClaimStatus,
  ): Promise<UsahaClaimWithUsaha[]> {
    const rows = await this.db
      .select({
        claim: usahaClaims,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(usahaClaims)
      .innerJoin(usahas, eq(usahas.id, usahaClaims.usahaId))
      .where(
        and(eq(usahaClaims.usahaId, usahaId), eq(usahaClaims.status, status)),
      )
      .orderBy(desc(usahaClaims.createdAt));
    return rows.map((r) => ({
      ...mapRow(r.claim),
      usahaName: r.usahaName,
      usahaSlug: r.usahaSlug,
    }));
  }

  async countPendingByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(usahaClaims)
      .where(
        and(eq(usahaClaims.userId, userId), eq(usahaClaims.status, 'pending')),
      );
    return Number(row?.total ?? 0);
  }

  async setStatus(
    id: string,
    status: UsahaClaimStatus,
    extra?: {
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      reviewedBy?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(usahaClaims)
      .set({
        status,
        updatedAt: new Date(),
        ...(extra?.rejectReasonCode !== undefined
          ? { rejectReasonCode: extra.rejectReasonCode }
          : {}),
        ...(extra?.rejectReasonText !== undefined
          ? { rejectReasonText: extra.rejectReasonText }
          : {}),
        ...(extra?.reviewedBy !== undefined
          ? { reviewedBy: extra.reviewedBy, reviewedAt: new Date() }
          : {}),
      })
      .where(eq(usahaClaims.id, id));
  }

  async approveExclusive(claimId: string, reviewedBy: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [claim] = await tx
        .select()
        .from(usahaClaims)
        .where(eq(usahaClaims.id, claimId))
        .limit(1);
      if (!claim) throw new Error('Klaim tidak ditemukan saat approve');
      const now = new Date();
      await tx
        .update(usahas)
        .set({ managerId: claim.userId, updatedAt: now })
        .where(eq(usahas.id, claim.usahaId));
      await tx
        .update(usahaClaims)
        .set({ status: 'approved', reviewedBy, reviewedAt: now, updatedAt: now })
        .where(eq(usahaClaims.id, claimId));
      // Konflik: klaim pending lain untuk usaha yang sama ditolak.
      await tx
        .update(usahaClaims)
        .set({
          status: 'rejected',
          rejectReasonCode: 'claim_conflict',
          rejectReasonText: 'Usaha sudah dikelola pihak lain yang terverifikasi',
          reviewedBy,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(usahaClaims.usahaId, claim.usahaId),
            eq(usahaClaims.status, 'pending'),
            ne(usahaClaims.id, claimId),
          ),
        );
    });
  }
}
