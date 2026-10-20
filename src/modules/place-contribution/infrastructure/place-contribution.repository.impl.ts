import { and, count, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { placeContributions } from '@/shared/database/drizzle/schema/place-contributions.schema';
import { generateId } from '@/shared/utils/ulid';

export type ContributionStatus = 'pending' | 'approved' | 'rejected';

export interface ContributionPayload {
  slug: string;
  name: string;
  category: string;
  type: 'sejarah' | 'alam' | 'budaya' | 'pantai' | 'belanja' | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  shortDescription: string;
  regionId: string | null;
  villageId: string | null;
  hours: string | null;
  contact: string | null;
  images: { url: string; isMain?: boolean }[];
}

export interface PlaceContribution {
  id: string;
  userId: string;
  placeId: string | null;
  baseUpdatedAt: Date | null;
  payload: ContributionPayload;
  status: ContributionStatus;
  createdAt: Date;
  reviewedAt: Date | null;
}

function mapRow(row: typeof placeContributions.$inferSelect): PlaceContribution {
  return {
    id: row.id,
    userId: row.userId,
    placeId: row.placeId,
    baseUpdatedAt: row.baseUpdatedAt,
    payload: JSON.parse(row.payloadJson) as ContributionPayload,
    status: row.status,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
  };
}

export class PlaceContributionRepositoryImpl {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    userId: string;
    placeId: string | null;
    baseUpdatedAt: Date | null;
    payload: ContributionPayload;
  }): Promise<PlaceContribution> {
    const id = generateId();
    await this.db.insert(placeContributions).values({
      id,
      userId: input.userId,
      placeId: input.placeId,
      baseUpdatedAt: input.baseUpdatedAt,
      payloadJson: JSON.stringify(input.payload),
      status: 'pending',
    });
    const row = await this.findById(id);
    if (!row) throw new Error('contribution insert failed');
    return row;
  }

  async findById(id: string): Promise<PlaceContribution | null> {
    const [row] = await this.db
      .select()
      .from(placeContributions)
      .where(eq(placeContributions.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<PlaceContribution[]> {
    const rows = await this.db
      .select()
      .from(placeContributions)
      .where(eq(placeContributions.userId, userId))
      .orderBy(desc(placeContributions.createdAt))
      .limit(50);
    return rows.map(mapRow);
  }

  async listByStatus(status: ContributionStatus): Promise<PlaceContribution[]> {
    const rows = await this.db
      .select()
      .from(placeContributions)
      .where(eq(placeContributions.status, status))
      .orderBy(desc(placeContributions.createdAt))
      .limit(100);
    return rows.map(mapRow);
  }

  async countPending(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(placeContributions)
      .where(and(eq(placeContributions.userId, userId), eq(placeContributions.status, 'pending')));
    return row?.total ?? 0;
  }

  async findPendingEdit(userId: string, placeId: string): Promise<PlaceContribution | null> {
    const [row] = await this.db
      .select()
      .from(placeContributions)
      .where(
        and(
          eq(placeContributions.userId, userId),
          eq(placeContributions.placeId, placeId),
          eq(placeContributions.status, 'pending'),
        ),
      )
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async setStatus(id: string, status: ContributionStatus): Promise<void> {
    await this.db
      .update(placeContributions)
      .set({ status, reviewedAt: new Date() })
      .where(eq(placeContributions.id, id));
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(placeContributions).where(eq(placeContributions.id, id));
  }
}
