import { describe, expect, it, vi } from 'vitest';
import { createMiddleware } from 'hono/factory';
import type { AppVariables } from '@/shared/types';
import { createPantunRoutes } from '../../presentation/v1/pantun.routes';
import type { PantunController } from '../../presentation/v1/pantun.controller';

const PANTUN_ID = '01M5S90NK8ERSX5AF9VMTDQP22';
const jsonHeaders = { 'content-type': 'application/json' };
const body = {
  lines: [
    'basissaa itok baris satu',
    'baris itok baris dua',
    'mun kire kire capat nak bemenantu',
    'terima lamaranku kalak tanggal dua',
  ],
};

/**
 * Regresi: middleware auth sempat di-mount ke `/replies/:id` (DELETE saja)
 * sehingga POST `/:id/replies` selalu 401 walau token valid.
 */
describe('pantun routes auth wiring', () => {
  it('POST /:id/replies memakai authenticate (401 tanpa token)', async () => {
    const createReply = vi.fn();
    const authenticate = createMiddleware<{ Variables: AppVariables }>(async (c) =>
      c.json(
        {
          success: false,
          error_code: 'UNAUTHORIZED',
          message: 'Token tidak disertakan',
          details: null,
        },
        401,
      ),
    );
    const app = createPantunRoutes({
      controller: { createReply } as unknown as PantunController,
      authenticate,
    });

    const res = await app.request(`/${PANTUN_ID}/replies`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });

    expect(res.status).toBe(401);
    expect(createReply).not.toHaveBeenCalled();
  });

  it('POST /:id/replies dengan token valid memanggil controller', async () => {
    const createReply = vi.fn(
      async (c: { json: (b: unknown, s: number) => Response }) =>
        c.json({ success: true, data: {} }, 201),
    );
    const authenticate = createMiddleware<{ Variables: AppVariables }>(
      async (_c, next) => next(),
    );
    const app = createPantunRoutes({
      controller: { createReply } as unknown as PantunController,
      authenticate,
    });

    const res = await app.request(`/${PANTUN_ID}/replies`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: jsonHeaders,
    });

    expect(res.status).toBe(201);
    expect(createReply).toHaveBeenCalledTimes(1);
  });

  it('DELETE /:id butuh login, sementara GET /:id tetap publik', async () => {
    const deletePantun = vi.fn(
      async (c: { json: (b: unknown, s: number) => Response }) =>
        c.json({ success: true, data: null }, 200),
    );
    const getDetail = vi.fn(
      async (c: { json: (b: unknown, s: number) => Response }) =>
        c.json({ success: true, data: {} }, 200),
    );
    const authenticate = createMiddleware<{ Variables: AppVariables }>(
      async (_c, next) => next(),
    );
    const app = createPantunRoutes({
      controller: { deletePantun, getDetail } as unknown as PantunController,
      authenticate,
    });

    const del = await app.request(`/${PANTUN_ID}`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    expect(deletePantun).toHaveBeenCalledTimes(1);

    const get = await app.request(`/${PANTUN_ID}`);
    expect(get.status).toBe(200);
    expect(getDetail).toHaveBeenCalledTimes(1);

    const search = await app.request('/search?q=ikan');
    // Tanpa auth: route search tidak boleh tersentuh middleware DELETE.
    expect(search.status).not.toBe(401);
  });
});
