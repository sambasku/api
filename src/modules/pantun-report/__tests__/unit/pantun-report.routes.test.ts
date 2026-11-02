import { describe, expect, it, vi } from 'vitest';
import { createMiddleware } from 'hono/factory';
import type { AppVariables } from '@/shared/types';
import { createPantunReportRoutes } from '../../presentation/v1/pantun-report.routes';
import type { PantunReportController } from '../../presentation/v1/pantun-report.controller';

const PANTUN_ID = '01M5S90NK8ERSX5AF9VMTDQP22';
const jsonHeaders = { 'content-type': 'application/json' };
const body = {
  target_type: 'pantun',
  target_id: PANTUN_ID,
  reason_code: 'spam',
};

describe('pantun report routes auth wiring', () => {
  it('POST /reports tanpa token → 401, controller tidak dipanggil', async () => {
    const submit = vi.fn();
    const authenticate = createMiddleware<{ Variables: AppVariables }>(async (c) =>
      c.json(
        { success: false, error_code: 'UNAUTHORIZED', message: 'Token tidak disertakan' },
        401,
      ),
    );
    const app = createPantunReportRoutes({
      controller: { submit } as unknown as PantunReportController,
      authenticate,
    });

    const res = await app.request('/reports', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });

    expect(res.status).toBe(401);
    expect(submit).not.toHaveBeenCalled();
  });

  it('POST /reports dengan token valid memanggil controller', async () => {
    const submit = vi.fn(
      async (c: { json: (b: unknown, s: number) => Response }) =>
        c.json({ success: true, data: {} }, 201),
    );
    const authenticate = createMiddleware<{ Variables: AppVariables }>(
      async (_c, next) => next(),
    );
    const app = createPantunReportRoutes({
      controller: { submit } as unknown as PantunReportController,
      authenticate,
    });

    const res = await app.request('/reports', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });

    expect(res.status).toBe(201);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
