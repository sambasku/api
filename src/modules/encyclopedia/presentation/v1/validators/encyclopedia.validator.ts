import { z } from 'zod';
import { opaqueId } from '@/shared/validation/id';
import {
  ARTICLE_REPORT_REASONS,
  ARTICLE_REPORT_TARGETS,
} from '@/shared/database/drizzle/schema/encyclopedia.schema';

/** Kategori artikel = slug katalog `encyclopedia_categories` (bukan ULID). */
const categoryIdSchema = z
  .string({ error: 'Kategori artikel wajib dipilih' })
  .trim()
  .min(1, 'Kategori artikel wajib dipilih')
  .max(64, 'Kategori artikel tidak valid')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Kategori artikel tidak valid');

/** Tag: slug lowercase-hyphen, maks 40 karakter, maks 8 per artikel. */
const tagSchema = z
  .string({ error: 'Tag tidak valid' })
  .trim()
  .min(1, 'Tag tidak valid')
  .max(40, 'Tag maksimal 40 karakter')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Tag hanya huruf kecil, angka, hyphen');

const tagsSchema = z
  .array(tagSchema)
  .max(8, 'Tag maksimal 8 per artikel')
  .default([]);

const BODY_MD_MAX = 50_000;

/** Field artikel yang dipakai create admin & usulan (bentuk snake_case wire). */
const articlePayloadFields = {
  title: z
    .string({ error: 'Judul artikel wajib diisi' })
    .trim()
    .min(3, 'Judul minimal 3 karakter')
    .max(200, 'Judul maksimal 200 karakter'),
  excerpt: z
    .string({ error: 'Ringkasan tidak valid' })
    .trim()
    .max(300, 'Ringkasan maksimal 300 karakter')
    .default(''),
  body_md: z
    .string({ error: 'Isi artikel wajib diisi' })
    .trim()
    .min(1, 'Isi artikel wajib diisi')
    .max(BODY_MD_MAX, 'Isi artikel terlalu panjang (maks 50.000 karakter)'),
  category_id: categoryIdSchema,
  tags: tagsSchema,
  cover_url: z.string().url().startsWith('https://').nullable().optional(),
  source_url: z.string().url().startsWith('https://').nullable().optional(),
  references_md: z
    .string()
    .max(10_000, 'Referensi maksimal 10.000 karakter')
    .nullable()
    .optional(),
};

export const submitContributionBodySchema = z.object({
  kind: z.enum(['new', 'edit'], { error: 'Jenis usulan tidak valid' }),
  // Id ULID atau slug publik (klien suntingan sering kirim slug dari URL).
  article_id: z
    .string()
    .trim()
    .min(1, 'Artikel wajib dipilih')
    .max(120, 'Artikel tidak valid')
    .nullable()
    .optional(),
  ...articlePayloadFields,
});

export type SubmitContributionBody = z.infer<typeof submitContributionBodySchema>;

export const resubmitContributionBodySchema = z.object({
  ...articlePayloadFields,
});

export const adminCreateArticleBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya huruf kecil, angka, hyphen')
    .optional(),
  ...articlePayloadFields,
  status: z.enum(['draft', 'published']).default('draft'),
});

export const adminUpdateArticleBodySchema = z.object({
  ...articlePayloadFields,
  status: z.enum(['draft', 'published', 'archived']).optional(),
  change_note: z.string().trim().max(300).nullable().optional(),
});

export const listArticlesQuerySchema = z.object({
  category_id: categoryIdSchema.optional(),
  /** Slug tag, boleh berulang (`?tag=sejarah&tag=budaya`) atau dipisah koma. */
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const list = Array.isArray(value) ? value : value.split(',');
      return list.map((t) => t.trim()).filter(Boolean);
    }),
  q: z.string().trim().max(100, 'Kata kunci maksimal 100 karakter').optional(),
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;

export const searchArticlesQuerySchema = z.object({
  q: z
    .string({ error: 'Kata kunci pencarian wajib diisi' })
    .trim()
    .min(1, 'Kata kunci pencarian wajib diisi')
    .max(100, 'Kata kunci maksimal 100 karakter'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchArticlesQuery = z.infer<typeof searchArticlesQuerySchema>;

export const articleSlugParamSchema = z.object({
  slug: z
    .string({ error: 'Artikel tidak valid' })
    .trim()
    .min(1, 'Artikel tidak valid')
    .max(120, 'Artikel tidak valid'),
});

export const articleIdParamSchema = z.object({ id: opaqueId });
export const categoryIdParamSchema = z.object({ id: categoryIdSchema });
export const tagIdParamSchema = z.object({ id: opaqueId });
export const contributionIdParamSchema = z.object({ id: opaqueId });
export const reportIdParamSchema = z.object({ id: opaqueId });
export const revisionIdParamSchema = z.object({
  id: opaqueId,
  revisionId: opaqueId,
});

export const listTagsQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const renameTagBodySchema = z.object({
  name: z.string().trim().min(1, 'Nama tag wajib diisi').max(60, 'Nama tag maksimal 60 karakter'),
});

export const mergeTagBodySchema = z.object({
  from_tag_id: opaqueId,
  into_tag_id: opaqueId,
});

export const createCategoryBodySchema = z.object({
  id: categoryIdSchema,
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(80),
  sort_order: z.coerce.number().int().min(0).max(9999).default(100),
});

export const updateCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
});

export const commentIdParamSchema = z.object({ id: opaqueId });
export const articleCommentsQuerySchema = z.object({
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createCommentBodySchema = z.object({
  body: z
    .string({ error: 'Komentar wajib diisi' })
    .trim()
    .min(1, 'Komentar wajib diisi')
    .max(1000, 'Komentar maksimal 1000 karakter'),
  image_url: z.string().url().startsWith('https://').nullable().optional(),
});

export const updateCommentBodySchema = z.object({
  body: z
    .string({ error: 'Komentar wajib diisi' })
    .trim()
    .min(1, 'Komentar wajib diisi')
    .max(1000, 'Komentar maksimal 1000 karakter'),
});

export const submitReportBodySchema = z.object({
  target_type: z.enum(ARTICLE_REPORT_TARGETS, { error: 'Target laporan tidak valid' }),
  target_id: opaqueId,
  reason_code: z.enum(ARTICLE_REPORT_REASONS, { error: 'Alasan laporan tidak valid' }),
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').nullable().optional(),
});

export const listReportsQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'dismissed']).optional(),
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const resolveReportBodySchema = z.object({
  resolution: z.enum(['dismissed', 'taken_down'], {
    error: 'Keputusan laporan tidak valid',
  }),
  note: z.string().trim().max(500).nullable().optional(),
});

export const reviewContributionBodySchema = z.object({
  decision: z.enum(['approve', 'needs_revision', 'reject'], {
    error: 'Keputusan tidak valid',
  }),
  revision_note: z.string().trim().max(500).nullable().optional(),
  reject_reason_code: z.string().trim().max(60).nullable().optional(),
  reject_reason_text: z.string().trim().max(500).nullable().optional(),
});

export const listAdminArticlesQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category_id: categoryIdSchema.optional(),
  q: z.string().trim().max(100).optional(),
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listAdminContributionsQuerySchema = z.object({
  status: z.enum(['pending', 'needs_revision', 'approved', 'rejected']).optional(),
  cursor: opaqueId.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
