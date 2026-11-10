import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables, AuthUser } from '@/shared/types';
import type { JinyeReportWithTarget } from '../../domain/entities/jinye-report.entity';
import type { SubmitJinyeReportUseCase } from '../../application/use-cases/submit-jinye-report.use-case';
import type { ListJinyeReportsUseCase } from '../../application/use-cases/list-jinye-reports.use-case';
import type { ResolveJinyeReportUseCase } from '../../application/use-cases/resolve-jinye-report.use-case';
import type {
  ListJinyeReportsQuery,
  ResolveJinyeReportBody,
  SubmitJinyeReportBody,
} from './validators/jinye-report.validator';

function truncateBody(body: string | null, max = 280): string | null {
  if (body == null) return null;
  const t = body.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function toJinyeReportItem(row: JinyeReportWithTarget) {
  return {
    id: row.id,
    target_type: row.targetType,
    target_id: row.targetId,
    target_body: truncateBody(row.targetBody),
    target_has_images: row.targetHasImages,
    target_has_audio: row.targetHasAudio,
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

export class JinyeReportController {
  constructor(
    private readonly deps: {
      submit: SubmitJinyeReportUseCase;
      list: ListJinyeReportsUseCase;
      resolve: ResolveJinyeReportUseCase;
    },
  ) {}

  async submit(c: Context<{ Variables: AppVariables }>, body: SubmitJinyeReportBody) {
    const user = this.requireUser(c);
    const row = await this.deps.submit.execute({
      targetType: body.target_type,
      targetId: body.target_id,
      userId: user.user_id,
      reasonCode: body.reason_code,
      note: body.note,
      requestId: c.get('requestId') ?? null,
    });
    return c.json(
      {
        data: {
          id: row.id,
          target_type: row.targetType,
          target_id: row.targetId,
          reason_code: row.reasonCode,
          status: 'open' as const,
          created_at: row.createdAt.toISOString(),
        },
      },
      201,
    );
  }

  async list(c: Context, query: ListJinyeReportsQuery) {
    const page = await this.deps.list.execute({
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({
      success: true as const,
      data: page.items.map(toJinyeReportItem),
      meta: {
        limit: query.limit,
        next_cursor: page.nextCursor,
        has_more: page.hasMore,
      },
    });
  }

  async resolve(c: Context, id: string, body: ResolveJinyeReportBody) {
    const user = this.requireUser(c);
    const row = await this.deps.resolve.execute({
      id,
      resolution: body.resolution,
      note: body.note ?? null,
      actorId: user.user_id,
      requestId: this.requestId(c),
    });
    return c.json({ success: true as const, data: toJinyeReportItem(row) });
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
