import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  communityOrgs,
  communityProposals,
  users,
} from '@/shared/database/drizzle/schema';
import type {
  CommunityCategory,
  CommunityFeaturedKind,
  CommunityOrg,
  CommunityOrgFields,
  CommunityProposal,
  CommunityProposalStatus,
  CommunityPublishStatus,
} from '../domain/community';
import type {
  CommunityRepository,
  ListCommunityOrgsInput,
  ListCommunityOrgsResult,
} from '../domain/community.repository';

type OrgRow = typeof communityOrgs.$inferSelect;

function toOrg(row: OrgRow): CommunityOrg {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    status: row.status,
    isFeaturedKind: row.isFeaturedKind,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toProposal(
  row: typeof communityProposals.$inferSelect,
  username: string | null,
): CommunityProposal {
  return {
    id: row.id,
    userId: row.userId,
    username,
    name: row.name,
    description: row.description,
    logoUrl: row.logoUrl,
    category: row.category,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    communityOrgId: row.communityOrgId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class CommunityRepositoryImpl implements CommunityRepository {
  constructor(private readonly db: AppDatabase) {}

  async listPublished(input: ListCommunityOrgsInput): Promise<ListCommunityOrgsResult> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
    const conds = [eq(communityOrgs.status, 'published')];
    if (input.category) conds.push(eq(communityOrgs.category, input.category));
    if (input.q && input.q.trim()) {
      const like = `%${input.q.trim().toLowerCase()}%`;
      conds.push(
        sql`(lower(${communityOrgs.name}) LIKE ${like} OR lower(${communityOrgs.description}) LIKE ${like})`,
      );
    }
    if (input.cursor) {
      const [anchor] = await this.db
        .select({ createdAt: communityOrgs.createdAt, id: communityOrgs.id })
        .from(communityOrgs)
        .where(eq(communityOrgs.id, input.cursor))
        .limit(1);
      if (anchor) {
        conds.push(
          or(
            lt(communityOrgs.createdAt, anchor.createdAt),
            and(
              eq(communityOrgs.createdAt, anchor.createdAt),
              lt(communityOrgs.id, anchor.id),
            ),
          )!,
        );
      }
    }
    const rows = await this.db
      .select()
      .from(communityOrgs)
      .where(and(...conds))
      .orderBy(desc(communityOrgs.createdAt), desc(communityOrgs.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(toOrg),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async listManage(): Promise<CommunityOrg[]> {
    const rows = await this.db
      .select()
      .from(communityOrgs)
      .orderBy(desc(communityOrgs.updatedAt), desc(communityOrgs.createdAt))
      .limit(200);
    return rows.map(toOrg);
  }

  async listFeatured(): Promise<CommunityOrg[]> {
    const rows = await this.db
      .select()
      .from(communityOrgs)
      .where(
        and(
          eq(communityOrgs.status, 'published'),
          inArray(communityOrgs.isFeaturedKind, ['tim', 'sponsor']),
        ),
      )
      .limit(4);
    return rows.map(toOrg);
  }

  async findPublishedBySlug(slug: string): Promise<CommunityOrg | null> {
    const [row] = await this.db
      .select()
      .from(communityOrgs)
      .where(and(eq(communityOrgs.slug, slug), eq(communityOrgs.status, 'published')))
      .limit(1);
    return row ? toOrg(row) : null;
  }

  async findById(id: string): Promise<CommunityOrg | null> {
    const [row] = await this.db
      .select()
      .from(communityOrgs)
      .where(eq(communityOrgs.id, id))
      .limit(1);
    return row ? toOrg(row) : null;
  }

  async existingSlugs(candidates: string[]): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: communityOrgs.slug })
      .from(communityOrgs)
      .where(inArray(communityOrgs.slug, candidates));
    return new Set(rows.map((r) => r.slug));
  }

  async insertOrg(
    input: CommunityOrgFields & {
      slug: string;
      authorId: string | null;
      status?: CommunityPublishStatus;
    },
  ): Promise<CommunityOrg> {
    const now = new Date();
    const [row] = await this.db
      .insert(communityOrgs)
      .values({
        slug: input.slug,
        name: input.name,
        category: input.category,
        description: input.description,
        logoUrl: input.logoUrl,
        coverUrl: input.coverUrl,
        status: input.status ?? 'published',
        isFeaturedKind: input.isFeaturedKind ?? null,
        authorId: input.authorId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toOrg(row!);
  }

  async updateOrg(
    id: string,
    patch: Partial<CommunityOrgFields> & { status?: CommunityPublishStatus },
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl;
    if (patch.coverUrl !== undefined) set.coverUrl = patch.coverUrl;
    if (patch.isFeaturedKind !== undefined) set.isFeaturedKind = patch.isFeaturedKind;
    if (patch.status !== undefined) set.status = patch.status;
    await this.db.update(communityOrgs).set(set).where(eq(communityOrgs.id, id));
  }

  async clearFeaturedKind(
    kind: CommunityFeaturedKind,
    exceptId?: string,
  ): Promise<void> {
    const conds = [eq(communityOrgs.isFeaturedKind, kind)];
    if (exceptId) {
      await this.db
        .update(communityOrgs)
        .set({ isFeaturedKind: null, updatedAt: new Date() })
        .where(and(...conds, sql`${communityOrgs.id} <> ${exceptId}`));
      return;
    }
    await this.db
      .update(communityOrgs)
      .set({ isFeaturedKind: null, updatedAt: new Date() })
      .where(and(...conds));
  }

  async countOpenByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(communityProposals)
      .where(
        and(
          eq(communityProposals.userId, userId),
          eq(communityProposals.status, 'pending'),
        ),
      );
    return Number(row?.n ?? 0);
  }

  async insertProposal(input: {
    userId: string;
    name: string;
    description: string;
    logoUrl: string | null;
    category: CommunityCategory;
  }): Promise<string> {
    const [row] = await this.db
      .insert(communityProposals)
      .values({
        userId: input.userId,
        name: input.name,
        description: input.description,
        logoUrl: input.logoUrl,
        category: input.category,
        status: 'pending',
        createdAt: new Date(),
      })
      .returning({ id: communityProposals.id });
    return row!.id;
  }

  async findProposal(id: string): Promise<CommunityProposal | null> {
    const [row] = await this.db
      .select({ row: communityProposals, username: users.username })
      .from(communityProposals)
      .leftJoin(users, eq(users.id, communityProposals.userId))
      .where(eq(communityProposals.id, id))
      .limit(1);
    return row ? toProposal(row.row, row.username) : null;
  }

  async listProposals(input: {
    status?: CommunityProposalStatus;
    userId?: string;
  }): Promise<CommunityProposal[]> {
    const conds = [];
    if (input.status) conds.push(eq(communityProposals.status, input.status));
    if (input.userId) conds.push(eq(communityProposals.userId, input.userId));
    const rows = await this.db
      .select({ row: communityProposals, username: users.username })
      .from(communityProposals)
      .leftJoin(users, eq(users.id, communityProposals.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(communityProposals.createdAt))
      .limit(200);
    return rows.map((r) => toProposal(r.row, r.username));
  }

  async updateProposal(
    id: string,
    patch: Partial<{
      status: CommunityProposalStatus;
      reviewNote: string | null;
      reviewedBy: string | null;
      reviewedAt: Date | null;
      communityOrgId: string | null;
      category: CommunityCategory;
      name: string;
      description: string;
      logoUrl: string | null;
    }>,
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.reviewNote !== undefined) set.reviewNote = patch.reviewNote;
    if (patch.reviewedBy !== undefined) set.reviewedBy = patch.reviewedBy;
    if (patch.reviewedAt !== undefined) set.reviewedAt = patch.reviewedAt;
    if (patch.communityOrgId !== undefined) set.communityOrgId = patch.communityOrgId;
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl;
    await this.db
      .update(communityProposals)
      .set(set)
      .where(eq(communityProposals.id, id));
  }
}
