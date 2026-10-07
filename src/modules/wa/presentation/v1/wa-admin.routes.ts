import type { Context } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { UnauthorizedError, BadRequestError, NotFoundError } from '@/shared/errors/app-error';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { WaTemplateParam } from '../../domain/entities/wa-message.entity';
import type { WaTemplateRepository, WaUsageRepository, WaMessageLogRepository } from '../../domain/repositories/wa-message.repository';
import type { SendWaMessageUseCase } from '../../application/use-cases/send-wa-message.use-case';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const waTemplateParamSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const waTemplateSchema = z.object({
  id: z.string(),
  event_key: z.string(),
  enabled: z.boolean(),
  meta_template_name: z.string(),
  meta_template_language: z.string(),
  body: z.string(),
  params: z.array(waTemplateParamSchema),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
});

const waTemplateListResponseSchema = z.object({ success: z.literal(true), data: z.object({ templates: z.array(waTemplateSchema) }) });
const waTemplateResponseSchema = z.object({ success: z.literal(true), data: z.object({ template: waTemplateSchema }) });

const updateWaTemplateBodySchema = z.object({
  enabled: z.boolean().optional(),
  meta_template_name: z.string().min(1).max(512).optional(),
  meta_template_language: z.string().min(1).max(10).optional(),
  // Meta batasi body template 1024 char.
  body: z.string().min(1).max(1024).optional(),
});

const waUsageSchema = z.object({
  provider: z.string(),
  used_count: z.number().int(),
  limit_count: z.number().int(),
  warn_threshold_percent: z.number().int(),
  percent: z.number(),
  level: z.enum(['ok', 'warn', 'exhausted']),
  period_start: z.string(),
  updated_at: z.string().nullable(),
});

const waUsageResponseSchema = z.object({ success: z.literal(true), data: z.object({ usage: waUsageSchema }) });

const updateWaUsageBodySchema = z.object({
  used_count: z.number().int().min(0).optional(),
  limit_count: z.number().int().min(1).optional(),
  warn_threshold_percent: z.number().int().min(0).max(100).optional(),
});

const waLogSchema = z.object({
  id: z.string(),
  provider: z.string(),
  event_key: z.string(),
  to_phone: z.string(),
  template_name: z.string().nullable(),
  channel: z.string(),
  status: z.string(),
  error_message: z.string().nullable(),
  created_at: z.string(),
});

const waLogListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    logs: z.array(waLogSchema),
    next_cursor: z.string().nullable(),
  }),
});

const listWaLogsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const testSendBodySchema = z.object({
  phone: z.string().regex(/^[1-9]\d{7,14}$/, 'Format internasional tanpa +, contoh: 6281234567890'),
  template_id: z.string().min(1),
});

const testSendResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    sent: z.boolean(),
    reason: z.string().nullable(),
    usage: waUsageSchema.nullable(),
  }),
});

const createWaTemplateBodySchema = z.object({
  event_key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/, 'event_key hanya huruf kecil, angka, underscore'),
  meta_template_name: z.string().trim().min(1).max(512),
  meta_template_language: z.string().trim().min(1).max(10).default('id'),
  body: z.string().min(1).max(1024),
  params: z.array(waTemplateParamSchema).default([]),
  enabled: z.boolean().default(false),
});

export interface WaAdminRoutesDeps {
  templateRepo: WaTemplateRepository;
  usageRepo: WaUsageRepository;
  logRepo: WaMessageLogRepository;
  sendWa: SendWaMessageUseCase;
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}

function serializeUsage(u: {
  provider: string;
  usedCount: number;
  limitCount: number;
  warnThresholdPercent: number;
  periodStart: Date;
  updatedAt: Date | null;
}) {
  const percent = u.limitCount > 0 ? Math.round((u.usedCount / u.limitCount) * 100) : 0;
  const level =
    u.usedCount >= u.limitCount ? 'exhausted' : percent >= u.warnThresholdPercent ? 'warn' : 'ok';
  return {
    provider: u.provider,
    used_count: u.usedCount,
    limit_count: u.limitCount,
    warn_threshold_percent: u.warnThresholdPercent,
    percent,
    level,
    period_start: u.periodStart.toISOString(),
    updated_at: u.updatedAt?.toISOString() ?? null,
  };
}

function serializeTemplate(t: {
  id: string;
  eventKey: string;
  enabled: boolean;
  metaTemplateName: string;
  metaTemplateLanguage: string;
  body: string;
  params: WaTemplateParam[];
  updatedAt: Date | null;
  updatedBy: string | null;
}) {
  return {
    id: t.id,
    event_key: t.eventKey,
    enabled: t.enabled,
    meta_template_name: t.metaTemplateName,
    meta_template_language: t.metaTemplateLanguage,
    body: t.body,
    params: t.params,
    updated_at: t.updatedAt?.toISOString() ?? null,
    updated_by: t.updatedBy,
  };
}

export function createWaAdminRoutes(deps: WaAdminRoutesDeps) {
  const routes = createOpenApiApp();
  const admin = [
    deps.authenticate,
    authorizeRole('admin', 'root'),
    rateLimit({ points: 120, duration: 60 }),
  ] as const;
  // Test-send = kirim WA beneran yang makan quota - limit ketat terpisah
  // dari route baca/tulis template (5/menit cukup untuk eksplorasi).
  const testSendLimit = [
    deps.authenticate,
    authorizeRole('admin', 'root'),
    rateLimit({ points: 5, duration: 60 }),
  ] as const;

  routes.use('/', ...admin);
  routes.use('/templates', ...admin);
  routes.use('/templates/*', ...admin);
  routes.use('/usage', ...admin);
  routes.use('/logs', ...admin);
  routes.use('/test-send', ...testSendLimit);

  const listTemplatesRoute = createRoute({
    method: 'get',
    path: '/templates',
    tags: ['WA', 'Admin'],
    summary: 'List template WA (admin/root)',
    responses: {
      200: { description: 'Daftar template', content: json(waTemplateListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
    },
  });

  const updateTemplateRoute = createRoute({
    method: 'patch',
    path: '/templates/:id',
    tags: ['WA', 'Admin'],
    summary: 'Ubah template WA (body/flag/meta name/language)',
    request: {
      params: z.object({ id: z.string().min(1) }),
      body: { content: json(updateWaTemplateBodySchema) },
    },
    responses: {
      200: { description: 'Updated', content: json(waTemplateResponseSchema) },
      400: { description: 'Placeholder tidak terdaftar di params', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      404: { description: 'Template tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const getUsageRoute = createRoute({
    method: 'get',
    path: '/usage',
    tags: ['WA', 'Admin'],
    summary: 'Baca quota WA provider aktif (reset otomatis tiap awal bulan WIB)',
    responses: {
      200: { description: 'Usage', content: json(waUsageResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      404: { description: 'Provider belum terdaftar', content: json(errorResponseSchema) },
    },
  });

  const updateUsageRoute = createRoute({
    method: 'patch',
    path: '/usage',
    tags: ['WA', 'Admin'],
    summary: 'Koreksi manual quota (sinkron pemakaian dari dashboard Kapso)',
    request: { body: { content: json(updateWaUsageBodySchema) } },
    responses: {
      200: { description: 'Updated', content: json(waUsageResponseSchema) },
      400: { description: 'Validasi', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
    },
  });

  const listLogsRoute = createRoute({
    method: 'get',
    path: '/logs',
    tags: ['WA', 'Admin'],
    summary: 'Log kirim WA (cursor pagination)',
    request: { query: listWaLogsQuerySchema },
    responses: {
      200: { description: 'Logs', content: json(waLogListResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
    },
  });

  const testSendRoute = createRoute({
    method: 'post',
    path: '/test-send',
    tags: ['WA', 'Admin'],
    summary: 'Kirim pesan WA uji: raw body template, tanpa render parameter',
    request: { body: { content: json(testSendBodySchema) } },
    responses: {
      200: { description: 'Hasil kirim + sisa quota', content: json(testSendResponseSchema) },
      400: { description: 'Validasi', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      404: { description: 'Template tidak ditemukan', content: json(errorResponseSchema) },
    },
  });

  const createTemplateRoute = createRoute({
    method: 'post',
    path: '/templates',
    tags: ['WA', 'Admin'],
    summary: 'Buat template WA baru (event baru tanpa migrasi seed)',
    request: { body: { content: json(createWaTemplateBodySchema) } },
    responses: {
      201: { description: 'Template dibuat', content: json(waTemplateResponseSchema) },
      400: { description: 'Body tidak valid', content: json(errorResponseSchema) },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      409: { description: 'event_key sudah dipakai', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listTemplatesRoute, async (c) => {
    const templates = await deps.templateRepo.list();
    return c.json({ success: true as const, data: { templates: templates.map(serializeTemplate) } }) as never;
  });

  routes.openapi(createTemplateRoute, async (c) => {
    const body = c.req.valid('json');
    const actor = requireUser(c);
    const created = await deps.templateRepo.create(
      {
        eventKey: body.event_key,
        enabled: body.enabled,
        metaTemplateName: body.meta_template_name,
        metaTemplateLanguage: body.meta_template_language,
        body: body.body,
        params: body.params,
      },
      actor.user_id,
    );
    return c.json({ success: true as const, data: { template: serializeTemplate(created) } }, 201) as never;
  });

  routes.openapi(updateTemplateRoute, async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json') as z.infer<typeof updateWaTemplateBodySchema>;
    const templates = await deps.templateRepo.list();
    const existing = templates.find((t) => t.id === id);
    if (!existing) {
      throw new NotFoundError('WA_TEMPLATE_NOT_FOUND', 'Template tidak ditemukan');
    }
    if (body.body !== undefined) {
      const known = new Set(existing.params.map((p) => p.name));
      const unknown = [...body.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
        .map((m) => m[1]!)
        .filter((name) => !known.has(name));
      if (unknown.length > 0) {
        throw new BadRequestError(
          'VALIDATION_ERROR',
          `Placeholder tidak terdaftar di params: ${[...new Set(unknown)].join(', ')}`,
          [{ field: 'body', message: 'Perbaiki placeholder atau tambah di params template' }],
        );
      }
    }
    const updated = await deps.templateRepo.update(
      id,
      {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.meta_template_name !== undefined ? { metaTemplateName: body.meta_template_name } : {}),
        ...(body.meta_template_language !== undefined
          ? { metaTemplateLanguage: body.meta_template_language }
          : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
      },
      requireUser(c).user_id,
    );
    return c.json({ success: true as const, data: { template: serializeTemplate(updated) } }) as never;
  });

  routes.openapi(getUsageRoute, async (c) => {
    const usage = await deps.usageRepo.getActive('kapso');
    return c.json({ success: true as const, data: { usage: serializeUsage(usage) } }) as never;
  });

  routes.openapi(updateUsageRoute, async (c) => {
    const body = c.req.valid('json') as z.infer<typeof updateWaUsageBodySchema>;
    const usage = await deps.usageRepo.setUsage(
      'kapso',
      {
        ...(body.used_count !== undefined ? { usedCount: body.used_count } : {}),
        ...(body.limit_count !== undefined ? { limitCount: body.limit_count } : {}),
        ...(body.warn_threshold_percent !== undefined
          ? { warnThresholdPercent: body.warn_threshold_percent }
          : {}),
      },
      requireUser(c).user_id,
    );
    return c.json({ success: true as const, data: { usage: serializeUsage(usage) } }) as never;
  });

  routes.openapi(listLogsRoute, async (c) => {
    const query = c.req.valid('query') as z.infer<typeof listWaLogsQuerySchema>;
    const result = await deps.logRepo.list({ cursor: query.cursor ?? null, limit: query.limit });
    return c.json({
      success: true as const,
      data: {
        logs: result.items.map((l) => ({
          id: l.id,
          provider: l.provider,
          event_key: l.eventKey,
          to_phone: l.toPhone,
          template_name: l.templateName,
          channel: l.channel,
          status: l.status,
          error_message: l.errorMessage,
          created_at: l.createdAt.toISOString(),
        })),
        next_cursor: result.nextCursor,
      },
    }) as never;
  });

  routes.openapi(testSendRoute, async (c) => {
    const body = c.req.valid('json') as z.infer<typeof testSendBodySchema>;
    const templates = await deps.templateRepo.list();
    const tpl = templates.find((t) => t.id === body.template_id);
    if (!tpl) {
      throw new NotFoundError('WA_TEMPLATE_NOT_FOUND', 'Template tidak ditemukan');
    }
    const result = await deps.sendWa.sendTest(body.phone, tpl.body, tpl.metaTemplateName);
    let usage = null;
    try {
      usage = serializeUsage(await deps.usageRepo.getActive('kapso'));
    } catch {
      usage = null;
    }
    return c.json({ success: true as const, data: { sent: result.sent, reason: result.reason ?? null, usage } }) as never;
  });

  return routes;
}

function requireUser(c: Context): AuthUser {
  const user = (c as Context<{ Variables: AppVariables }>).get('user');
  if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
  return user;
}
