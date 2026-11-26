import { and, desc, eq, inArray, isNotNull, isNull, like, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/shared/database/drizzle/client';
import { users } from '@/shared/database/drizzle/schema/users.schema';
import { places } from '@/shared/database/drizzle/schema/places.schema';
import { placeComments } from '@/shared/database/drizzle/schema/place-comments.schema';
import { cuisines } from '@/shared/database/drizzle/schema/cuisines.schema';
import { cuisineComments } from '@/shared/database/drizzle/schema/cuisine-comments.schema';
import { usahas } from '@/shared/database/drizzle/schema/usahas.schema';
import { usahaComments } from '@/shared/database/drizzle/schema/usaha-comments.schema';
import { events } from '@/shared/database/drizzle/schema/events.schema';
import { eventComments } from '@/shared/database/drizzle/schema/event-comments.schema';
import { karyas } from '@/shared/database/drizzle/schema/karyas.schema';
import { karyaComments } from '@/shared/database/drizzle/schema/karya-comments.schema';
import { articles, articleComments } from '@/shared/database/drizzle/schema/encyclopedia.schema';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/app-error';
import { IMAGE_CONTENT_WARNING_SET } from '@/shared/constants/image-content-warnings';
import {
  publicAccountDisplayName,
  publicAccountName,
} from '@/shared/constants/deleted-account';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { ImageStoragePort } from '@/modules/image/application/ports/image-storage.port';
import type { PublicImageStoragePort } from '@/modules/public-image/application/ports/public-image-storage.port';
import { buildCommentImagePath } from '@/modules/public-image/application/utils/public-image-path';
import { validateImageFile } from '@/modules/public-image/application/utils/validate-image-file';
import {
  RecordAbuseSignalUseCase,
  safeRecordAbuseSignal,
} from '@/shared/moderation/record-abuse-signal.use-case';

export const EXPLORE_COMMENT_MODULES = [
  'place',
  'culinary',
  'usaha',
  'event',
  'karya',
  'encyclopedia',
] as const;

export type ExploreCommentModule = (typeof EXPLORE_COMMENT_MODULES)[number];
export type ExploreCommentStatus = 'published' | 'taken_down' | 'deleted_by_author';
export type ExploreCommentMediaFilter = 'image' | 'audio' | 'any';

export interface AdminExploreCommentItem {
  id: string;
  module: ExploreCommentModule;
  target_id: string;
  target_name: string;
  target_slug: string;
  user_id: string;
  author_username: string | null;
  author_display_name: string | null;
  body: string;
  body_original: string | null;
  is_censored: boolean;
  status: ExploreCommentStatus;
  audio_url: string | null;
  audio_mime_type: string | null;
  audio_duration_ms: number | null;
  image: {
    status: 'pending_review' | 'published' | 'rejected';
    url: string | null;
    public_url: string | null;
    content_warnings: string[];
  } | null;
  created_at: string;
  updated_at: string | null;
}

export interface ListAdminExploreCommentsInput {
  module: ExploreCommentModule;
  status?: ExploreCommentStatus;
  hasMedia?: ExploreCommentMediaFilter;
  q?: string;
  limit: number;
  cursor?: string;
}

export interface ListAdminExploreCommentsPage {
  items: AdminExploreCommentItem[];
  next_cursor: string | null;
  has_more: boolean;
}

const RICH_IMAGE_TABLES = {
  place: {
    comments: placeComments,
    parent: places,
    fk: placeComments.placeId,
    parentName: places.name,
    parentSlug: places.slug,
    entityType: 'place_comment',
  },
  culinary: {
    comments: cuisineComments,
    parent: cuisines,
    fk: cuisineComments.cuisineId,
    parentName: cuisines.name,
    parentSlug: cuisines.slug,
    entityType: 'cuisine_comment',
  },
  usaha: {
    comments: usahaComments,
    parent: usahas,
    fk: usahaComments.usahaId,
    parentName: usahas.name,
    parentSlug: usahas.slug,
    entityType: 'usaha_comment',
  },
  event: {
    comments: eventComments,
    parent: events,
    fk: eventComments.eventId,
    parentName: events.name,
    parentSlug: events.slug,
    entityType: 'event_comment',
  },
  karya: {
    comments: karyaComments,
    parent: karyas,
    fk: karyaComments.karyaId,
    parentName: karyas.title,
    parentSlug: karyas.slug,
    entityType: 'karya_comment',
  },
} as const;

type RichImageModule = keyof typeof RICH_IMAGE_TABLES;

function parseWarnings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w): w is string => typeof w === 'string');
  } catch {
    return [];
  }
}

function normalizeWarnings(raw: string[] | null | undefined): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ValidationError([
      { field: 'content_warnings', message: 'content_warnings harus berupa array' },
    ]);
  }
  const out: string[] = [];
  for (const w of raw) {
    if (typeof w !== 'string' || !IMAGE_CONTENT_WARNING_SET.has(w)) {
      throw new ValidationError([
        { field: 'content_warnings', message: 'Nilai content_warnings tidak dikenal' },
      ]);
    }
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new ValidationError([
      { field: 'image', message: 'Gagal mengunduh gambar untuk diproses' },
    ]);
  }
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mimeType: res.headers.get('content-type'),
  };
}

function toIso(d: Date | null | undefined): string | null {
  return d instanceof Date ? d.toISOString() : null;
}

export class AdminExploreCommentService {
  constructor(
    private readonly db: AppDatabase,
    private readonly publicImageStorage: PublicImageStoragePort,
    private readonly imageStorage: ImageStoragePort,
    private readonly auditRepo: AuditLogRepository,
    private readonly abuse?: RecordAbuseSignalUseCase,
  ) {}

  async list(input: ListAdminExploreCommentsInput): Promise<ListAdminExploreCommentsPage> {
    if (input.module === 'encyclopedia') {
      return this.listEncyclopedia(input);
    }
    return this.listRichModule(input.module, input);
  }

  private async listRichModule(
    mod: RichImageModule,
    input: ListAdminExploreCommentsInput,
  ): Promise<ListAdminExploreCommentsPage> {
    const cfg = RICH_IMAGE_TABLES[mod];
    const c = cfg.comments;
    const p = cfg.parent;

    const conditions = [isNull(c.deletedAt)];
    if (input.status) {
      conditions.push(eq(c.status, input.status));
    }
    if (input.cursor) {
      conditions.push(lt(c.id, input.cursor));
    }
    if (input.hasMedia === 'image') {
      conditions.push(inArray(c.imageStatus, ['pending_review', 'published']));
    } else if (input.hasMedia === 'audio') {
      conditions.push(isNotNull(c.audioUrl));
    } else if (input.hasMedia === 'any') {
      conditions.push(
        or(inArray(c.imageStatus, ['pending_review', 'published']), isNotNull(c.audioUrl))!,
      );
    }
    const q = input.q?.trim();
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(like(c.body, pattern), like(cfg.parentName, pattern))!);
    }

    const rows = await this.db
      .select({
        id: c.id,
        targetId: cfg.fk,
        targetName: cfg.parentName,
        targetSlug: cfg.parentSlug,
        userId: c.userId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorDeletedAt: users.deletedAt,
        body: c.body,
        bodyOriginal: c.bodyOriginal,
        status: c.status,
        audioUrl: c.audioUrl,
        audioMimeType: c.audioMimeType,
        audioDurationMs: c.audioDurationMs,
        imageStatus: c.imageStatus,
        imageUrl: c.imageUrl,
        imagePublicUrl: c.imagePublicUrl,
        imageContentWarnings: c.imageContentWarnings,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })
      .from(c)
      .innerJoin(p, eq(cfg.fk, p.id))
      .leftJoin(users, eq(c.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(c.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const slice = hasMore ? rows.slice(0, input.limit) : rows;

    const items: AdminExploreCommentItem[] = slice.map((r) => {
      const imgStatus =
        r.imageStatus === 'pending_review' ||
        r.imageStatus === 'published' ||
        r.imageStatus === 'rejected'
          ? r.imageStatus
          : null;
      return {
        id: r.id,
        module: mod,
        target_id: r.targetId,
        target_name: r.targetName,
        target_slug: r.targetSlug,
        user_id: r.userId,
        author_username: publicAccountName(r.authorUsername, r.authorDeletedAt),
        author_display_name: publicAccountDisplayName(
          r.authorDisplayName,
          r.authorUsername,
          r.authorDeletedAt,
        ),
        body: r.body,
        body_original: r.bodyOriginal ?? null,
        is_censored: r.bodyOriginal != null,
        status: r.status as ExploreCommentStatus,
        audio_url: r.audioUrl ?? null,
        audio_mime_type: r.audioMimeType ?? null,
        audio_duration_ms: r.audioDurationMs ?? null,
        image: imgStatus
          ? {
              status: imgStatus,
              url: r.imageUrl ?? null,
              public_url: r.imagePublicUrl ?? r.imageUrl ?? null,
              content_warnings: parseWarnings(r.imageContentWarnings),
            }
          : null,
        created_at: r.createdAt.toISOString(),
        updated_at: toIso(r.updatedAt),
      };
    });

    return {
      items,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      has_more: hasMore,
    };
  }

  private async listEncyclopedia(
    input: ListAdminExploreCommentsInput,
  ): Promise<ListAdminExploreCommentsPage> {
    const conditions = [isNull(articleComments.deletedAt)];
    if (input.status) {
      conditions.push(eq(articleComments.status, input.status));
    }
    if (input.cursor) {
      conditions.push(lt(articleComments.id, input.cursor));
    }
    if (input.hasMedia === 'image') {
      conditions.push(isNotNull(articleComments.imageUrl));
    } else if (input.hasMedia === 'audio') {
      conditions.push(isNotNull(articleComments.audioUrl));
    } else if (input.hasMedia === 'any') {
      conditions.push(
        or(isNotNull(articleComments.imageUrl), isNotNull(articleComments.audioUrl))!,
      );
    }
    const q = input.q?.trim();
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(like(articleComments.body, pattern), like(articles.title, pattern))!);
    }

    const rows = await this.db
      .select({
        id: articleComments.id,
        targetId: articleComments.articleId,
        targetName: articles.title,
        targetSlug: articles.slug,
        userId: articleComments.userId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorDeletedAt: users.deletedAt,
        body: articleComments.body,
        bodyOriginal: articleComments.bodyOriginal,
        status: articleComments.status,
        audioUrl: articleComments.audioUrl,
        audioMimeType: articleComments.audioMimeType,
        audioDurationMs: articleComments.audioDurationMs,
        imageUrl: articleComments.imageUrl,
        createdAt: articleComments.createdAt,
        updatedAt: articleComments.updatedAt,
      })
      .from(articleComments)
      .innerJoin(articles, eq(articleComments.articleId, articles.id))
      .leftJoin(users, eq(articleComments.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(articleComments.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const slice = hasMore ? rows.slice(0, input.limit) : rows;

    const items: AdminExploreCommentItem[] = slice.map((r) => ({
      id: r.id,
      module: 'encyclopedia',
      target_id: r.targetId,
      target_name: r.targetName,
      target_slug: r.targetSlug,
      user_id: r.userId,
      author_username: publicAccountName(r.authorUsername, r.authorDeletedAt),
      author_display_name: publicAccountDisplayName(
        r.authorDisplayName,
        r.authorUsername,
        r.authorDeletedAt,
      ),
      body: r.body,
      body_original: r.bodyOriginal ?? null,
      is_censored: r.bodyOriginal != null,
      status: r.status as ExploreCommentStatus,
      audio_url: r.audioUrl ?? null,
      audio_mime_type: r.audioMimeType ?? null,
      audio_duration_ms: r.audioDurationMs ?? null,
      image: r.imageUrl
        ? {
            status: 'published',
            url: r.imageUrl,
            public_url: r.imageUrl,
            content_warnings: [],
          }
        : null,
      created_at: r.createdAt.toISOString(),
      updated_at: toIso(r.updatedAt),
    }));

    return {
      items,
      next_cursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
      has_more: hasMore,
    };
  }

  async takedown(input: {
    module: ExploreCommentModule;
    commentId: string;
    actorId: string;
    requestId?: string | null;
  }): Promise<{ id: string; status: 'taken_down' }> {
    const table =
      input.module === 'encyclopedia'
        ? articleComments
        : RICH_IMAGE_TABLES[input.module].comments;
    const entityType =
      input.module === 'encyclopedia'
        ? 'article_comment'
        : RICH_IMAGE_TABLES[input.module].entityType;

    const [existing] = await this.db
      .select({ id: table.id, userId: table.userId, status: table.status })
      .from(table)
      .where(and(eq(table.id, input.commentId), isNull(table.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (existing.status !== 'published') {
      throw new ConflictError(
        'COMMENT_NOT_PUBLISHED',
        'Komentar sudah di-takedown atau tidak lagi diterbitkan',
      );
    }

    const now = new Date();
    const updated = await this.db
      .update(table)
      .set({
        status: 'taken_down',
        reviewedBy: input.actorId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(table.id, input.commentId), eq(table.status, 'published'), isNull(table.deletedAt)),
      )
      .returning({ id: table.id });

    if (updated.length === 0) {
      throw new ConflictError(
        'COMMENT_NOT_PUBLISHED',
        'Komentar sudah di-takedown atau tidak lagi diterbitkan',
      );
    }

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'takedown',
      entityType,
      entityId: input.commentId,
      oldData: { status: existing.status },
      newData: { status: 'taken_down' },
      requestId: input.requestId ?? null,
    });

    await safeRecordAbuseSignal(this.abuse, {
      userId: existing.userId,
      signal: 'comment_takedown',
      entityType,
      entityId: input.commentId,
      requestId: input.requestId,
    });

    return { id: input.commentId, status: 'taken_down' };
  }

  async censorImage(input: {
    module: ExploreCommentModule;
    commentId: string;
    actorId: string;
    censoredBytes?: Uint8Array | null;
    censoredMimeType?: string | null;
    contentWarnings?: string[] | null;
    requestId?: string | null;
  }): Promise<{ id: string; image_public_url: string; content_warnings: string[] }> {
    const warnings = normalizeWarnings(input.contentWarnings);

    if (input.module === 'encyclopedia') {
      const [existing] = await this.db
        .select({ id: articleComments.id, imageUrl: articleComments.imageUrl })
        .from(articleComments)
        .where(and(eq(articleComments.id, input.commentId), isNull(articleComments.deletedAt)))
        .limit(1);
      if (!existing) throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      if (!existing.imageUrl) {
        throw new ConflictError('COMMENT_IMAGE_NOT_FOUND', 'Komentar tidak memiliki foto');
      }

      const fileData =
        input.censoredBytes && input.censoredBytes.byteLength > 0
          ? { bytes: input.censoredBytes, mimeType: input.censoredMimeType ?? null }
          : await fetchImageBytes(existing.imageUrl);
      const file = validateImageFile(fileData);
      const uploaded = await this.publicImageStorage.upload({
        path: buildCommentImagePath(file.mimeType),
        content: file.bytes,
        mimeType: file.mimeType,
      });

      const now = new Date();
      await this.db
        .update(articleComments)
        .set({
          imageUrl: uploaded.url,
          reviewedBy: input.actorId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(articleComments.id, input.commentId));

      await this.auditRepo.record({
        userId: input.actorId,
        action: 'update',
        entityType: 'article_comment',
        entityId: input.commentId,
        oldData: { image_url: existing.imageUrl },
        newData: { image_url: uploaded.url, content_warnings: warnings },
        requestId: input.requestId ?? null,
      });

      return { id: input.commentId, image_public_url: uploaded.url, content_warnings: warnings };
    }

    const cfg = RICH_IMAGE_TABLES[input.module];
    const c = cfg.comments;
    const [existing] = await this.db
      .select({
        id: c.id,
        imageStatus: c.imageStatus,
        imageUrl: c.imageUrl,
        imagePublicUrl: c.imagePublicUrl,
        imageProvider: c.imageProvider,
        imageProviderFileId: c.imageProviderFileId,
      })
      .from(c)
      .where(and(eq(c.id, input.commentId), isNull(c.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (
      !existing.imageStatus ||
      (existing.imageStatus !== 'pending_review' && existing.imageStatus !== 'published')
    ) {
      throw new ConflictError(
        'COMMENT_IMAGE_NOT_MODERATABLE',
        'Foto komentar tidak tersedia untuk disensor',
      );
    }

    const sourceUrl = existing.imagePublicUrl ?? existing.imageUrl;
    if (!sourceUrl && !(input.censoredBytes && input.censoredBytes.byteLength > 0)) {
      throw new ConflictError('COMMENT_IMAGE_NOT_FOUND', 'URL foto komentar tidak tersedia');
    }

    const fileData =
      input.censoredBytes && input.censoredBytes.byteLength > 0
        ? { bytes: input.censoredBytes, mimeType: input.censoredMimeType ?? null }
        : await fetchImageBytes(sourceUrl!);
    const file = validateImageFile(fileData);
    const uploaded = await this.publicImageStorage.upload({
      path: buildCommentImagePath(file.mimeType),
      content: file.bytes,
      mimeType: file.mimeType,
    });

    const now = new Date();
    await this.db
      .update(c)
      .set({
        imageUrl: uploaded.url,
        imageProvider: this.publicImageStorage.providerName,
        imageProviderFileId: uploaded.path,
        imagePublicUrl: uploaded.url,
        imageStatus: 'published',
        imageContentWarnings: JSON.stringify(warnings),
        imageReviewedBy: input.actorId,
        imageReviewedAt: now,
        updatedAt: now,
      })
      .where(eq(c.id, input.commentId));

    if (existing.imageProvider === 'imagekit' && existing.imageProviderFileId) {
      await this.imageStorage.deleteFile(existing.imageProviderFileId);
    }

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'update',
      entityType: cfg.entityType,
      entityId: input.commentId,
      oldData: { image_status: existing.imageStatus },
      newData: {
        image_status: 'published',
        image_public_url: uploaded.url,
        content_warnings: warnings,
      },
      requestId: input.requestId ?? null,
    });

    return { id: input.commentId, image_public_url: uploaded.url, content_warnings: warnings };
  }

  async rejectImage(input: {
    module: ExploreCommentModule;
    commentId: string;
    actorId: string;
    abusive?: boolean;
    requestId?: string | null;
  }): Promise<{ id: string; image_status: 'rejected' }> {
    if (input.module === 'encyclopedia') {
      const [existing] = await this.db
        .select({
          id: articleComments.id,
          userId: articleComments.userId,
          imageUrl: articleComments.imageUrl,
        })
        .from(articleComments)
        .where(and(eq(articleComments.id, input.commentId), isNull(articleComments.deletedAt)))
        .limit(1);
      if (!existing) throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
      if (!existing.imageUrl) {
        throw new ConflictError('COMMENT_IMAGE_NOT_FOUND', 'Komentar tidak memiliki foto');
      }

      const now = new Date();
      await this.db
        .update(articleComments)
        .set({
          imageUrl: null,
          reviewedBy: input.actorId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(articleComments.id, input.commentId));

      await this.auditRepo.record({
        userId: input.actorId,
        action: 'update',
        entityType: 'article_comment',
        entityId: input.commentId,
        oldData: { image_url: existing.imageUrl },
        newData: { image_url: null, abusive: input.abusive === true },
        requestId: input.requestId ?? null,
      });

      if (input.abusive) {
        await safeRecordAbuseSignal(this.abuse, {
          userId: existing.userId,
          signal: 'comment_takedown',
          entityType: 'article_comment',
          entityId: input.commentId,
          requestId: input.requestId,
        });
      }

      return { id: input.commentId, image_status: 'rejected' };
    }

    const cfg = RICH_IMAGE_TABLES[input.module];
    const c = cfg.comments;
    const [existing] = await this.db
      .select({
        id: c.id,
        userId: c.userId,
        imageStatus: c.imageStatus,
        imageProvider: c.imageProvider,
        imageProviderFileId: c.imageProviderFileId,
      })
      .from(c)
      .where(and(eq(c.id, input.commentId), isNull(c.deletedAt)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('COMMENT_NOT_FOUND', 'Komentar tidak ditemukan');
    }
    if (
      !existing.imageStatus ||
      (existing.imageStatus !== 'pending_review' && existing.imageStatus !== 'published')
    ) {
      throw new ConflictError(
        'COMMENT_IMAGE_NOT_MODERATABLE',
        'Foto komentar tidak tersedia untuk diturunkan',
      );
    }

    const now = new Date();
    await this.db
      .update(c)
      .set({
        imageUrl: null,
        imageProvider: null,
        imageProviderFileId: null,
        imagePublicUrl: null,
        imageStatus: 'rejected',
        imageContentWarnings: '[]',
        imageReviewedBy: input.actorId,
        imageReviewedAt: now,
        updatedAt: now,
      })
      .where(eq(c.id, input.commentId));

    if (existing.imageProvider === 'imagekit' && existing.imageProviderFileId) {
      await this.imageStorage.deleteFile(existing.imageProviderFileId);
    }

    await this.auditRepo.record({
      userId: input.actorId,
      action: 'update',
      entityType: cfg.entityType,
      entityId: input.commentId,
      oldData: { image_status: existing.imageStatus },
      newData: { image_status: 'rejected', abusive: input.abusive === true },
      requestId: input.requestId ?? null,
    });

    if (input.abusive) {
      await safeRecordAbuseSignal(this.abuse, {
        userId: existing.userId,
        signal: 'comment_takedown',
        entityType: cfg.entityType,
        entityId: input.commentId,
        requestId: input.requestId,
      });
    }

    return { id: input.commentId, image_status: 'rejected' };
  }
}

export { sql };
