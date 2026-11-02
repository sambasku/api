import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type { UsahaReportUseCases } from '../../application/usaha-report.use-cases';
import type {
  UsahaReport,
  UsahaReportWithUsaha,
} from '../../domain/usaha-report.entity';
import type { listReportsQuerySchema } from './validators/usaha-report.validator';

function serialize(r: UsahaReport | UsahaReportWithUsaha) {
  const withUsaha = r as UsahaReportWithUsaha;
  return {
    id: r.id,
    usaha_id: r.usahaId,
    usaha_slug: withUsaha.usahaSlug,
    usaha_name: withUsaha.usahaName,
    reason_code: r.reasonCode,
    note: r.note,
    status: r.status,
    resolution: r.resolution,
    resolution_note: r.resolutionNote,
    created_at: r.createdAt.toISOString(),
    resolved_at: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

export class UsahaReportController {
  constructor(private readonly uc: UsahaReportUseCases) {}

  submit(
    c: Context<{ Variables: AppVariables }>,
    slug: string,
    body: { reason_code: string; note?: string | null },
  ) {
    return this.uc
      .submit(c.get('user')?.user_id ?? '', slug, {
        reasonCode: body.reason_code,
        note: body.note,
      })
      .then((r) => c.json({ success: true as const, data: serialize(r) }));
  }

  listAdmin(
    c: Context<{ Variables: AppVariables }>,
    query: z.infer<typeof listReportsQuerySchema>,
  ) {
    return this.uc.list(query.status).then((items) =>
      c.json({
        success: true as const,
        data: { items: items.map(serialize) },
      }),
    );
  }

  resolve(
    c: Context<{ Variables: AppVariables }>,
    id: string,
    body: {
      status: 'resolved' | 'dismissed';
      resolution: string;
      resolution_note?: string | null;
    },
  ) {
    return this.uc
      .resolve(
        id,
        {
          status: body.status,
          resolution: body.resolution,
          resolutionNote: body.resolution_note ?? null,
        },
        c.get('user')?.user_id ?? '',
        c.get('requestId') ?? null,
      )
      .then(() => c.json({ success: true as const, data: null }));
  }
}
