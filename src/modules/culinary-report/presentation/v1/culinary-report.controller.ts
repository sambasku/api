import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
import type { z } from 'zod';
import type { CulinaryReportUseCases } from '../../application/culinary-report.use-cases';
import type {
  CulinaryReport,
  CulinaryReportWithTarget,
} from '../../domain/culinary-report.entity';
import type { listReportsQuerySchema } from './validators/culinary-report.validator';

function serialize(r: CulinaryReport | CulinaryReportWithTarget) {
  const withTarget = r as CulinaryReportWithTarget;
  return {
    id: r.id,
    target_type: r.targetType,
    target_id: r.targetId,
    target_slug: withTarget.targetSlug ?? null,
    target_name: withTarget.targetName ?? null,
    reason_code: r.reasonCode,
    note: r.note,
    status: r.status,
    resolution: r.resolution,
    resolution_note: r.resolutionNote,
    created_at: r.createdAt.toISOString(),
    resolved_at: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

export class CulinaryReportController {
  constructor(private readonly uc: CulinaryReportUseCases) {}

  submit(
    c: Context<{ Variables: AppVariables }>,
    targetType: 'cuisine' | 'place',
    slug: string,
    body: { reason_code: string; note?: string | null },
  ) {
    return this.uc
      .submit(c.get('user')?.user_id ?? '', {
        targetType,
        slug,
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
