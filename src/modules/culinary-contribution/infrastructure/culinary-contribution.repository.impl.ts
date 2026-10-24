import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  culinaryContributions,
  type CulinaryContributionStatus,
} from '@/shared/database/drizzle/schema/culinary-contributions.schema';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { culinaryPlaces } from '@/shared/database/drizzle/schema/culinary-places.schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  CulinaryContribution,
  CulinaryContributionPayload,
  CulinaryContributionWithTarget,
} from '../domain/culinary-contribution.entity';
import type {
  CreateCulinaryContributionInput,
  CulinaryContributionRepository,
  ListCulinaryContributionsInput,
} from '../domain/culinary-contribution.repository';

type Row = typeof culinaryContributions.$inferSelect;

function mapRow(row: Row): CulinaryContribution {
  return {
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    cuisineId: row.cuisineId ?? null,
    placeId: row.placeId ?? null,
    linkId: row.linkId ?? null,
    lockedFields: row.lockedFields,
    payload: JSON.parse(row.payloadJson) as CulinaryContributionPayload,
    baseUpdatedAt: row.baseUpdatedAt ?? null,
    status: row.status,
    resultCuisineId: row.resultCuisineId ?? null,
    resultPlaceId: row.resultPlaceId ?? null,
    revisionNote: row.revisionNote ?? null,
    rejectReasonCode: row.rejectReasonCode ?? null,
    rejectReasonText: row.rejectReasonText ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    reviewedAt: row.reviewedAt ?? null,
  };
}

function withTarget(
  row: Row,
  cuisineName: string | null,
  cuisineSlug: string | null,
  placeName: string | null,
  placeSlug: string | null,
): CulinaryContributionWithTarget {
  return { ...mapRow(row), cuisineName, cuisineSlug, placeName, placeSlug };
}

export class CulinaryContributionRepositoryImpl
  implements CulinaryContributionRepository
{
  constructor(private readonly db: AppDatabase) {}

  async create(
    input: CreateCulinaryContributionInput,
  ): Promise<CulinaryContribution> {
    const id = generateId();
    await this.db.insert(culinaryContributions).values({
      id,
      kind: input.kind,
      userId: input.userId,
      cuisineId: input.cuisineId ?? null,
      placeId: input.placeId ?? null,
      linkId: input.linkId ?? null,
      lockedFields: input.lockedFields,
      payloadJson: JSON.stringify(input.payload),
      baseUpdatedAt: input.baseUpdatedAt ?? null,
      status: 'pending',
    });
    const created = await this.findById(id);
    if (!created) throw new Error('culinary contribution insert failed');
    return created;
  }

  async findById(id: string): Promise<CulinaryContribution | null> {
    const [row] = await this.db
      .select()
      .from(culinaryContributions)
      .where(eq(culinaryContributions.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<CulinaryContributionWithTarget[]> {
    const rows = await this.db
      .select({
        row: culinaryContributions,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryContributions)
      .leftJoin(cuisines, eq(cuisines.id, culinaryContributions.cuisineId))
      .leftJoin(
        culinaryPlaces,
        eq(culinaryPlaces.id, culinaryContributions.placeId),
      )
      .where(eq(culinaryContributions.userId, userId))
      .orderBy(desc(culinaryContributions.createdAt))
      .limit(50);
    return rows.map((r) =>
      withTarget(
        r.row,
        r.cuisineName ?? null,
        r.cuisineSlug ?? null,
        r.placeName ?? null,
        r.placeSlug ?? null,
      ),
    );
  }

  async list(
    input: ListCulinaryContributionsInput,
  ): Promise<CulinaryContributionWithTarget[]> {
    const conds = [];
    if (input.status) conds.push(eq(culinaryContributions.status, input.status));
    if (input.kind) conds.push(eq(culinaryContributions.kind, input.kind));
    const rows = await this.db
      .select({
        row: culinaryContributions,
        cuisineName: cuisines.name,
        cuisineSlug: cuisines.slug,
        placeName: culinaryPlaces.name,
        placeSlug: culinaryPlaces.slug,
      })
      .from(culinaryContributions)
      .leftJoin(cuisines, eq(cuisines.id, culinaryContributions.cuisineId))
      .leftJoin(
        culinaryPlaces,
        eq(culinaryPlaces.id, culinaryContributions.placeId),
      )
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(culinaryContributions.createdAt))
      .limit(100);
    return rows.map((r) =>
      withTarget(
        r.row,
        r.cuisineName ?? null,
        r.cuisineSlug ?? null,
        r.placeName ?? null,
        r.placeSlug ?? null,
      ),
    );
  }

  async countPending(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(culinaryContributions)
      .where(
        and(
          eq(culinaryContributions.userId, userId),
          eq(culinaryContributions.status, 'pending'),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async pendingLockedFieldsForCuisine(cuisineId: string): Promise<string[]> {
    const rows = await this.db
      .select({ lockedFields: culinaryContributions.lockedFields })
      .from(culinaryContributions)
      .where(
        and(
          eq(culinaryContributions.cuisineId, cuisineId),
          eq(culinaryContributions.status, 'pending'),
        ),
      );
    return rows.map((r) => r.lockedFields);
  }

  async pendingLockedFieldsForPlace(placeId: string): Promise<string[]> {
    const rows = await this.db
      .select({ lockedFields: culinaryContributions.lockedFields })
      .from(culinaryContributions)
      .where(
        and(
          eq(culinaryContributions.placeId, placeId),
          eq(culinaryContributions.status, 'pending'),
        ),
      );
    return rows.map((r) => r.lockedFields);
  }

  async setStatus(
    id: string,
    status: CulinaryContributionStatus,
    extra?: {
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      resultCuisineId?: string | null;
      resultPlaceId?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(culinaryContributions)
      .set({
        status,
        updatedAt: new Date(),
        reviewedAt: new Date(),
        ...(extra?.revisionNote !== undefined
          ? { revisionNote: extra.revisionNote }
          : {}),
        ...(extra?.rejectReasonCode !== undefined
          ? { rejectReasonCode: extra.rejectReasonCode }
          : {}),
        ...(extra?.rejectReasonText !== undefined
          ? { rejectReasonText: extra.rejectReasonText }
          : {}),
        ...(extra?.resultCuisineId !== undefined
          ? { resultCuisineId: extra.resultCuisineId }
          : {}),
        ...(extra?.resultPlaceId !== undefined
          ? { resultPlaceId: extra.resultPlaceId }
          : {}),
      })
      .where(eq(culinaryContributions.id, id));
  }

  async replacePayload(
    id: string,
    payload: CulinaryContributionPayload,
    lockedFields: string,
    baseUpdatedAt?: Date | null,
  ): Promise<void> {
    await this.db
      .update(culinaryContributions)
      .set({
        payloadJson: JSON.stringify(payload),
        lockedFields,
        status: 'pending',
        revisionNote: null,
        rejectReasonCode: null,
        rejectReasonText: null,
        baseUpdatedAt: baseUpdatedAt ?? null,
        updatedAt: new Date(),
        reviewedAt: null,
      })
      .where(eq(culinaryContributions.id, id));
  }

  async remove(id: string): Promise<void> {
    await this.db
      .delete(culinaryContributions)
      .where(eq(culinaryContributions.id, id));
  }

  // Helper dipakai use-case untuk resolusi slug -> id dalam satu query.
  async resolveSlugs(input: {
    cuisineSlugs?: string[];
    placeSlugs?: string[];
  }): Promise<{
    cuisines: Array<{ id: string; slug: string; name: string }>;
    places: Array<{ id: string; slug: string; name: string }>;
  }> {
    const [cuisineRows, placeRows] = await Promise.all([
      input.cuisineSlugs?.length
        ? this.db
            .select({ id: cuisines.id, slug: cuisines.slug, name: cuisines.name })
            .from(cuisines)
            .where(inArray(cuisines.slug, input.cuisineSlugs))
        : Promise.resolve([]),
      input.placeSlugs?.length
        ? this.db
            .select({
              id: culinaryPlaces.id,
              slug: culinaryPlaces.slug,
              name: culinaryPlaces.name,
            })
            .from(culinaryPlaces)
            .where(inArray(culinaryPlaces.slug, input.placeSlugs))
        : Promise.resolve([]),
    ]);
    return { cuisines: cuisineRows, places: placeRows };
  }
}
