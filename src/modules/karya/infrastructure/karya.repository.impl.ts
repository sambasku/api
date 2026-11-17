import { and, asc, desc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  karyaContributions,
  karyaCredits,
  karyaExcerpts,
  karyas,
} from '@/shared/database/drizzle/schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { resolvePublicAuthor } from '@/shared/utils/resolve-public-author';
import type {
  Karya,
  KaryaContribution,
  KaryaContributionPayload,
  KaryaCredit,
  KaryaExcerpt,
  KaryaExcerptFields,
  KaryaFields,
} from '../domain/karya';
import { parseAccessLinksJson, parseSambasConnectionsJson } from '../domain/karya';
import { KreatorRepositoryImpl } from '@/modules/kreator/infrastructure/kreator.repository.impl';

type KaryaRow = typeof karyas.$inferSelect;

function toCredits(rows: (typeof karyaCredits.$inferSelect)[]): KaryaCredit[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    nameText: r.nameText,
    kreatorId: r.kreatorId,
    sortOrder: r.sortOrder,
  }));
}

function toExcerpt(row: typeof karyaExcerpts.$inferSelect): KaryaExcerpt {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    language: row.language,
    startLabel: row.startLabel,
    endLabel: row.endLabel,
    rightsStatus: row.rightsStatus,
    rightsNote: row.rightsNote,
    sourceUrl: row.sourceUrl,
  };
}

function toKaryaBase(row: KaryaRow, credits: KaryaCredit[], excerpts?: KaryaExcerpt[]): Karya {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    year: row.year,
    language: row.language,
    description: row.description,
    coverUrl: row.coverUrl,
    sambasConnections: parseSambasConnectionsJson(row.sambasConnectionsJson),
    accessLinks: parseAccessLinksJson(row.accessLinksJson),
    credits,
    musicReleaseType: row.musicReleaseType,
    musicDurationMs: row.musicDurationMs,
    musicIsCover: row.musicIsCover,
    filmType: row.filmType,
    filmRuntimeMin: row.filmRuntimeMin,
    publishStatus: row.publishStatus,
    authorId: row.authorId,
    author: null,
    excerpts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeFields(fields: KaryaFields) {
  return {
    title: fields.title,
    kind: fields.kind,
    year: fields.year,
    language: fields.language,
    description: fields.description,
    coverUrl: fields.coverUrl,
    sambasConnectionsJson: JSON.stringify(fields.sambasConnections),
    accessLinksJson: JSON.stringify(fields.accessLinks),
    musicReleaseType: fields.musicReleaseType,
    musicDurationMs: fields.musicDurationMs,
    musicIsCover: fields.musicIsCover,
    filmType: fields.filmType,
    filmRuntimeMin: fields.filmRuntimeMin,
  };
}

function parsePayload(raw: string): KaryaContributionPayload {
  return JSON.parse(raw) as KaryaContributionPayload;
}

export class KaryaRepositoryImpl {
  private readonly kreators: KreatorRepositoryImpl;

  constructor(private readonly db: AppDatabase) {
    this.kreators = new KreatorRepositoryImpl(db);
  }

  private async attachKreatorSlugs(credits: KaryaCredit[]): Promise<KaryaCredit[]> {
    const ids = [
      ...new Set(credits.map((c) => c.kreatorId).filter((id): id is string => !!id)),
    ];
    const slugMap = await this.kreators.slugsByIds(ids);
    return credits.map((c) => ({
      ...c,
      kreatorSlug: c.kreatorId ? (slugMap.get(c.kreatorId) ?? null) : null,
    }));
  }

  private async loadCreditsMap(karyaIds: string[]): Promise<Map<string, KaryaCredit[]>> {
    const map = new Map<string, KaryaCredit[]>();
    if (karyaIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(karyaCredits)
      .where(inArray(karyaCredits.karyaId, karyaIds))
      .orderBy(asc(karyaCredits.sortOrder), asc(karyaCredits.createdAt));
    const kreatorIds = [
      ...new Set(rows.map((r) => r.kreatorId).filter((id): id is string => !!id)),
    ];
    const slugMap = await this.kreators.slugsByIds(kreatorIds);
    for (const row of rows) {
      const list = map.get(row.karyaId) ?? [];
      list.push({
        id: row.id,
        role: row.role,
        nameText: row.nameText,
        kreatorId: row.kreatorId,
        kreatorSlug: row.kreatorId ? (slugMap.get(row.kreatorId) ?? null) : null,
        sortOrder: row.sortOrder,
      });
      map.set(row.karyaId, list);
    }
    return map;
  }

  async listPublic(input: {
    kind?: Karya['kind'];
    year?: number;
    q?: string;
  }): Promise<Karya[]> {
    const conds = [
      eq(karyas.publishStatus, 'published'),
      isNull(karyas.deletedAt),
    ];
    if (input.kind) conds.push(eq(karyas.kind, input.kind));
    if (input.year) conds.push(eq(karyas.year, input.year));
    if (input.q && input.q.trim()) {
      conds.push(like(karyas.title, `%${input.q.trim()}%`));
    }
    const rows = await this.db
      .select()
      .from(karyas)
      .where(and(...conds))
      .orderBy(desc(karyas.year), asc(karyas.title))
      .limit(200);
    const creditMap = await this.loadCreditsMap(rows.map((r) => r.id));
    return rows.map((r) => toKaryaBase(r, creditMap.get(r.id) ?? []));
  }

  async listManage(): Promise<(Karya & { authorName: string | null })[]> {
    const rows = await this.db
      .select({
        karya: karyas,
        authorName: users.username,
      })
      .from(karyas)
      .leftJoin(users, eq(karyas.authorId, users.id))
      .where(isNull(karyas.deletedAt))
      .orderBy(desc(karyas.updatedAt), desc(karyas.createdAt))
      .limit(200);
    const creditMap = await this.loadCreditsMap(rows.map((r) => r.karya.id));
    return rows.map((r) => ({
      ...toKaryaBase(r.karya, creditMap.get(r.karya.id) ?? []),
      authorName: r.authorName,
    }));
  }

  async findPublishedBySlug(slug: string): Promise<Karya | null> {
    const [row] = await this.db
      .select()
      .from(karyas)
      .where(
        and(
          eq(karyas.slug, slug),
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [credits, excerptRows] = await Promise.all([
      this.db
        .select()
        .from(karyaCredits)
        .where(eq(karyaCredits.karyaId, row.id))
        .orderBy(asc(karyaCredits.sortOrder)),
      this.db
        .select()
        .from(karyaExcerpts)
        .where(
          and(
            eq(karyaExcerpts.karyaId, row.id),
            eq(karyaExcerpts.publishStatus, 'published'),
            isNull(karyaExcerpts.deletedAt),
          ),
        )
        .orderBy(asc(karyaExcerpts.createdAt)),
    ]);
    const creditRows = await this.attachKreatorSlugs(toCredits(credits));
    const item = toKaryaBase(row, creditRows, excerptRows.map(toExcerpt));
    item.author = await resolvePublicAuthor(this.db, item.authorId);
    return item;
  }

  async findById(id: string): Promise<Karya | null> {
    const [row] = await this.db
      .select()
      .from(karyas)
      .where(and(eq(karyas.id, id), isNull(karyas.deletedAt)))
      .limit(1);
    if (!row) return null;
    const credits = await this.db
      .select()
      .from(karyaCredits)
      .where(eq(karyaCredits.karyaId, id))
      .orderBy(asc(karyaCredits.sortOrder));
    const creditRows = await this.attachKreatorSlugs(toCredits(credits));
    return toKaryaBase(row, creditRows);
  }

  async existingSlugs(candidates: string[]): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const rows = await this.db
      .select({ slug: karyas.slug })
      .from(karyas)
      .where(inArray(karyas.slug, candidates));
    return new Set(rows.map((r) => r.slug));
  }

  async insert(
    input: KaryaFields & { slug: string; authorId: string | null },
  ): Promise<Karya> {
    const now = new Date();
    const [row] = await this.db
      .insert(karyas)
      .values({
        slug: input.slug,
        ...serializeFields(input),
        sourcesJson: '[]',
        relatedJson: '[]',
        publishStatus: 'published',
        authorId: input.authorId,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await this.replaceCredits(row!.id, input.credits);
    const found = await this.findById(row!.id);
    return found!;
  }

  async update(id: string, fields: KaryaFields): Promise<void> {
    await this.db
      .update(karyas)
      .set({
        ...serializeFields(fields),
        updatedAt: new Date(),
      })
      .where(eq(karyas.id, id));
    await this.replaceCredits(id, fields.credits);
  }

  async updatePublishStatus(
    id: string,
    publishStatus: Karya['publishStatus'],
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      publishStatus,
      updatedAt: new Date(),
    };
    if (publishStatus === 'published') {
      patch.publishedAt = new Date();
    }
    await this.db.update(karyas).set(patch).where(eq(karyas.id, id));
  }

  private async replaceCredits(karyaId: string, credits: KaryaCredit[]): Promise<void> {
    await this.db.delete(karyaCredits).where(eq(karyaCredits.karyaId, karyaId));
    if (credits.length === 0) return;
    const linked = await this.kreators.resolveCreditsKreatorIds(credits);
    const now = new Date();
    await this.db.insert(karyaCredits).values(
      linked.map((c, i) => ({
        karyaId,
        role: c.role,
        nameText: c.nameText,
        kreatorId: c.kreatorId,
        sortOrder: c.sortOrder ?? i,
        createdAt: now,
      })),
    );
  }

  async insertExcerpt(
    karyaId: string,
    fields: KaryaExcerptFields,
    authorId: string | null,
  ): Promise<string> {
    const now = new Date();
    const [row] = await this.db
      .insert(karyaExcerpts)
      .values({
        karyaId,
        kind: fields.kind,
        text: fields.text,
        language: fields.language,
        startLabel: fields.startLabel,
        endLabel: fields.endLabel,
        rightsStatus: fields.rightsStatus,
        rightsNote: fields.rightsNote,
        sourceUrl: fields.sourceUrl,
        publishStatus: 'published',
        authorId,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: karyaExcerpts.id });
    return row!.id;
  }

  async countOpenByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(karyaContributions)
      .where(
        and(
          eq(karyaContributions.userId, userId),
          inArray(karyaContributions.status, ['pending', 'needs_revision']),
        ),
      );
    return Number(row?.n ?? 0);
  }

  async insertContribution(input: {
    kind: KaryaContribution['kind'];
    userId: string;
    karyaId: string | null;
    payload: KaryaContributionPayload;
  }): Promise<string> {
    const [row] = await this.db
      .insert(karyaContributions)
      .values({
        kind: input.kind,
        userId: input.userId,
        karyaId: input.karyaId,
        payloadJson: JSON.stringify(input.payload),
        status: 'pending',
        createdAt: new Date(),
      })
      .returning({ id: karyaContributions.id });
    return row!.id;
  }

  async findContribution(id: string): Promise<KaryaContribution | null> {
    const [row] = await this.db
      .select({ row: karyaContributions, username: users.username })
      .from(karyaContributions)
      .leftJoin(users, eq(users.id, karyaContributions.userId))
      .where(eq(karyaContributions.id, id))
      .limit(1);
    return row ? this.toContribution(row.row, row.username) : null;
  }

  async listContributions(input: {
    status?: KaryaContribution['status'];
    userId?: string;
  }): Promise<KaryaContribution[]> {
    const conds = [];
    if (input.status) conds.push(eq(karyaContributions.status, input.status));
    if (input.userId) conds.push(eq(karyaContributions.userId, input.userId));
    const rows = await this.db
      .select({ row: karyaContributions, username: users.username })
      .from(karyaContributions)
      .leftJoin(users, eq(users.id, karyaContributions.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(karyaContributions.createdAt))
      .limit(200);
    return rows.map((r) => this.toContribution(r.row, r.username));
  }

  async updateContribution(
    id: string,
    patch: Partial<{
      status: KaryaContribution['status'];
      payload: KaryaContributionPayload;
      resultKaryaId: string | null;
      resultExcerptId: string | null;
      revisionNote: string | null;
      rejectReasonCode: string | null;
      rejectReasonText: string | null;
    }>,
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.payload !== undefined) set.payloadJson = JSON.stringify(patch.payload);
    if (patch.resultKaryaId !== undefined) set.resultKaryaId = patch.resultKaryaId;
    if (patch.resultExcerptId !== undefined) set.resultExcerptId = patch.resultExcerptId;
    if (patch.revisionNote !== undefined) set.revisionNote = patch.revisionNote;
    if (patch.rejectReasonCode !== undefined) set.rejectReasonCode = patch.rejectReasonCode;
    if (patch.rejectReasonText !== undefined) set.rejectReasonText = patch.rejectReasonText;
    await this.db.update(karyaContributions).set(set).where(eq(karyaContributions.id, id));
  }

  async deleteContribution(id: string): Promise<void> {
    await this.db.delete(karyaContributions).where(eq(karyaContributions.id, id));
  }

  private toContribution(
    row: typeof karyaContributions.$inferSelect,
    username: string | null,
  ): KaryaContribution {
    const payload = parsePayload(row.payloadJson);
    return {
      id: row.id,
      kind: row.kind,
      userId: row.userId,
      username,
      karyaId: row.karyaId,
      payload,
      status: row.status,
      resultKaryaId: row.resultKaryaId,
      resultExcerptId: row.resultExcerptId,
      revisionNote: row.revisionNote,
      rejectReasonCode: row.rejectReasonCode,
      rejectReasonText: row.rejectReasonText,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}