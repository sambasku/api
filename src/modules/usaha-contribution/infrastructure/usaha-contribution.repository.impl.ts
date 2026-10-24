import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  usahaContributions,
  type UsahaContributionStatus,
} from '@/shared/database/drizzle/schema/usaha-contributions.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import { generateId } from '@/shared/utils/ulid';
import type {
  UsahaContribution,
  UsahaContributionPayload,
  UsahaContributionWithUsaha,
} from '../domain/usaha-contribution.entity';
import type {
  CreateUsahaContributionInput,
  ListUsahaContributionsInput,
  UsahaContributionRepository,
} from '../domain/usaha-contribution.repository';

type Row = typeof usahaContributions.$inferSelect;

function mapRow(row: Row): UsahaContribution {
  return {
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    usahaId: row.usahaId ?? null,
    itemId: row.itemId ?? null,
    lockedFields: row.lockedFields,
    payload: JSON.parse(row.payloadJson) as UsahaContributionPayload,
    baseUpdatedAt: row.baseUpdatedAt ?? null,
    status: row.status,
    wantsClaim: row.wantsClaim,
    resultUsahaId: row.resultUsahaId ?? null,
    revisionNote: row.revisionNote ?? null,
    rejectReasonCode: row.rejectReasonCode ?? null,
    rejectReasonText: row.rejectReasonText ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    reviewedAt: row.reviewedAt ?? null,
  };
}

function withUsaha(
  row: Row,
  usahaName: string | null,
  usahaSlug: string | null,
): UsahaContributionWithUsaha {
  return { ...mapRow(row), usahaName, usahaSlug };
}

export class UsahaContributionRepositoryImpl
  implements UsahaContributionRepository
{
  constructor(private readonly db: AppDatabase) {}

  async create(
    input: CreateUsahaContributionInput,
  ): Promise<UsahaContribution> {
    const id = generateId();
    await this.db.insert(usahaContributions).values({
      id,
      kind: input.kind,
      userId: input.userId,
      usahaId: input.usahaId ?? null,
      itemId: input.itemId ?? null,
      lockedFields: input.lockedFields,
      payloadJson: JSON.stringify(input.payload),
      baseUpdatedAt: input.baseUpdatedAt ?? null,
      status: 'pending',
      wantsClaim: input.wantsClaim ?? false,
    });
    const created = await this.findById(id);
    if (!created) throw new Error('usaha contribution insert failed');
    return created;
  }

  async findById(id: string): Promise<UsahaContribution | null> {
    const [row] = await this.db
      .select()
      .from(usahaContributions)
      .where(eq(usahaContributions.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<UsahaContributionWithUsaha[]> {
    const rows = await this.db
      .select({
        row: usahaContributions,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(usahaContributions)
      .leftJoin(usahas, eq(usahas.id, usahaContributions.usahaId))
      .where(eq(usahaContributions.userId, userId))
      .orderBy(desc(usahaContributions.createdAt))
      .limit(50);
    return rows.map((r) => withUsaha(r.row, r.usahaName ?? null, r.usahaSlug ?? null));
  }

  async list(
    input: ListUsahaContributionsInput,
  ): Promise<UsahaContributionWithUsaha[]> {
    const conds = [];
    if (input.status) conds.push(eq(usahaContributions.status, input.status));
    if (input.kind) conds.push(eq(usahaContributions.kind, input.kind));
    const rows = await this.db
      .select({
        row: usahaContributions,
        usahaName: usahas.name,
        usahaSlug: usahas.slug,
      })
      .from(usahaContributions)
      .leftJoin(usahas, eq(usahas.id, usahaContributions.usahaId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(usahaContributions.createdAt))
      .limit(100);
    return rows.map((r) => withUsaha(r.row, r.usahaName ?? null, r.usahaSlug ?? null));
  }

  async countPending(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(usahaContributions)
      .where(
        and(
          eq(usahaContributions.userId, userId),
          eq(usahaContributions.status, 'pending'),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async pendingLockedFields(usahaId: string): Promise<string[]> {
    const rows = await this.db
      .select({ lockedFields: usahaContributions.lockedFields })
      .from(usahaContributions)
      .where(
        and(
          eq(usahaContributions.usahaId, usahaId),
          eq(usahaContributions.status, 'pending'),
        ),
      );
    return rows.map((r) => r.lockedFields);
  }

  async pendingCountsByUsaha(usahaIds: string[]): Promise<Map<string, number>> {
    if (usahaIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        usahaId: usahaContributions.usahaId,
        total: sql<number>`count(*)`,
      })
      .from(usahaContributions)
      .where(
        and(
          inArray(usahaContributions.usahaId, usahaIds),
          eq(usahaContributions.status, 'pending'),
        ),
      )
      .groupBy(usahaContributions.usahaId);
    return new Map(
      rows
        .filter((r) => r.usahaId !== null)
        .map((r) => [r.usahaId as string, Number(r.total)]),
    );
  }

  async setStatus(
    id: string,
    status: UsahaContributionStatus,
    extra?: {
      revisionNote?: string | null;
      rejectReasonCode?: string | null;
      rejectReasonText?: string | null;
      resultUsahaId?: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(usahaContributions)
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
        ...(extra?.resultUsahaId !== undefined
          ? { resultUsahaId: extra.resultUsahaId }
          : {}),
      })
      .where(eq(usahaContributions.id, id));
  }

  async replacePayload(
    id: string,
    payload: UsahaContributionPayload,
    lockedFields: string,
    baseUpdatedAt?: Date | null,
  ): Promise<void> {
    await this.db
      .update(usahaContributions)
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
      .where(eq(usahaContributions.id, id));
  }

  async remove(id: string): Promise<void> {
    await this.db
      .delete(usahaContributions)
      .where(eq(usahaContributions.id, id));
  }
}
