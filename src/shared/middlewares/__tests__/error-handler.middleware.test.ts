import { describe, expect, it, afterEach, vi } from 'vitest';
import { z } from 'zod';
import type { Context } from 'hono';
import type { AppVariables } from '@/shared/types';
// Logger menarik env.ts yang parse-Zod env saat import; test unit tidak
// pakai logger - mock agar tidak butuh DATABASE_URL dkk.
vi.mock('@/shared/logging/logger', () => ({ logger: { error: vi.fn() } }));
import { errorHandler } from '../error-handler.middleware';

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

function run(nodeEnv: string) {
  process.env.NODE_ENV = nodeEnv;
  const res = errorHandler(makeZodError(), makeCtx()) as Response;
  return res.json() as Promise<{ details: { field: string; message: string }[] }>;
}

describe('errorHandler - ZodError message per env', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
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
