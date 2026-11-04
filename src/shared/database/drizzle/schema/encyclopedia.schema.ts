import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { generateId } from '@/shared/utils/ulid';
import { users } from './users.schema';

/** Katalog kategori ensiklopedia (sejarah, tokoh, budaya, ...). SoT Turso. */
export const encyclopediaCategories = sqliteTable(
  'encyclopedia_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status', {
      enum: ['draft', 'published', 'archived'],
    })
      .notNull()
      .default('published'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('encyclopedia_categories_status_idx').on(t.status),
    index('encyclopedia_categories_sort_idx').on(t.sortOrder),
  ],
);

/** Tag bebas, dibuat on-the-fly saat simpan artikel (slug normalisasi unik). */
export const encyclopediaTags = sqliteTable(
  'encyclopedia_tags',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('encyclopedia_tags_slug_uidx').on(t.slug),
    index('encyclopedia_tags_name_idx').on(t.name),
  ],
);

export const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/** Artikel ensiklopedia (markdown). SoT Turso, CRUD console + usulan user. */
export const articles = sqliteTable(
  'articles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    /** Isi artikel markdown (render di klien, tanpa HTML mentah). */
    bodyMd: text('body_md').notNull(),
    /** body_md dilucuti markdown (app-side) untuk FTS. */
    bodyText: text('body_text').notNull().default(''),
    coverUrl: text('cover_url'),
    categoryId: text('category_id')
      .notNull()
      .references(() => encyclopediaCategories.id),
    /** Link original konten - disimpan bersih, UTM disisip saat render. */
    sourceUrl: text('source_url'),
    /** Referensi/sumber tambahan dalam markdown (opsional). */
    referencesMd: text('references_md'),
    /** Wajib login: penulis selalu user terdaftar (beda dari event anonim). */
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: ARTICLE_STATUSES })
      .notNull()
      .default('draft'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    uniqueIndex('articles_slug_uidx').on(t.slug),
    index('articles_category_idx').on(t.categoryId),
    index('articles_status_idx').on(t.status),
    index('articles_status_published_idx').on(t.status, t.publishedAt),
    index('articles_author_idx').on(t.authorUserId),
  ],
);

/** Relasi banyak-ke-banyak artikel <-> tag. */
export const articleTags = sqliteTable(
  'article_tags',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => encyclopediaTags.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('article_tags_article_idx').on(t.articleId),
    index('article_tags_tag_idx').on(t.tagId),
  ],
);

export const ARTICLE_CONTRIBUTION_KINDS = ['new', 'edit'] as const;
export type ArticleContributionKind =
  (typeof ARTICLE_CONTRIBUTION_KINDS)[number];

export const ARTICLE_CONTRIBUTION_STATUSES = [
  'pending',
  'needs_revision',
  'approved',
  'rejected',
] as const;
export type ArticleContributionStatus =
  (typeof ARTICLE_CONTRIBUTION_STATUSES)[number];

/**
 * Usulan artikel dari user (wajib login). kind=new = artikel baru,
 * kind=edit = usulan perubahan artikel existing (articleId wajib).
 * Payload versi lengkap yang diusulkan, disimpan utuh apa adanya.
 */
export const articleContributions = sqliteTable(
  'article_contributions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind', { enum: ARTICLE_CONTRIBUTION_KINDS }).notNull(),
    /** Target artikel. Null hanya untuk kind=new. */
    articleId: text('article_id').references(() => articles.id),
    payloadJson: text('payload_json').notNull(),
    /** Stale check: updatedAt artikel saat usulan dibuat (kind=edit). */
    baseUpdatedAt: integer('base_updated_at', { mode: 'timestamp' }),
    status: text('status', { enum: ARTICLE_CONTRIBUTION_STATUSES })
      .notNull()
      .default('pending'),
    /** Artikel resmi hasil approval (kind=new). */
    resultArticleId: text('result_article_id'),
    revisionNote: text('revision_note'),
    rejectReasonCode: text('reject_reason_code'),
    rejectReasonText: text('reject_reason_text'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('article_contributions_user_status_idx').on(t.userId, t.status),
    index('article_contributions_status_created_idx').on(t.status, t.createdAt),
    index('article_contributions_article_idx').on(t.articleId, t.status),
    // Field-lock sederhana: satu usulan edit aktif per artikel per user.
    uniqueIndex('article_contributions_active_edit_uidx')
      .on(t.articleId, t.userId)
      .where(sql`${t.kind} = 'edit' and ${t.status} in ('pending','needs_revision')`),
  ],
);

/**
 * Snapshot artikel SEBELUM setiap perubahan oleh admin (edit langsung
 * atau approve usulan). Admin-only, tidak diekspos publik. Pola
 * comment_revisions (0108). Restore versi lama juga menulis revisi baru.
 */
export const articleRevisions = sqliteTable(
  'article_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    editorId: text('editor_id')
      .notNull()
      .references(() => users.id),
    /** Asal revisi: usulan yang di-approve (null = edit langsung admin). */
    contributionId: text('contribution_id'),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    bodyMd: text('body_md').notNull(),
    categoryId: text('category_id').notNull(),
    /** JSON array slug tag saat snapshot. */
    tagsJson: text('tags_json').notNull().default('[]'),
    changeNote: text('change_note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('article_revisions_article_created_idx').on(t.articleId, t.createdAt),
  ],
);

export const ARTICLE_COMMENT_STATUSES = [
  'published',
  'taken_down',
  'deleted_by_author',
] as const;
export type ArticleCommentStatus =
  (typeof ARTICLE_COMMENT_STATUSES)[number];

/**
 * Komentar artikel. Post-moderation seperti `comments` (kata):
 * create -> published; admin takedown; penulis hapus sendiri.
 * Body disensor blocklist saat create/edit; body_original menyimpan
 * teks sebelum disensor.
 */
export const articleComments = sqliteTable(
  'article_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    /** Teks asli sebelum blocklist; null jika tidak disensor. */
    bodyOriginal: text('body_original'),
    imageUrl: text('image_url'),
    status: text('status', { enum: ARTICLE_COMMENT_STATUSES })
      .notNull()
      .default('published'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('article_comments_article_status_idx').on(t.articleId, t.status, t.id),
    index('article_comments_user_status_idx').on(t.userId, t.status, t.id),
  ],
);

/** Snapshot body komentar tayang sebelum setiap edit (cap 50 di use case). */
export const articleCommentRevisions = sqliteTable(
  'article_comment_revisions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    commentId: text('comment_id')
      .notNull()
      .references(() => articleComments.id, { onDelete: 'cascade' }),
    editorId: text('editor_id')
      .notNull()
      .references(() => users.id),
    /** Body yang ditampilkan sebelum diganti (pasca-blocklist). */
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('article_comment_revisions_comment_idx').on(t.commentId, t.createdAt),
  ],
);

/** Bookmark artikel per user (toggle; hard-delete saat batal). */
export const articleBookmarks = sqliteTable(
  'article_bookmarks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('article_bookmarks_user_article_uidx').on(t.userId, t.articleId),
    index('article_bookmarks_user_idx').on(t.userId, t.id),
  ],
);

export const ARTICLE_REPORT_TARGETS = ['article', 'article_comment'] as const;
export type ArticleReportTarget = (typeof ARTICLE_REPORT_TARGETS)[number];

export const ARTICLE_REPORT_REASONS = [
  'inappropriate',
  'sexual',
  'harassment',
  'hate_speech',
  'misinformation',
  'spam',
  'other',
] as const;
export type ArticleReportReason = (typeof ARTICLE_REPORT_REASONS)[number];

/**
 * Laporan pengguna atas artikel/komentar (pola pantun_reports).
 * Laporan tidak otomatis mengubah konten - admin memutuskan.
 */
export const articleReports = sqliteTable(
  'article_reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => generateId()),
    targetType: text('target_type', {
      enum: ARTICLE_REPORT_TARGETS,
    }).notNull(),
    targetId: text('target_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    reasonCode: text('reason_code', {
      enum: ARTICLE_REPORT_REASONS,
    }).notNull(),
    note: text('note'),
    status: text('status', {
      enum: ['open', 'resolved', 'dismissed'],
    })
      .notNull()
      .default('open'),
    resolution: text('resolution', {
      enum: ['dismissed', 'taken_down'],
    }),
    resolutionNote: text('resolution_note'),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (t) => [
    index('article_reports_status_id_idx').on(t.status, t.id),
    index('article_reports_target_idx').on(t.targetType, t.targetId, t.status),
    uniqueIndex('article_reports_open_user_uidx')
      .on(t.targetType, t.targetId, t.userId)
      .where(sql`${t.status} = 'open'`),
  ],
);
