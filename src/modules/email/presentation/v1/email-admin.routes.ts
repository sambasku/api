import type { MiddlewareHandler } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { authorizeRole } from '@/shared/middlewares/authorize-role.middleware';
import { rateLimit } from '@/shared/middlewares/rate-limit.middleware';
import { createOpenApiApp } from '@/shared/openapi/openapi-app';
import { errorResponseSchema } from '@/shared/openapi/error-response.schema';
import { ServiceUnavailableError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type {
  EmailLogRepository,
  EmailQuotaRepository,
} from '../../domain/repositories/email.repository';

const json = <T extends z.ZodType>(schema: T) => ({
  'application/json': { schema },
});

const emailLogSchema = z.object({
  id: z.string(),
  provider: z.string(),
  category: z.string(),
  to_email: z.string(),
  status: z.string(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  provider_message_id: z.string().nullable(),
  created_at: z.string(),
});

const listLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  status: z.enum(['sent', 'failed', 'skipped_quota', 'skipped_env']).optional(),
  provider: z.string().min(1).optional(),
});

const emailQuotaSchema = z.object({
  provider: z.string(),
  monthly_limit: z.number().int(),
  daily_limit: z.number().int(),
  manual_monthly_used: z.number().int(),
  manual_used_effective: z.number().int(),
  priority: z.number().int(),
  active: z.boolean(),
  api_month_used: z.number().int(),
  today_used: z.number().int(),
  updated_at: z.string().nullable(),
});

/**
 * GET /api/v1/admin/email/logs + /quotas - admin/root. Log kirim email
 * (status per attempt) + baris kuota provider terhitung.
 */
const testSendBodySchema = z.object({
  to: z.email('Email tujuan tidak valid'),
  provider: z.string().trim().min(1).optional(),
});

const testSendDataSchema = z.object({
  sent: z.boolean(),
  provider: z.string().nullable(),
  message_id: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
});

function testSendData(result: {
  sent: boolean;
  provider: string | null;
  messageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}) {
  return {
    sent: result.sent,
    provider: result.provider,
    message_id: result.messageId,
    error_code: result.errorCode,
    error_message: result.errorMessage,
  };
}

export function createEmailAdminRoutes(deps: {
  quotaRepo: EmailQuotaRepository;
  logRepo: EmailLogRepository;
  mailer: {
    sendTest(to: string, provider?: string): Promise<{
      sent: boolean;
      provider: string | null;
      messageId: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    }>;
  };
  authenticate: MiddlewareHandler<{ Variables: AppVariables }>;
}) {
  const routes = createOpenApiApp();

  const admin = [deps.authenticate, authorizeRole('admin', 'root'), rateLimit({ points: 500, duration: 60 })] as const;
  const testLimit = [deps.authenticate, authorizeRole('admin', 'root'), rateLimit({ points: 5, duration: 60 })] as const;
  routes.use('/', ...admin);
  routes.use('/logs', ...admin);
  routes.use('/quotas', ...admin);
  routes.use('/test', ...testLimit);

  const listLogsRoute = createRoute({
    method: 'get',
    path: '/logs',
    tags: ['Email', 'Admin'],
    summary: 'Log kirim email (cursor pagination)',
    request: { query: listLogsQuerySchema },
    responses: {
      200: {
        description: 'Logs',
        content: json(z.object({
          success: z.literal(true),
          data: z.object({ logs: z.array(emailLogSchema), next_cursor: z.string().nullable() }),
        })),
      },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listLogsRoute, async (c) => {
    const q = c.req.valid('query');
    const result = await deps.logRepo.list({
      limit: q.limit,
      cursor: q.cursor ?? null,
      status: q.status,
      provider: q.provider,
    });
    return c.json({
      success: true as const,
      data: {
        logs: result.items.map((l) => ({
          id: l.id,
          provider: l.provider,
          category: l.category,
          to_email: l.toEmail,
          status: l.status,
          error_code: l.errorCode,
          error_message: l.errorMessage,
          provider_message_id: l.providerMessageId,
          created_at: l.createdAt.toISOString(),
        })),
        next_cursor: result.nextCursor,
      },
    }) as never;
  });

  const listQuotasRoute = createRoute({
    method: 'get',
    path: '/quotas',
    tags: ['Email', 'Admin'],
    summary: 'Kuota provider email + pemakaian bulan/hari berjalan',
    responses: {
      200: {
        description: 'Quotas',
        content: json(z.object({
          success: z.literal(true),
          data: z.object({ quotas: z.array(emailQuotaSchema) }),
        })),
      },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(listQuotasRoute, async (c) => {
    const rows = await deps.quotaRepo.listWithUsage(new Date());
    return c.json({
      success: true as const,
      data: {
        quotas: rows.map((r) => ({
          provider: r.provider,
          monthly_limit: r.monthlyLimit,
          daily_limit: r.dailyLimit,
          manual_monthly_used: r.manualMonthlyUsed,
          manual_used_effective: r.manualUsedEffective,
          priority: r.priority,
          active: r.active,
          api_month_used: r.apiMonthUsed,
          today_used: r.todayUsed,
          updated_at: r.updatedAt?.toISOString() ?? null,
        })),
      },
    }) as never;
  });

  const testSendRoute = createRoute({
    method: 'post',
    path: '/test',
    tags: ['Email', 'Admin'],
    summary: 'Kirim email test (quota + log, category test)',
    request: {
      body: { required: true, content: json(testSendBodySchema) },
    },
    responses: {
      200: {
        description: 'Hasil kirim. sent false tetap 200 supaya console menampilkan penyebabnya.',
        content: json(z.object({
          success: z.literal(true),
          data: testSendDataSchema,
        })),
      },
      401: { description: 'Token tidak ada/invalid', content: json(errorResponseSchema) },
      403: { description: 'Bukan admin/root', content: json(errorResponseSchema) },
      429: { description: 'Terlalu sering (5 per menit)', content: json(errorResponseSchema) },
    },
  });

  routes.openapi(testSendRoute, async (c) => {
    const body = c.req.valid('json');
    try {
      const result = await deps.mailer.sendTest(body.to, body.provider);
      return c.json({ success: true as const, data: testSendData(result) }) as never;
    } catch (err) {
      if (err instanceof ServiceUnavailableError) {
        return c.json({
          success: true as const,
          data: {
            sent: false,
            provider: err.errorCode === 'EMAIL_NOT_CONFIGURED' ? 'none' : null,
            message_id: null,
            error_code: err.errorCode,
            error_message: err.message,
          },
        }) as never;
      }
      throw err;
    }
  });

  return routes;
}
