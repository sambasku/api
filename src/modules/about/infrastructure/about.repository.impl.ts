import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/shared/database/drizzle/schema';
import { sponsorships, userRoles, users } from '@/shared/database/drizzle/schema';
import { ANONIM_USER_ID } from '@/shared/constants/anonim';
import type {
  ContributorListItem,
  NewSponsorship,
  Sponsorship,
  TeamMember,
  UpdateSponsorship,
  VerifierListItem,
} from '../domain/entities/about.entity';
import type {
  AboutRepository,
  ListContributorsPage,
  ListVerifiersPage,
} from '../domain/repositories/about.repository';

type Db = LibSQLDatabase<typeof schema>;

function toSponsorship(row: typeof sponsorships.$inferSelect): Sponsorship {
  return {
    id: row.id,
    userId: row.userId ?? null,
    usahaId: row.usahaId ?? null,
    name: row.name,
    description: row.description ?? null,
    logoUrl: row.logoUrl ?? null,
    url: row.url ?? null,
    username: row.username ?? null,
    tier: row.tier,
    since: row.since,
    endsOn: row.endsOn ?? null,
    note: row.note ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    deletedAt: row.deletedAt ?? null,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Soft-delete null + since/ends_on window (hari ini di dalam masa). */
function activeSponsorshipConds(today = todayIsoDate()) {
  return and(
    isNull(sponsorships.deletedAt),
    sql`${sponsorships.since} <= ${today}`,
    or(isNull(sponsorships.endsOn), sql`${sponsorships.endsOn} >= ${today}`),
  );
}

export class AboutRepositoryImpl implements AboutRepository {
  constructor(private readonly db: Db) {}

  async listTeam(): Promise<TeamMember[]> {
    const rows = await this.db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        teamAs: users.teamAs,
        teamNote: users.teamNote,
      })
      .from(users)
      .where(
        and(
          eq(users.isTeam, true),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          sql`${users.id} != ${ANONIM_USER_ID}`,
        ),
      )
      .orderBy(
        sql`CASE WHEN ${users.teamSortOrder} IS NULL THEN 1 ELSE 0 END`,
        asc(users.teamSortOrder),
        asc(users.displayName),
        asc(users.id),
      );

    return rows.map((r) => ({
      username: r.username,
      displayName: r.displayName || r.username,
      avatarUrl: r.avatarUrl ?? null,
      teamAs: r.teamAs ?? null,
      teamNote: r.teamNote ?? null,
    }));
  }

  async listSponsorships(): Promise<Sponsorship[]> {
    const rows = await this.db
      .select()
      .from(sponsorships)
      .where(activeSponsorshipConds())
      .orderBy(asc(sponsorships.since), asc(sponsorships.id));
    return rows.map(toSponsorship);
  }

  async listSplashSponsorships(): Promise<Sponsorship[]> {
    const rows = await this.db
      .select()
      .from(sponsorships)
      .where(
        and(
          activeSponsorshipConds(),
          sql`${sponsorships.usahaId} is not null`,
          inArray(sponsorships.tier, ['emas', 'intan', 'mustika']),
        ),
      )
      .orderBy(asc(sponsorships.since), asc(sponsorships.id));
    return rows.map(toSponsorship);
  }

  async listSponsorshipsAdmin(
    limit: number,
    cursor?: string,
  ): Promise<{ items: Sponsorship[]; nextCursor: string | null; hasMore: boolean }> {
    const conds = [isNull(sponsorships.deletedAt)];
    if (cursor) {
      conds.push(sql`${sponsorships.id} < ${cursor}`);
    }
    const rows = await this.db
      .select()
      .from(sponsorships)
      .where(and(...conds))
      .orderBy(desc(sponsorships.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(toSponsorship),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async findSponsorshipById(id: string): Promise<Sponsorship | null> {
    const [row] = await this.db
      .select()
      .from(sponsorships)
      .where(and(eq(sponsorships.id, id), isNull(sponsorships.deletedAt)))
      .limit(1);
    return row ? toSponsorship(row) : null;
  }

  async findActiveSponsorshipByUserId(userId: string): Promise<Sponsorship | null> {
    const [row] = await this.db
      .select()
      .from(sponsorships)
      .where(and(eq(sponsorships.userId, userId), activeSponsorshipConds()))
      .limit(1);
    return row ? toSponsorship(row) : null;
  }

  async createSponsorship(data: NewSponsorship): Promise<Sponsorship> {
    const [row] = await this.db
      .insert(sponsorships)
      .values({
        userId: data.userId ?? null,
        usahaId: data.usahaId ?? null,
        name: data.name,
        description: data.description ?? null,
        logoUrl: data.logoUrl ?? null,
        url: data.url ?? null,
        username: data.username ?? null,
        tier: data.tier ?? 'perak',
        since: data.since,
        endsOn: data.endsOn ?? null,
        note: data.note ?? '',
      })
      .returning();
    return toSponsorship(row);
  }

  async updateSponsorship(
    id: string,
    data: UpdateSponsorship,
  ): Promise<Sponsorship | null> {
    const patch: Partial<typeof sponsorships.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.logoUrl !== undefined) patch.logoUrl = data.logoUrl;
    if (data.url !== undefined) patch.url = data.url;
    if (data.username !== undefined) patch.username = data.username;
    if (data.userId !== undefined) patch.userId = data.userId;
    if (data.usahaId !== undefined) patch.usahaId = data.usahaId;
    if (data.tier !== undefined) patch.tier = data.tier;
    if (data.since !== undefined) patch.since = data.since;
    if (data.endsOn !== undefined) patch.endsOn = data.endsOn;
    if (data.note !== undefined) patch.note = data.note;

    const [row] = await this.db
      .update(sponsorships)
      .set(patch)
      .where(and(eq(sponsorships.id, id), isNull(sponsorships.deletedAt)))
      .returning();
    return row ? toSponsorship(row) : null;
  }

  async softDeleteSponsorship(id: string): Promise<boolean> {
    const [row] = await this.db
      .update(sponsorships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sponsorships.id, id), isNull(sponsorships.deletedAt)))
      .returning({ id: sponsorships.id });
    return !!row;
  }

  async setUserSponsor(userId: string, isSponsor: boolean): Promise<Sponsorship | null> {
    if (userId === ANONIM_USER_ID) return null;

    if (!isSponsor) {
      await this.db
        .update(sponsorships)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(eq(sponsorships.userId, userId), isNull(sponsorships.deletedAt)),
        );
      return null;
    }

    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(eq(users.id, userId), isNull(users.deletedAt), eq(users.isActive, true)),
      )
      .limit(1);
    if (!user) return null;

    // Restore soft-deleted bila ada.
    const [existing] = await this.db
      .select()
      .from(sponsorships)
      .where(eq(sponsorships.userId, userId))
      .orderBy(desc(sponsorships.createdAt))
      .limit(1);

    if (existing) {
      if (existing.deletedAt == null) return toSponsorship(existing);
      const [restored] = await this.db
        .update(sponsorships)
        .set({
          deletedAt: null,
          updatedAt: new Date(),
          name: existing.name || user.displayName || user.username,
          username: user.username,
          logoUrl: existing.logoUrl ?? user.avatarUrl ?? null,
        })
        .where(eq(sponsorships.id, existing.id))
        .returning();
      return restored ? toSponsorship(restored) : null;
    }

    return this.createSponsorship({
      userId,
      name: user.displayName || user.username,
      username: user.username,
      logoUrl: user.avatarUrl ?? null,
      tier: 'perak',
      since: todayIsoDate(),
      note: '',
    });
  }

  async listContributors(
    limit: number,
    cursor?: string,
  ): Promise<ListContributorsPage> {
    // Keyset: ORDER BY display_name ASC, id ASC.
    // Cursor = id baris terakhir; lookup tuple lalu filter.
    const conds = [
      eq(users.isActive, true),
      isNull(users.deletedAt),
      sql`${users.id} != ${ANONIM_USER_ID}`,
      sql`EXISTS (
        SELECT 1 FROM ${userRoles}
        WHERE ${userRoles.userId} = ${users.id}
          AND ${userRoles.role} = 'contributor'
      )`,
    ];

    if (cursor) {
      const [cur] = await this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, cursor))
        .limit(1);
      if (!cur) {
        return { items: [], nextCursor: null, hasMore: false };
      }
      const curName = cur.displayName || '';
      conds.push(
        sql`(
          ${users.displayName} > ${curName}
          OR (${users.displayName} = ${curName} AND ${users.id} > ${cur.id})
        )`,
      );
    }

    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(users)
      .where(and(...conds))
      .orderBy(asc(users.displayName), asc(users.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: ContributorListItem[] = page.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.displayName || r.username,
    }));
    return {
      items,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }

  async listActiveSponsorUserIds(userIds: string[]): Promise<Set<string>> {
    const set = new Set<string>();
    if (userIds.length === 0) return set;
    const rows = await this.db
      .select({ userId: sponsorships.userId })
      .from(sponsorships)
      .where(and(inArray(sponsorships.userId, userIds), activeSponsorshipConds()));
    for (const r of rows) {
      if (r.userId) set.add(r.userId);
    }
    return set;
  }

  async listVerifiers(
    limit: number,
    cursor?: string,
  ): Promise<ListVerifiersPage> {
    const conds = [
      eq(users.isActive, true),
      isNull(users.deletedAt),
      sql`${users.id} != ${ANONIM_USER_ID}`,
      sql`EXISTS (
        SELECT 1 FROM ${userRoles}
        WHERE ${userRoles.userId} = ${users.id}
          AND ${userRoles.role} = 'reviewer'
      )`,
    ];

    if (cursor) {
      const [cur] = await this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, cursor))
        .limit(1);
      if (!cur) {
        return { items: [], nextCursor: null, hasMore: false };
      }
      const curName = cur.displayName || '';
      conds.push(
        sql`(
          ${users.displayName} > ${curName}
          OR (${users.displayName} = ${curName} AND ${users.id} > ${cur.id})
        )`,
      );
    }

    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(and(...conds))
      .orderBy(asc(users.displayName), asc(users.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: VerifierListItem[] = page.map((r) => ({
      username: r.username,
      displayName: r.displayName || r.username,
      avatarUrl: r.avatarUrl ?? null,
    }));
    return {
      items,
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      hasMore,
    };
  }
}
