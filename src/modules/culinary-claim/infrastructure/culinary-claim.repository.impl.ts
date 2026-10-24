import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  culinaryClaims,
  type CulinaryClaimStatus,
} from '@/shared/database/drizzle/schema/culinary-claims.schema';
import { culinaryPlaces } from '@/shared/database/drizzle/schema/culinary-places.schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  CulinaryClaim,
  CulinaryClaimWithPlace,
} from '../domain/culinary-claim.entity';
import type { CulinaryClaimRepository } from '../domain/culinary-claim.repository';

type Row = typeof culinaryClaims.$inferSelect;

function mapRow(row: Row): CulinaryClaim {
  return {
    id: row.id,
    placeId: row.placeId,
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

export class CulinaryClaimRepositoryImpl implements CulinaryClaimRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    placeId: string;
    userId: string;
    contactEvidence: string;
    note?: string | null;
  }): Promise<CulinaryClaim> {
    const id = generateId();
    await this.db.insert(culinaryClaims).values({
      id,
      placeId: input.placeId,
      userId: input.userId,
      contactEvidence: input.contactEvidence,
      note: input.note ?? null,
      status: 'pending',
    });
    const created = await this.findById(id);
    if (!created) throw new Error('Klaim create gagal - row tidak ketemu');
    return created;
  }

  async findById(id: string): Promise<CulinaryClaim | null> {
    const [row] = await this.db
      .select()
      .from(culinaryClaims)
      .where(eq(culinaryClaims.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findPendingByUser(
    placeId: string,
    userId: string,
  ): Promise<CulinaryClaim | null> {
    const [row] = await this.db
      .select()
      .from(culinaryClaims)
      .where(
        and(
          eq(culinaryClaims.placeId, placeId),
          eq(culinaryClaims.userId, userId),
          eq(culinaryClaims.status, 'pending'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<CulinaryClaimWithPlace[]> {
    const rows = await this.db
      .select({
        claim: culinaryClaims,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryClaims)
      .innerJoin(culinaryPlaces, eq(culinaryPlaces.id, culinaryClaims.placeId))
      .where(eq(culinaryClaims.userId, userId))
      .orderBy(desc(culinaryClaims.createdAt))
      .limit(50);
    return rows.map((r) => ({
      ...mapRow(r.claim),
      placeName: r.placeName,
      placeSlug: r.placeSlug,
    }));
  }

  async listByStatus(status: CulinaryClaimStatus): Promise<CulinaryClaimWithPlace[]> {
    const rows = await this.db
      .select({
        claim: culinaryClaims,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryClaims)
      .innerJoin(culinaryPlaces, eq(culinaryPlaces.id, culinaryClaims.placeId))
      .where(eq(culinaryClaims.status, status))
      .orderBy(desc(culinaryClaims.createdAt))
      .limit(100);
    return rows.map((r) => ({
      ...mapRow(r.claim),
      placeName: r.placeName,
      placeSlug: r.placeSlug,
    }));
  }

  async listPendingForPlace(placeId: string): Promise<CulinaryClaimWithPlace[]> {
    return this.listByStatusForTempat(placeId, 'pending');
  }

  private async listByStatusForTempat(
    placeId: string,
    status: CulinaryClaimStatus,
  ): Promise<CulinaryClaimWithPlace[]> {
    const rows = await this.db
      .select({
        claim: culinaryClaims,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryClaims)
      .innerJoin(culinaryPlaces, eq(culinaryPlaces.id, culinaryClaims.placeId))
      .where(
        and(eq(culinaryClaims.placeId, placeId), eq(culinaryClaims.status, status)),
      )
      .orderBy(desc(culinaryClaims.createdAt));
    return rows.map((r) => ({
      ...mapRow(r.claim),
      placeName: r.placeName,
      placeSlug: r.placeSlug,
    }));
  }

  async countPendingByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(culinaryClaims)
      .where(
        and(eq(culinaryClaims.userId, userId), eq(culinaryClaims.status, 'pending')),
      );
    return Number(row?.total ?? 0);
  }

  async setStatus(
    id: string,
    status: CulinaryClaimStatus,
    extra?: {
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      reviewedBy?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(culinaryClaims)
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
      .where(eq(culinaryClaims.id, id));
  }

  async approveExclusive(claimId: string, reviewedBy: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [claim] = await tx
        .select()
        .from(culinaryClaims)
        .where(eq(culinaryClaims.id, claimId))
        .limit(1);
      if (!claim) throw new Error('Klaim tidak ditemukan saat approve');
      const now = new Date();
      await tx
        .update(culinaryPlaces)
        .set({ managerId: claim.userId, updatedAt: now })
        .where(eq(culinaryPlaces.id, claim.placeId));
      await tx
        .update(culinaryClaims)
        .set({ status: 'approved', reviewedBy, reviewedAt: now, updatedAt: now })
        .where(eq(culinaryClaims.id, claimId));
      // Konflik: klaim pending lain untuk place yang sama ditolak.
      await tx
        .update(culinaryClaims)
        .set({
          status: 'rejected',
          rejectReasonCode: 'claim_conflict',
          rejectReasonText: 'Tempat sudah dikelola pihak lain yang terverifikasi',
          reviewedBy,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(culinaryClaims.placeId, claim.placeId),
            eq(culinaryClaims.status, 'pending'),
            ne(culinaryClaims.id, claimId),
          ),
        );
    });
  }
}
