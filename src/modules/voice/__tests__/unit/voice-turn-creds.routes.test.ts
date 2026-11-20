import { describe, expect, it, vi } from 'vitest';
import { createMiddleware } from 'hono/factory';
import type { AppVariables } from '@/shared/types';
import { createVoiceRoutes } from '../../presentation/v1/voice.routes';
import type { VoiceController } from '../../presentation/v1/voice.controller';

describe('GET /turn-creds auth wiring', () => {
  it('401 tanpa token (authenticate menolak)', async () => {
    const turnCreds = vi.fn();
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
    const app = createVoiceRoutes({
      controller: { turnCreds } as unknown as VoiceController,
      authenticate,
    });

    const res = await app.request('/turn-creds', { method: 'GET' });
    expect(res.status).toBe(401);
    expect(turnCreds).not.toHaveBeenCalled();
  });

  it('200 dengan token memanggil controller.turnCreds', async () => {
    const turnCreds = vi.fn(
      async (c: { json: (b: unknown, s: number) => Response }) =>
        c.json(
          {
            success: true,
            data: {
              urls: [
                'turn:turn.sambasku.com:3478?transport=udp',
                'turn:turn.sambasku.com:3478?transport=tcp',
                'turns:turn.sambasku.com:5349?transport=tcp',
              ],
              username: '1700000000:abcd1234',
              credential: 'dGVzdA==',
              ttl: 86400,
            },
          },
          200,
        ),
    );
    const authenticate = createMiddleware<{ Variables: AppVariables }>(
      async (c, next) => {
        c.set('user', {
          user_id: 'u1',
          role: 'user',
        } as AppVariables['user']);
        await next();
      },
    );
    const app = createVoiceRoutes({
      controller: { turnCreds } as unknown as VoiceController,
      authenticate,
    });

    const res = await app.request('/turn-creds', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(turnCreds).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as {
      success: boolean;
      data: { urls: string[]; username: string; credential: string; ttl: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.ttl).toBe(86400);
    expect(body.data.urls).toHaveLength(3);
    expect(body.data.username).toBeTruthy();
    expect(body.data.credential).toBeTruthy();
  });
});
