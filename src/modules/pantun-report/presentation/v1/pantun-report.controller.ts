import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { PantunReportWithTarget } from '../../domain/entities/pantun-report.entity';
import type { SubmitPantunReportUseCase } from '../../application/use-cases/submit-pantun-report.use-case';
import type { ListPantunReportsUseCase } from '../../application/use-cases/list-pantun-reports.use-case';
import type { ResolvePantunReportUseCase } from '../../application/use-cases/resolve-pantun-report.use-case';
import type {
  ListPantunReportsQuery,
  ResolvePantunReportBody,
  SubmitPantunReportBody,
} from './validators/pantun-report.validator';

export function toPantunReportItem(row: PantunReportWithTarget) {
  return {
    id: row.id,
    target_type: row.targetType,
    target_id: row.targetId,
    target_lines: row.targetLines,
    target_status: row.targetStatus,
    target_user_id: row.targetUserId,
    target_username: row.targetUsername,
    target_display_name: row.targetDisplayName,
    user_id: row.userId,
    username: row.username,
    display_name: row.displayName,
    reason_code: row.reasonCode,
    note: row.note,
    status: row.status,
    resolution: row.resolution,
    resolution_note: row.resolutionNote,
    created_at: row.createdAt.toISOString(),
    resolved_at: row.resolvedAt?.toISOString() ?? null,
  };
}

export class PantunReportController {
  constructor(
    private readonly deps: {
      submit: SubmitPantunReportUseCase;
      list: ListPantunReportsUseCase;
      resolve: ResolvePantunReportUseCase;
    },
  ) {}

  async submit(c: Context, body: SubmitPantunReportBody) {
    const user = this.requireUser(c);
    const row = await this.deps.submit.execute({
      targetType: body.target_type,
      targetId: body.target_id,
      userId: user.user_id,
      reasonCode: body.reason_code,
      note: body.note ?? null,
      requestId: this.requestId(c),
    });
    return c.json(
      {
        success: true as const,
        data: {
          id: row.id,
          target_type: row.targetType,
          target_id: row.targetId,
          status: 'open' as const,
          created_at: row.createdAt.toISOString(),
        },
      },
      201,
    );
  }

  async list(c: Context, query: ListPantunReportsQuery) {
    const page = await this.deps.list.execute({
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toPantunReportItem),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async resolve(c: Context, id: string, body: ResolvePantunReportBody) {
    const user = this.requireUser(c);
    const row = await this.deps.resolve.execute({
      id,
      resolution: body.resolution,
      note: body.note ?? null,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toPantunReportItem(row) });
  }

  private requireUser(c: Context): AuthUser {
    const user = (c as Context<{ Variables: AppVariables }>).get('user');
    if (!user) throw new UnauthorizedError('UNAUTHORIZED', 'Token tidak disertakan');
    return user;
  }

  private requestId(c: Context): string | undefined {
    return (c as Context<{ Variables: AppVariables }>).get('requestId');
  }
}
