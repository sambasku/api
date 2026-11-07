import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { EncyclopediaController } from './encyclopedia.controller';
import {
  adminCreateArticleBodySchema,
  adminUpdateArticleBodySchema,
  articleCommentsQuerySchema,
  articleIdParamSchema,
  articleSlugParamSchema,
  categoryIdParamSchema,
  commentIdParamSchema,
  contributionIdParamSchema,
  createCategoryBodySchema,
  createCommentBodySchema,
  listAdminArticlesQuerySchema,
  listAdminContributionsQuerySchema,
  listArticlesQuerySchema,
  listReportsQuerySchema,
  listTagsQuerySchema,
  mergeTagBodySchema,
  renameTagBodySchema,
  reportIdParamSchema,
  resubmitContributionBodySchema,
  resolveReportBodySchema,
  reviewContributionBodySchema,
  revisionIdParamSchema,
  searchArticlesQuerySchema,
  submitContributionBodySchema,
  submitReportBodySchema,
  tagIdParamSchema,
  updateCategoryBodySchema,
  updateCommentBodySchema,
} from './validators/encyclopedia.validator';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const ok = z.object({ success: z.literal(true), data: z.unknown() });
const okResponse = (description: string) => ({
  description,
  content: json(ok),
});

function userKey(prefix: string) {
  return (c: { get: (k: 'user') => AuthUser | undefined }) => {
    const user = c.get('user');
    return user ? `${prefix}:user:${user.user_id}` : '';
  };
}

export interface EncyclopediaRoutesDeps {
  controller: EncyclopediaController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
  optionalAuthenticate?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireApprovedClient?: MiddlewareHandler<{ Variables: AppVariables }>;
  requireLegalConsent?: MiddlewareHandler<{ Variables: AppVariables }>;
}

/**
 * Rute ensiklopedia publik + user. Di-mount di `/api/v1/encyclopedia`.
 * Literal (`/search`, `/categories`, `/tags`, `/contributions`, `/reports`)
 * didaftarkan SEBELUM `/:slug` supaya menang atas param.
 */
export function createEncyclopediaRoutes(deps: EncyclopediaRoutesDeps) {
  const routes = createOpenApiApp();
  const consent = deps.requireLegalConsent ? [deps.requireLegalConsent] : [];
  const client = deps.requireApprovedClient ? [deps.requireApprovedClient] : [];

  // --- baca publik (tanpa auth); detail pakai optional auth utk bookmarked ---
  const publicRead = [rateLimit({ points: 300, duration: 60 })] as const;
  routes.use('/articles', ...publicRead);
  routes.use('/articles/search', ...publicRead);
  if (deps.optionalAuthenticate) {
    routes.use('/articles/:slug', deps.optionalAuthenticate);
  }
  routes.use('/articles/:slug', ...publicRead);
  routes.use('/categories', ...publicRead);
  routes.use('/tags', ...publicRead);
  routes.use('/articles/:id/comments', ...publicRead);

  // --- tulis butuh login + consent + rate limit per user ---
  const writeBase = [deps.authenticate, ...consent, ...client] as const;
  routes.use(
    '/contributions',
    ...writeBase,
    rateLimit({ points: 3, duration: 3600, keyFn: userKey('article-contrib') }),
  );
  routes.use(
    '/contributions/:id',
    ...writeBase,
    rateLimit({ points: 10, duration: 3600, keyFn: userKey('article-contrib') }),
  );
  routes.use(
    '/articles/:id/comments',
    deps.authenticate,
    ...consent,
    ...client,
    rateLimit({ points: 30, duration: 3600, keyFn: userKey('article-comment') }),
  );
  routes.use(
    '/comments/:id',
    deps.authenticate,
    ...consent,
    ...client,
    rateLimit({ points: 30, duration: 3600, keyFn: userKey('article-comment') }),
  );
  routes.use(
    '/articles/:id/bookmark',
    deps.authenticate,
    rateLimit({ points: 120, duration: 3600, keyFn: userKey('article-bookmark') }),
  );
  routes.use(
    '/reports',
    deps.authenticate,
    ...consent,
    rateLimit({ points: 10, duration: 3600, keyFn: userKey('article-report') }),
  );
  routes.use(
    '/me/contributions',
    deps.authenticate,
    rateLimit({ points: 120, duration: 60, keyFn: userKey('article-contrib-me') }),
  );

  const specs = [
    createRoute({
      method: 'get',
      path: '/articles',
      tags: ['Encyclopedia'],
      summary: 'Daftar artikel tayang (filter kategori, tag, pencarian)',
      request: { query: listArticlesQuerySchema },
      responses: {
        200: okResponse('Daftar artikel'),
        400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'get',
      path: '/articles/search',
      tags: ['Encyclopedia'],
      summary: 'Cari artikel tayang (FTS)',
      request: { query: searchArticlesQuerySchema },
      responses: {
        200: okResponse('Hasil pencarian'),
        400: { description: 'Query tidak valid', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'get',
      path: '/articles/:slug',
      tags: ['Encyclopedia'],
      summary: 'Detail artikel berdasarkan slug',
      request: { params: articleSlugParamSchema },
      responses: {
        200: okResponse('Detail artikel'),
        404: { description: 'Artikel tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'get',
      path: '/categories',
      tags: ['Encyclopedia'],
      summary: 'Katalog kategori ensiklopedia',
      responses: { 200: okResponse('Daftar kategori') },
    }),
    createRoute({
      method: 'get',
      path: '/tags',
      tags: ['Encyclopedia'],
      summary: 'Cari tag (autocomplete)',
      request: { query: listTagsQuerySchema },
      responses: { 200: okResponse('Daftar tag') },
    }),
    createRoute({
      method: 'get',
      path: '/articles/:id/comments',
      tags: ['Encyclopedia', 'Article Comments'],
      summary: 'Komentar tayang satu artikel',
      request: {
        params: articleIdParamSchema,
        query: articleCommentsQuerySchema,
      },
      responses: { 200: okResponse('Daftar komentar') },
    }),
    createRoute({
      method: 'post',
      path: '/articles/:id/comments',
      tags: ['Encyclopedia', 'Article Comments'],
      summary: 'Kirim komentar artikel (login, post-moderation)',
      request: {
        params: articleIdParamSchema,
        body: { content: json(createCommentBodySchema) },
      },
      responses: {
        201: okResponse('Komentar tersimpan'),
        400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
        401: { description: 'Belum login', content: json(errorResponseSchema) },
        404: { description: 'Artikel tidak ditemukan', content: json(errorResponseSchema) },
        429: { description: 'Rate limit', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'patch',
      path: '/comments/:id',
      tags: ['Encyclopedia', 'Article Comments'],
      summary: 'Ubah komentar sendiri (snapshot revisi)',
      request: {
        params: commentIdParamSchema,
        body: { content: json(updateCommentBodySchema) },
      },
      responses: {
        200: okResponse('Komentar diperbarui'),
        403: { description: 'Bukan pemilik komentar', content: json(errorResponseSchema) },
        404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'delete',
      path: '/comments/:id',
      tags: ['Encyclopedia', 'Article Comments'],
      summary: 'Hapus komentar sendiri (soft delete)',
      request: { params: commentIdParamSchema },
      responses: {
        200: okResponse('Komentar dihapus'),
        404: { description: 'Komentar tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'post',
      path: '/articles/:id/bookmark',
      tags: ['Encyclopedia'],
      summary: 'Toggle bookmark artikel',
      request: { params: articleIdParamSchema },
      responses: {
        200: okResponse('Status bookmark'),
        404: { description: 'Artikel tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'post',
      path: '/contributions',
      tags: ['Encyclopedia', 'Encyclopedia Contributions'],
      summary: 'Kirim usulan artikel baru atau perubahan artikel',
      request: { body: { content: json(submitContributionBodySchema) } },
      responses: {
        201: okResponse('Usulan tersimpan'),
        400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
        401: { description: 'Belum login', content: json(errorResponseSchema) },
        409: { description: 'Usulan edit aktif sudah ada', content: json(errorResponseSchema) },
        429: { description: 'Rate limit', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'patch',
      path: '/contributions/:id',
      tags: ['Encyclopedia', 'Encyclopedia Contributions'],
      summary: 'Kirim ulang usulan yang berstatus needs_revision',
      request: {
        params: articleIdParamSchema,
        body: { content: json(resubmitContributionBodySchema) },
      },
      responses: {
        201: okResponse('Usulan dikirim ulang'),
        404: { description: 'Usulan tidak ditemukan', content: json(errorResponseSchema) },
        409: { description: 'Status tidak bisa dikirim ulang', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'get',
      path: '/me/contributions',
      tags: ['Encyclopedia', 'Encyclopedia Contributions'],
      summary: 'Riwayat usulan artikel milik user',
      request: { query: articleCommentsQuerySchema },
      responses: { 200: okResponse('Riwayat usulan') },
    }),
    createRoute({
      method: 'post',
      path: '/reports',
      tags: ['Encyclopedia', 'Encyclopedia Reports'],
      summary: 'Laporkan artikel/komentar',
      request: { body: { content: json(submitReportBodySchema) } },
      responses: {
        201: okResponse('Laporan tersimpan'),
        404: { description: 'Target tidak ditemukan', content: json(errorResponseSchema) },
        409: { description: 'Laporan serupa masih terbuka', content: json(errorResponseSchema) },
        429: { description: 'Rate limit', content: json(errorResponseSchema) },
      },
    }),
  ];

  const handlers: Record<string, (c: never) => unknown> = {
    'get /articles': (c) => deps.controller.list(c),
    'get /articles/search': (c) => deps.controller.search(c),
    'get /articles/:slug': (c) => deps.controller.detail(c),
    'get /categories': (c) => deps.controller.categories(c),
    'get /tags': (c) => deps.controller.tags(c),
    'get /articles/:id/comments': (c) => deps.controller.listComments(c),
    'post /articles/:id/comments': (c) => deps.controller.createComment(c),
    'patch /comments/:id': (c) => deps.controller.updateComment(c),
    'delete /comments/:id': (c) => deps.controller.deleteComment(c),
    'post /articles/:id/bookmark': (c) => deps.controller.toggleBookmark(c),
    'post /contributions': (c) => deps.controller.submitContribution(c),
    'patch /contributions/:id': (c) => deps.controller.resubmitContribution(c),
    'get /me/contributions': (c) => deps.controller.myContributions(c),
    'post /reports': (c) => deps.controller.submitReport(c),
  };

  for (const spec of specs) {
    const handler = handlers[`${spec.method} ${spec.path}`];
    if (handler) {
      routes.openapi(spec as never, handler as never);
    }
  }

  return routes;
}

export interface AdminEncyclopediaRoutesDeps {
  controller: EncyclopediaController;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

/** Panel admin console: artikel, kategori, tag, usulan, laporan. */
export function createAdminEncyclopediaRoutes(deps: AdminEncyclopediaRoutesDeps) {
  const routes = createOpenApiApp();
  const admin = [
    deps.authenticate,
    rateLimit({ points: 500, duration: 60 }),
  ] as const;
  routes.use('/*', ...admin);

  const specs = [
    createRoute({
      method: 'get',
      path: '/articles',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Daftar semua artikel (semua status)',
      request: { query: listAdminArticlesQuerySchema },
      responses: { 200: okResponse('Daftar artikel admin') },
    }),
    createRoute({
      method: 'post',
      path: '/articles',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Buat artikel baru (langsung tayang atau draft)',
      request: { body: { content: json(adminCreateArticleBodySchema) } },
      responses: {
        201: okResponse('Artikel dibuat'),
        400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'patch',
      path: '/articles/:id',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Ubah artikel (menulis snapshot revisi)',
      request: {
        params: articleIdParamSchema,
        body: { content: json(adminUpdateArticleBodySchema) },
      },
      responses: {
        200: okResponse('Artikel diperbarui'),
        404: { description: 'Artikel tidak ditemukan', content: json(errorResponseSchema) },
      },
    }),
    createRoute({
      method: 'delete',
      path: '/articles/:id',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Arsipkan + soft delete artikel',
      request: { params: articleIdParamSchema },
      responses: { 200: okResponse('Artikel dihapus') },
    }),
    createRoute({
      method: 'get',
      path: '/articles/:id/revisions',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Riwayat revisi artikel',
      request: { params: articleIdParamSchema },
      responses: { 200: okResponse('Daftar revisi') },
    }),
    createRoute({
      method: 'post',
      path: '/articles/:id/revisions/:revisionId/restore',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Pulihkan artikel dari versi lama (menulis revisi baru)',
      request: { params: revisionIdParamSchema },
      responses: { 200: okResponse('Artikel dipulihkan') },
    }),
    createRoute({
      method: 'post',
      path: '/categories',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Tambah kategori',
      request: { body: { content: json(createCategoryBodySchema) } },
      responses: { 201: okResponse('Kategori dibuat') },
    }),
    createRoute({
      method: 'patch',
      path: '/categories/:id',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Ubah kategori',
      request: {
        params: categoryIdParamSchema,
        body: { content: json(updateCategoryBodySchema) },
      },
      responses: { 200: okResponse('Kategori diperbarui') },
    }),
    createRoute({
      method: 'patch',
      path: '/tags/:id',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Ganti nama tag',
      request: {
        params: tagIdParamSchema,
        body: { content: json(renameTagBodySchema) },
      },
      responses: { 200: okResponse('Tag diperbarui') },
    }),
    createRoute({
      method: 'post',
      path: '/tags/merge',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Gabungkan dua tag',
      request: { body: { content: json(mergeTagBodySchema) } },
      responses: { 200: okResponse('Tag digabung') },
    }),
    createRoute({
      method: 'get',
      path: '/contributions',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Antrean usulan artikel',
      request: { query: listAdminContributionsQuerySchema },
      responses: { 200: okResponse('Daftar usulan') },
    }),
    createRoute({
      method: 'post',
      path: '/contributions/:id/review',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Setujui / minta revisi / tolak usulan',
      request: {
        params: contributionIdParamSchema,
        body: { content: json(reviewContributionBodySchema) },
      },
      responses: { 200: okResponse('Usulan diproses') },
    }),
    createRoute({
      method: 'get',
      path: '/reports',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Antrean laporan artikel/komentar',
      request: { query: listReportsQuerySchema },
      responses: { 200: okResponse('Daftar laporan') },
    }),
    createRoute({
      method: 'post',
      path: '/reports/:id/resolve',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Abaikan atau takedown konten lalu tutup laporan',
      request: {
        params: reportIdParamSchema,
        body: { content: json(resolveReportBodySchema) },
      },
      responses: { 200: okResponse('Laporan ditutup') },
    }),
    createRoute({
      method: 'post',
      path: '/comments/:id/takedown',
      tags: ['Encyclopedia', 'Admin'],
      summary: 'Tarik komentar artikel',
      request: { params: commentIdParamSchema },
      responses: { 200: okResponse('Komentar ditakedown') },
    }),
  ];

  const handlers: Record<string, (c: never) => unknown> = {
    'get /articles': (c) => deps.controller.adminListArticles(c),
    'post /articles': (c) => deps.controller.adminCreateArticle(c),
    'patch /articles/:id': (c) => deps.controller.adminUpdateArticle(c),
    'delete /articles/:id': (c) => deps.controller.adminDeleteArticle(c),
    'get /articles/:id/revisions': (c) => deps.controller.adminListRevisions(c),
    'post /articles/:id/revisions/:revisionId/restore': (c) =>
      deps.controller.adminRestoreRevision(c),
    'post /categories': (c) => deps.controller.adminCreateCategory(c),
    'patch /categories/:id': (c) => deps.controller.adminUpdateCategory(c),
    'patch /tags/:id': (c) => deps.controller.adminRenameTag(c),
    'post /tags/merge': (c) => deps.controller.adminMergeTag(c),
    'get /contributions': (c) => deps.controller.adminListContributions(c),
    'post /contributions/:id/review': (c) => deps.controller.adminReviewContribution(c),
    'get /reports': (c) => deps.controller.adminListReports(c),
    'post /reports/:id/resolve': (c) => deps.controller.adminResolveReport(c),
    'post /comments/:id/takedown': (c) => deps.controller.takedownComment(c),
  };

  for (const spec of specs) {
    const handler = handlers[`${spec.method} ${spec.path}`];
    if (handler) {
      routes.openapi(spec as never, handler as never);
    }
  }

  return routes;
}
