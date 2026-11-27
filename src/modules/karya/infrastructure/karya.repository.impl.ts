import { attachCommentRepliesTwoLevel } from '@/shared/comment/comment-threading';
import { and, asc, desc, eq, inArray, isNull, like, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import {
  karyaContributions,
  karyaCredits,
  karyaExcerpts,
  karyaLemmaLinks,
  karyas,
  kreators,
} from '@/shared/database/drizzle/schema';
import {
  karyaCommentRevisions,
  karyaComments,
} from '@/shared/database/drizzle/schema/karya-comments.schema';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { highestUserRoleSql } from '@/shared/database/highest-user-role-sql';
import {
  entityCommentAudioInsertValues,
  entityCommentImageInsertValues,
  toEntityCommentAudio,
  toEntityCommentImage,
} from '@/shared/comment/entity-comment-media';
import type { CursorPage } from '@/modules/word/domain/repositories/word.repository';
import { words } from '@/shared/database/drizzle/schema/words.schema';
import {
  KARYA_EXCERPT_LEMMA_LINK_RIGHTS,
  type KaryaLemmaLinkSource,
  type KaryaLemmaLinkStatus,
} from '@/shared/database/drizzle/schema/karya-lemma-links.schema';
import { resolvePublicAuthor } from '@/shared/utils/resolve-public-author';
import type {
  Karya,
  KaryaContribution,
  KaryaContributionPayload,
  KaryaCredit,
  KaryaExcerpt,
  KaryaExcerptFields,
  KaryaFields,
  KaryaLemmaAppearance,
  KaryaLemmaLink,
} from '../domain/karya';
import type {
  KaryaComment,
  KaryaCommentListFilter,
  KaryaCommentRepository,
  NewKaryaCommentInput,
} from '../domain/karya-comment';
import type { KaryaExcerptLemmaContext } from '../application/utils/assert-excerpt-lemma-eligible';
import {
  parseAccessLinksJson,
  parseRelatedJson,
  parseSambasConnectionsJson,
  serializeRelatedJson,
  type SambasConnectionType,
} from '../domain/karya';
import { KreatorRepositoryImpl } from '@/modules/kreator/infrastructure/kreator.repository.impl';

type KaryaRow = typeof karyas.$inferSelect;

const proposedWords = alias(words, 'proposed_words');

/** Cap riwayat edit per komentar. */
const COMMENT_REVISION_CAP = 50;

type KaryaCommentRow = typeof karyaComments.$inferSelect;

function toKaryaComment(
  row: KaryaCommentRow,
  meta: {
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    userRole: string | null;
    authorDeletedAt: Date | null;
    isEdited: boolean;
  },
): KaryaComment {
  return {
    id: row.id,
    karyaId: row.karyaId,
    parentId: row.parentId ?? null,
    userId: row.userId,
    username: meta.authorDeletedAt ? null : meta.username,
    displayName: meta.authorDeletedAt ? null : meta.displayName,
    avatarUrl: meta.authorDeletedAt ? null : meta.avatarUrl,
    userRole: meta.authorDeletedAt ? null : meta.userRole,
    authorDeletedAt: meta.authorDeletedAt,
    body: row.body,
    stickerId: row.stickerId ?? null,
    audio: toEntityCommentAudio(row),
    image: toEntityCommentImage(row),
    status: row.status,
    isEdited: meta.isEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

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
    related: parseRelatedJson(row.relatedJson),
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
    relatedJson: serializeRelatedJson(fields.related ?? []),
  };
}

function parsePayload(raw: string): KaryaContributionPayload {
  return JSON.parse(raw) as KaryaContributionPayload;
}

export class KaryaRepositoryImpl implements KaryaCommentRepository {
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
    // Satu query: credits + slug kreator (hindari N+1 / query ke-3 di listPublic).
    const rows = await this.db
      .select({
        credit: karyaCredits,
        kreatorSlug: kreators.slug,
      })
      .from(karyaCredits)
      .leftJoin(kreators, eq(kreators.id, karyaCredits.kreatorId))
      .where(inArray(karyaCredits.karyaId, karyaIds))
      .orderBy(asc(karyaCredits.sortOrder), asc(karyaCredits.createdAt));
    for (const row of rows) {
      const c = row.credit;
      const list = map.get(c.karyaId) ?? [];
      list.push({
        id: c.id,
        role: c.role,
        nameText: c.nameText,
        kreatorId: c.kreatorId,
        kreatorSlug: row.kreatorSlug ?? null,
        sortOrder: c.sortOrder,
      });
      map.set(c.karyaId, list);
    }
    return map;
  }

  async listPublic(input: {
    kind?: Karya['kind'];
    year?: number;
    q?: string;
    language?: string;
    sambasType?: SambasConnectionType;
  }): Promise<Karya[]> {
    const conds = [
      eq(karyas.publishStatus, 'published'),
      isNull(karyas.deletedAt),
    ];
    if (input.kind) conds.push(eq(karyas.kind, input.kind));
    if (input.year) conds.push(eq(karyas.year, input.year));
    if (input.language) conds.push(eq(karyas.language, input.language));
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
    let items = rows.map((r) => toKaryaBase(r, creditMap.get(r.id) ?? []));
    if (input.sambasType) {
      items = items.filter((row) =>
        row.sambasConnections.some((c) => c.type === input.sambasType),
      );
    }
    return items;
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
    const excerpts = excerptRows.map(toExcerpt);
    const linkMap = await this.listLemmaLinksByExcerptIds(excerpts.map((e) => e.id));
    for (const ex of excerpts) {
      ex.lemmaLinks = linkMap.get(ex.id) ?? [];
    }
    const item = toKaryaBase(row, creditRows, excerpts);
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
        relatedJson: serializeRelatedJson(input.related ?? []),
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

  async findExcerptLemmaContext(
    excerptId: string,
  ): Promise<KaryaExcerptLemmaContext | null> {
    const [row] = await this.db
      .select({
        excerpt: karyaExcerpts,
        karyaPublishStatus: karyas.publishStatus,
        karyaDeletedAt: karyas.deletedAt,
      })
      .from(karyaExcerpts)
      .innerJoin(karyas, eq(karyas.id, karyaExcerpts.karyaId))
      .where(eq(karyaExcerpts.id, excerptId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.excerpt.id,
      text: row.excerpt.text,
      publishStatus: row.excerpt.publishStatus,
      deletedAt: row.excerpt.deletedAt,
      rightsStatus: row.excerpt.rightsStatus,
      authorId: row.excerpt.authorId,
      karyaId: row.excerpt.karyaId,
      karyaPublishStatus: row.karyaPublishStatus,
      karyaDeletedAt: row.karyaDeletedAt,
    };
  }

  async listActiveLemmaLinksForExcerpt(excerptId: string): Promise<KaryaLemmaLink[]> {
    return this.listLemmaLinksForExcerpt(excerptId, true);
  }

  async listLemmaLinksForExcerpt(
    excerptId: string,
    activeOnly: boolean,
  ): Promise<KaryaLemmaLink[]> {
    const conds = [eq(karyaLemmaLinks.excerptId, excerptId)];
    if (activeOnly) {
      conds.push(
        sql`${karyaLemmaLinks.status} in ('active', 'pending_correction')`,
      );
    }
    const rows = await this.db
      .select({
        link: karyaLemmaLinks,
        lemma: words.lemma,
        proposedLemma: proposedWords.lemma,
      })
      .from(karyaLemmaLinks)
      .leftJoin(words, eq(words.id, karyaLemmaLinks.wordId))
      .leftJoin(proposedWords, eq(proposedWords.id, karyaLemmaLinks.proposedWordId))
      .where(and(...conds))
      .orderBy(asc(karyaLemmaLinks.start), asc(karyaLemmaLinks.id));
    return rows.map(mapKaryaLemmaLinkRow);
  }

  async listLemmaLinksByExcerptIds(
    excerptIds: string[],
  ): Promise<Map<string, KaryaLemmaLink[]>> {
    const map = new Map<string, KaryaLemmaLink[]>();
    if (excerptIds.length === 0) return map;
    const rows = await this.db
      .select({
        link: karyaLemmaLinks,
        lemma: words.lemma,
        proposedLemma: proposedWords.lemma,
      })
      .from(karyaLemmaLinks)
      .leftJoin(words, eq(words.id, karyaLemmaLinks.wordId))
      .leftJoin(proposedWords, eq(proposedWords.id, karyaLemmaLinks.proposedWordId))
      .where(
        and(
          inArray(karyaLemmaLinks.excerptId, excerptIds),
          sql`${karyaLemmaLinks.status} in ('active', 'pending_correction')`,
        ),
      )
      .orderBy(asc(karyaLemmaLinks.start), asc(karyaLemmaLinks.id));
    for (const row of rows) {
      const link = mapKaryaLemmaLinkRow(row);
      const list = map.get(link.excerptId) ?? [];
      list.push(link);
      map.set(link.excerptId, list);
    }
    return map;
  }

  async createLemmaLink(input: {
    excerptId: string;
    start: number;
    end: number;
    wordId: string;
    source: KaryaLemmaLinkSource;
    status?: KaryaLemmaLinkStatus;
  }): Promise<KaryaLemmaLink> {
    const [row] = await this.db
      .insert(karyaLemmaLinks)
      .values({
        excerptId: input.excerptId,
        start: input.start,
        end: input.end,
        wordId: input.wordId,
        source: input.source,
        status: input.status ?? 'active',
        createdAt: new Date(),
      })
      .returning({ id: karyaLemmaLinks.id });
    const created = await this.findLemmaLinkById(row!.id);
    return created!;
  }

  async findLemmaLinkById(id: string): Promise<KaryaLemmaLink | null> {
    const [row] = await this.db
      .select({
        link: karyaLemmaLinks,
        lemma: words.lemma,
        proposedLemma: proposedWords.lemma,
      })
      .from(karyaLemmaLinks)
      .leftJoin(words, eq(words.id, karyaLemmaLinks.wordId))
      .leftJoin(proposedWords, eq(proposedWords.id, karyaLemmaLinks.proposedWordId))
      .where(eq(karyaLemmaLinks.id, id))
      .limit(1);
    return row ? mapKaryaLemmaLinkRow(row) : null;
  }

  async updateLemmaLink(
    id: string,
    patch: {
      wordId?: string;
      status?: KaryaLemmaLinkStatus;
      source?: KaryaLemmaLinkSource;
      proposedWordId?: string | null;
      proposedBy?: string | null;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
    },
  ): Promise<KaryaLemmaLink | null> {
    await this.db
      .update(karyaLemmaLinks)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(karyaLemmaLinks.id, id));
    return this.findLemmaLinkById(id);
  }

  async deleteLemmaLink(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(karyaLemmaLinks)
      .where(eq(karyaLemmaLinks.id, id))
      .returning({ id: karyaLemmaLinks.id });
    return rows.length > 0;
  }

  async listLemmaAppearancesByWordId(wordId: string): Promise<KaryaLemmaAppearance[]> {
    const rows = await this.db
      .select({
        karyaSlug: karyas.slug,
        karyaTitle: karyas.title,
        excerptId: karyaExcerpts.id,
        excerptKind: karyaExcerpts.kind,
        text: karyaExcerpts.text,
        start: karyaLemmaLinks.start,
        end: karyaLemmaLinks.end,
      })
      .from(karyaLemmaLinks)
      .innerJoin(karyaExcerpts, eq(karyaExcerpts.id, karyaLemmaLinks.excerptId))
      .innerJoin(karyas, eq(karyas.id, karyaExcerpts.karyaId))
      .where(
        and(
          eq(karyaLemmaLinks.wordId, wordId),
          eq(karyaLemmaLinks.status, 'active'),
          eq(karyaExcerpts.publishStatus, 'published'),
          isNull(karyaExcerpts.deletedAt),
          ne(karyaExcerpts.rightsStatus, 'unknown'),
          inArray(karyaExcerpts.rightsStatus, [...KARYA_EXCERPT_LEMMA_LINK_RIGHTS]),
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
        ),
      )
      .orderBy(asc(karyas.title), asc(karyaExcerpts.createdAt), asc(karyaLemmaLinks.start))
      .limit(50);
    return rows.map((r) => ({
      karyaSlug: r.karyaSlug,
      karyaTitle: r.karyaTitle,
      excerptId: r.excerptId,
      excerptKind: r.excerptKind as KaryaLemmaAppearance['excerptKind'],
      start: r.start,
      end: r.end,
      snippet: r.text.slice(r.start, r.end),
    }));
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

  // ---------------------------------------------------------------- komentar

  async createComment(input: NewKaryaCommentInput): Promise<KaryaComment> {
    const [row] = await this.db
      .insert(karyaComments)
      .values({
        karyaId: input.karyaId,
        parentId: input.parentId ?? null,
        userId: input.userId,
        body: input.body,
        bodyOriginal: input.bodyOriginal,
        stickerId: input.stickerId ?? null,
        ...entityCommentImageInsertValues(input.image),
        ...entityCommentAudioInsertValues(input.audio),
        createdAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('gagal menyimpan komentar karya');
    const comment = await this.findCommentById(row.id);
    if (!comment) throw new Error('komentar karya tidak ditemukan setelah dibuat');
    return comment;
  }

  async findCommentById(id: string): Promise<KaryaComment | null> {
    const [row] = await this.db
      .select({
        c: karyaComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${karyaCommentRevisions}
          WHERE ${karyaCommentRevisions.commentId} = ${karyaComments.id}
        )`,
      })
      .from(karyaComments)
      .leftJoin(users, eq(users.id, karyaComments.userId))
      .where(eq(karyaComments.id, id))
      .limit(1);
    if (!row) return null;
    return toKaryaComment(row.c, {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      userRole: row.userRole,
      authorDeletedAt: row.authorDeletedAt,
      isEdited: Boolean(row.isEdited),
    });
  }

  async listComments(
    karyaId: string,
    filter: KaryaCommentListFilter,
  ): Promise<CursorPage<KaryaComment>> {
    const limit = filter.limit;
    const conditions = [eq(karyaComments.karyaId, karyaId), isNull(karyaComments.parentId)];
    if (filter.status) conditions.push(eq(karyaComments.status, filter.status));
    // Komentar id = ULID monoton -> lt(id, cursor) aman sebagai keyset.
    if (filter.cursor) conditions.push(lt(karyaComments.id, filter.cursor));

    const rows = await this.db
      .select({
        c: karyaComments,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        authorDeletedAt: users.deletedAt,
        userRole: highestUserRoleSql,
        isEdited: sql<boolean>`EXISTS (
          SELECT 1 FROM ${karyaCommentRevisions}
          WHERE ${karyaCommentRevisions.commentId} = ${karyaComments.id}
        )`,
      })
      .from(karyaComments)
      .leftJoin(users, eq(users.id, karyaComments.userId))
      .where(and(...conditions))
      .orderBy(desc(karyaComments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const tops = page.map((row) =>
      toKaryaComment(row.c, {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        userRole: row.userRole,
        authorDeletedAt: row.authorDeletedAt,
        isEdited: Boolean(row.isEdited),
      }),
    );
    const topIds = tops.map((t) => t.id);
    let replies: KaryaComment[] = [];
    if (topIds.length > 0) {
      const replyConds = [inArray(karyaComments.parentId, topIds)];
      if (filter.status) replyConds.push(eq(karyaComments.status, filter.status));
      const replyRows = await this.db
        .select({
          c: karyaComments,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          authorDeletedAt: users.deletedAt,
          userRole: highestUserRoleSql,
          isEdited: sql<boolean>`EXISTS (
            SELECT 1 FROM ${ karyaCommentRevisions }
            WHERE ${ karyaCommentRevisions.commentId } = ${ karyaComments.id }
          )`,
        })
        .from(karyaComments)
        .leftJoin(users, eq(users.id, karyaComments.userId))
        .where(and(...replyConds))
        .orderBy(karyaComments.createdAt, karyaComments.id);
      replies = replyRows.map((row) =>
        toKaryaComment(row.c, {
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          userRole: row.userRole,
          authorDeletedAt: row.authorDeletedAt,
          isEdited: Boolean(row.isEdited),
        }),
      );
    }
    return {
      items: attachCommentRepliesTwoLevel(tops, replies),
      nextCursor: hasMore ? (page[page.length - 1]?.c.id ?? null) : null,
      hasMore,
    };
  }

  async updateCommentWithRevision(input: {
    commentId: string;
    editorId: string;
    body: string;
  }): Promise<KaryaComment | null> {
    const now = new Date();
    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ body: karyaComments.body })
        .from(karyaComments)
        .where(eq(karyaComments.id, input.commentId))
        .limit(1);
      if (!current) return null;

      await tx.insert(karyaCommentRevisions).values({
        commentId: input.commentId,
        editorId: input.editorId,
        body: current.body,
        createdAt: now,
      });
      const revisions = await tx
        .select({ id: karyaCommentRevisions.id })
        .from(karyaCommentRevisions)
        .where(eq(karyaCommentRevisions.commentId, input.commentId))
        .orderBy(desc(karyaCommentRevisions.createdAt));
      const excess = revisions.slice(COMMENT_REVISION_CAP);
      if (excess.length > 0) {
        await tx
          .delete(karyaCommentRevisions)
          .where(inArray(karyaCommentRevisions.id, excess.map((r) => r.id)));
      }

      const [row] = await tx
        .update(karyaComments)
        .set({ body: input.body, updatedAt: now })
        .where(
          and(
            eq(karyaComments.id, input.commentId),
            eq(karyaComments.status, 'published'),
            eq(karyaComments.userId, input.editorId),
          ),
        )
        .returning({ id: karyaComments.id });
      return row?.id ?? null;
    });
    if (!updated) return null;
    return this.findCommentById(updated);
  }

  async markCommentDeletedByAuthor(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(karyaComments)
      .set({ status: 'deleted_by_author', deletedAt: new Date() })
      .where(
        and(
          eq(karyaComments.id, id),
          eq(karyaComments.userId, actorId),
          eq(karyaComments.status, 'published'),
        ),
      )
      .returning({ id: karyaComments.id });
    return Boolean(row);
  }

  async takedownComment(id: string, actorId: string): Promise<boolean> {
    const [row] = await this.db
      .update(karyaComments)
      .set({ status: 'taken_down', reviewedBy: actorId, reviewedAt: new Date() })
      .where(and(eq(karyaComments.id, id), eq(karyaComments.status, 'published')))
      .returning({ id: karyaComments.id });
    return Boolean(row);
  }

  async listCommentRevisions(
    commentId: string,
  ): Promise<Array<{ editorId: string; body: string; createdAt: Date }>> {
    const rows = await this.db
      .select({
        editorId: karyaCommentRevisions.editorId,
        body: karyaCommentRevisions.body,
        createdAt: karyaCommentRevisions.createdAt,
      })
      .from(karyaCommentRevisions)
      .where(eq(karyaCommentRevisions.commentId, commentId))
      .orderBy(desc(karyaCommentRevisions.createdAt), desc(karyaCommentRevisions.id));
    return rows;
  }

  async karyaTargetExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: karyas.id })
      .from(karyas)
      .where(
        and(
          eq(karyas.id, id),
          eq(karyas.publishStatus, 'published'),
          isNull(karyas.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}

function mapKaryaLemmaLinkRow(row: {
  link: typeof karyaLemmaLinks.$inferSelect;
  lemma: string | null;
  proposedLemma: string | null;
}): KaryaLemmaLink {
  return {
    id: row.link.id,
    excerptId: row.link.excerptId,
    start: row.link.start,
    end: row.link.end,
    wordId: row.link.wordId,
    lemma: row.lemma,
    status: row.link.status as KaryaLemmaLinkStatus,
    source: row.link.source as KaryaLemmaLinkSource,
    proposedWordId: row.link.proposedWordId,
    proposedLemma: row.proposedLemma,
    proposedBy: row.link.proposedBy,
    reviewedBy: row.link.reviewedBy,
    reviewedAt: row.link.reviewedAt,
    createdAt: row.link.createdAt,
    updatedAt: row.link.updatedAt,
  };
}