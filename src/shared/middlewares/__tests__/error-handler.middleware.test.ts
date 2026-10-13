import { describe, expect, it, vi, afterEach } from 'vitest';
import { z } from 'zod';
import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';

const makeZodError = () =>
  new z.ZodError([
    {
      code: 'invalid_type',
      expected: 'string',
      path: ['images', 0, 'alt_text'],
      message: 'Invalid input: expected string, received null',
    },
  ]);

// errorHandler hanya pakai c.json(body, status) - cukup mock itu.
const makeCtx = () =>
  ({
    json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
  }) as unknown as Context<{ Variables: AppVariables }>;

// env dibaca lazy per request; re-mock + re-import per skenario.
async function run(nodeEnv: string) {
  vi.resetModules();
  vi.doMock('@/shared/config/env', () => ({ env: { NODE_ENV: nodeEnv } }));
  const { errorHandler } = await import('../error-handler.middleware');
  const res = errorHandler(makeZodError(), makeCtx()) as Response;
  return (await res.json()) as { details: { field: string; message: string }[] };
}

describe('errorHandler - ZodError message per env', () => {
  afterEach(() => {
    vi.doUnmock('@/shared/config/env');
  });

  it('production: pesan detail diganti generik (tidak expose pesan Zod)', async () => {
    const body = await run('production');
    expect(body.details[0].field).toBe('images.[0].alt_text');
    expect(body.details[0].message).toBe('Terjadi kendala pada isian ini.');
  });

  it('staging: pesan Zod asli tetap tampil untuk debug', async () => {
    const body = await run('staging');
    expect(body.details[0].message).toBe('Invalid input: expected string, received null');
  });

  it('development: pesan Zod asli tetap tampil untuk debug', async () => {
    const body = await run('development');
    expect(body.details[0].message).toBe('Invalid input: expected string, received null');
  });
});
