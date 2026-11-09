import type { Context } from 'hono';
import { UnauthorizedError } from '@/shared/errors/app-error';
import type { AppVariables } from '@/shared/types';
import type { SubmitJinyeReportUseCase } from '../../application/use-cases/submit-jinye-report.use-case';
import type { SubmitJinyeReportBody } from './validators/jinye-report.validator';

export class JinyeReportController {
  constructor(
    private readonly deps: {
      submit: SubmitJinyeReportUseCase;
    },
  ) {}

  async submit(c: Context<{ Variables: AppVariables }>, body: SubmitJinyeReportBody) {
    const user = c.get('user');
    if (!user) throw new UnauthorizedError();
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
}
